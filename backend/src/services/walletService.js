const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const {
    TRANSACTION_TYPES,
    TRANSACTION_STATUS,
    MIN_TRANSACTION_AMOUNT,
    MAX_TRANSACTION_AMOUNT,
    DAILY_TRANSFER_LIMIT,
    DAILY_ADD_MONEY_LIMIT,
    OTP_VALIDITY_MINUTES
} = require('../config/constants');
const paymentGateway = require('./paymentGateway');
const { generateOTP } = require('../utils/crypto');
const logger = require('../utils/logger');

class WalletService {
    /**
     * Get wallet balance
     */
    async getBalance(userId) {
        const [wallets] = await db.query(
            'SELECT balance, currency FROM wallets WHERE user_id = ?',
            [userId]
        );

        if (wallets.length === 0) {
            throw new Error('Wallet not found');
        }

        return wallets[0];
    }

    /**
     * Add money to wallet
     * Handles mock payment gateway integration with idempotency
     */
    async addMoney(userId, amount, paymentMethod, idempotencyKey) {
        // Validate amount
        this.validateAmount(amount);

        // Check daily limit
        await this.checkDailyAddMoneyLimit(userId, amount);

        // Check idempotency
        const existingTransaction = await this.checkIdempotency(idempotencyKey);
        if (existingTransaction) {
            return existingTransaction;
        }

        const connection = await db.getConnection();
        const transactionId = uuidv4();

        try {
            await connection.beginTransaction();

            // Get current balance with row lock
            const [wallets] = await connection.query(
                'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
                [userId]
            );

            if (wallets.length === 0) {
                throw new Error('Wallet not found');
            }

            const currentBalance = parseFloat(wallets[0].balance);

            // Create pending transaction
            await connection.query(
                `INSERT INTO transactions 
                (transaction_id, idempotency_key, user_id, type, amount, balance_before, balance_after, status, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    transactionId,
                    idempotencyKey,
                    userId,
                    TRANSACTION_TYPES.ADD_MONEY,
                    amount,
                    currentBalance,
                    currentBalance, // Will update after payment success
                    TRANSACTION_STATUS.PENDING,
                    paymentMethod
                ]
            );

            await connection.commit();

            // Process payment through mock gateway (outside transaction)
            const paymentResult = await paymentGateway.processPayment(paymentMethod, amount);

            // Update transaction based on payment result
            await connection.beginTransaction();

            if (paymentResult.success) {
                const newBalance = currentBalance + amount;

                // Update wallet balance
                await connection.query(
                    'UPDATE wallets SET balance = ? WHERE user_id = ?',
                    [newBalance, userId]
                );

                // Update transaction to success
                await connection.query(
                    `UPDATE transactions 
                     SET status = ?, balance_after = ?, metadata = ?
                     WHERE transaction_id = ?`,
                    [
                        TRANSACTION_STATUS.SUCCESS,
                        newBalance,
                        JSON.stringify(paymentResult.gatewayResponse),
                        transactionId
                    ]
                );

                // Update daily limit
                await this.updateDailyLimit(connection, userId, 'total_added', amount);

                await connection.commit();

                return {
                    success: true,
                    message: paymentResult.message,
                    transaction: {
                        id: transactionId,
                        amount,
                        balance: newBalance,
                        paymentMethod,
                        status: TRANSACTION_STATUS.SUCCESS
                    }
                };
            } else {
                // Update transaction to failed
                await connection.query(
                    `UPDATE transactions 
                     SET status = ?, failure_reason = ?
                     WHERE transaction_id = ?`,
                    [
                        TRANSACTION_STATUS.FAILED,
                        paymentResult.message,
                        transactionId
                    ]
                );

                await connection.commit();

                return {
                    success: false,
                    message: paymentResult.message,
                    transaction: {
                        id: transactionId,
                        amount,
                        balance: currentBalance,
                        paymentMethod,
                        status: TRANSACTION_STATUS.FAILED
                    }
                };
            }

        } catch (error) {
            await connection.rollback();
            logger.error('Add money failed:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Generate OTP for transfer
     */
    async generateTransferOTP(userId, toEmail, amount) {
        // Validate amount
        this.validateAmount(amount);

        // Get recipient user
        const [recipients] = await db.query(
            'SELECT id, name FROM users WHERE email = ? AND is_active = TRUE',
            [toEmail]
        );

        if (recipients.length === 0) {
            throw new Error('Recipient not found');
        }

        const recipientId = recipients[0].id;

        if (recipientId === userId) {
            throw new Error('Cannot transfer to yourself');
        }

        // Check sender balance
        const [wallets] = await db.query(
            'SELECT balance FROM wallets WHERE user_id = ?',
            [userId]
        );

        if (wallets.length === 0 || parseFloat(wallets[0].balance) < amount) {
            throw new Error('Insufficient balance');
        }

        // Check daily transfer limit
        await this.checkDailyTransferLimit(userId, amount);

        // Generate OTP
        const otp = generateOTP(6);
        const referenceId = uuidv4();
        const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

        await db.query(
            `INSERT INTO otps (user_id, otp_code, purpose, reference_id, expires_at)
             VALUES (?, ?, 'TRANSFER', ?, ?)`,
            [userId, otp, referenceId, expiresAt]
        );

        logger.info(`OTP generated for user ${userId}: ${otp}`); // In production, send via SMS

        return {
            success: true,
            message: `OTP sent successfully. Valid for ${OTP_VALIDITY_MINUTES} minutes.`,
            referenceId,
            recipient: {
                name: recipients[0].name,
                email: toEmail
            },
            // In development, return OTP for testing
            ...(process.env.NODE_ENV === 'development' && { otp })
        };
    }

    /**
     * Transfer money between users
     * Atomic operation with OTP verification
     */
    async transfer(userId, toEmail, amount, otp, referenceId, idempotencyKey) {
        // Validate OTP
        const [otps] = await db.query(
            `SELECT id FROM otps 
             WHERE user_id = ? AND reference_id = ? AND otp_code = ? 
             AND is_used = FALSE AND expires_at > NOW()`,
            [userId, referenceId, otp]
        );

        if (otps.length === 0) {
            throw new Error('Invalid or expired OTP');
        }

        // Check idempotency
        const existingTransaction = await this.checkIdempotency(idempotencyKey);
        if (existingTransaction) {
            return existingTransaction;
        }

        const connection = await db.getConnection();
        const debitTransactionId = uuidv4();
        const creditTransactionId = uuidv4();

        try {
            await connection.beginTransaction();

            // Get recipient
            const [recipients] = await connection.query(
                'SELECT id FROM users WHERE email = ? AND is_active = TRUE',
                [toEmail]
            );

            if (recipients.length === 0) {
                throw new Error('Recipient not found');
            }

            const recipientId = recipients[0].id;

            // Lock both wallets in consistent order to prevent deadlock
            const userIds = [userId, recipientId].sort((a, b) => a - b);
            
            const [wallets] = await connection.query(
                'SELECT user_id, balance FROM wallets WHERE user_id IN (?, ?) FOR UPDATE',
                userIds
            );

            const senderWallet = wallets.find(w => w.user_id === userId);
            const recipientWallet = wallets.find(w => w.user_id === recipientId);

            if (!senderWallet || !recipientWallet) {
                throw new Error('Wallet not found');
            }

            const senderBalance = parseFloat(senderWallet.balance);
            const recipientBalance = parseFloat(recipientWallet.balance);

            // Check sufficient balance
            if (senderBalance < amount) {
                throw new Error('Insufficient balance');
            }

            const newSenderBalance = senderBalance - amount;
            const newRecipientBalance = recipientBalance + amount;

            // Update sender wallet
            await connection.query(
                'UPDATE wallets SET balance = ? WHERE user_id = ?',
                [newSenderBalance, userId]
            );

            // Update recipient wallet
            await connection.query(
                'UPDATE wallets SET balance = ? WHERE user_id = ?',
                [newRecipientBalance, recipientId]
            );

            // Create debit transaction
            await connection.query(
                `INSERT INTO transactions 
                (transaction_id, idempotency_key, user_id, type, amount, balance_before, balance_after, 
                 status, counterparty_user_id, counterparty_transaction_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    debitTransactionId,
                    idempotencyKey,
                    userId,
                    TRANSACTION_TYPES.TRANSFER_DEBIT,
                    amount,
                    senderBalance,
                    newSenderBalance,
                    TRANSACTION_STATUS.SUCCESS,
                    recipientId,
                    creditTransactionId
                ]
            );

            // Create credit transaction
            await connection.query(
                `INSERT INTO transactions 
                (transaction_id, user_id, type, amount, balance_before, balance_after, 
                 status, counterparty_user_id, counterparty_transaction_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    creditTransactionId,
                    recipientId,
                    TRANSACTION_TYPES.TRANSFER_CREDIT,
                    amount,
                    recipientBalance,
                    newRecipientBalance,
                    TRANSACTION_STATUS.SUCCESS,
                    userId,
                    debitTransactionId
                ]
            );

            // Mark OTP as used
            await connection.query(
                'UPDATE otps SET is_used = TRUE WHERE id = ?',
                [otps[0].id]
            );

            // Update daily limit
            await this.updateDailyLimit(connection, userId, 'total_transferred', amount);

            await connection.commit();

            return {
                success: true,
                message: 'Transfer successful',
                transaction: {
                    id: debitTransactionId,
                    amount,
                    balance: newSenderBalance,
                    recipient: toEmail,
                    status: TRANSACTION_STATUS.SUCCESS
                }
            };

        } catch (error) {
            await connection.rollback();
            logger.error('Transfer failed:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get transaction history
     */
    async getTransactionHistory(userId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const [transactions] = await db.query(
            `SELECT 
                t.transaction_id,
                t.type,
                t.amount,
                t.balance_after,
                t.status,
                t.payment_method,
                t.failure_reason,
                t.created_at,
                u.email as counterparty_email,
                u.name as counterparty_name
             FROM transactions t
             LEFT JOIN users u ON t.counterparty_user_id = u.id
             WHERE t.user_id = ?
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );

        const [countResult] = await db.query(
            'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?',
            [userId]
        );

        return {
            transactions,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    }

    /**
     * Validate transaction amount
     */
    validateAmount(amount) {
        if (amount < MIN_TRANSACTION_AMOUNT) {
            throw new Error(`Minimum transaction amount is ₹${MIN_TRANSACTION_AMOUNT}`);
        }
        if (amount > MAX_TRANSACTION_AMOUNT) {
            throw new Error(`Maximum transaction amount is ₹${MAX_TRANSACTION_AMOUNT}`);
        }
        
        // Check decimal places
        if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
            throw new Error('Amount can have maximum 2 decimal places');
        }
    }

    /**
     * Check idempotency key
     */
    async checkIdempotency(idempotencyKey) {
        if (!idempotencyKey) return null;

        const [transactions] = await db.query(
            `SELECT transaction_id, status, amount, balance_after, payment_method, failure_reason
             FROM transactions WHERE idempotency_key = ?`,
            [idempotencyKey]
        );

        if (transactions.length > 0) {
            const txn = transactions[0];
            return {
                success: txn.status === TRANSACTION_STATUS.SUCCESS,
                message: 'Duplicate request - returning cached response',
                transaction: txn,
                isDuplicate: true
            };
        }

        return null;
    }

    /**
     * Check daily add money limit
     */
    async checkDailyAddMoneyLimit(userId, amount) {
        const today = new Date().toISOString().split('T')[0];
        
        const [limits] = await db.query(
            'SELECT total_added FROM daily_limits WHERE user_id = ? AND date = ?',
            [userId, today]
        );

        const totalAdded = limits.length > 0 ? parseFloat(limits[0].total_added) : 0;
        
        if (totalAdded + amount > DAILY_ADD_MONEY_LIMIT) {
            throw new Error(`Daily add money limit of ₹${DAILY_ADD_MONEY_LIMIT} exceeded`);
        }
    }

    /**
     * Check daily transfer limit
     */
    async checkDailyTransferLimit(userId, amount) {
        const today = new Date().toISOString().split('T')[0];
        
        const [limits] = await db.query(
            'SELECT total_transferred FROM daily_limits WHERE user_id = ? AND date = ?',
            [userId, today]
        );

        const totalTransferred = limits.length > 0 ? parseFloat(limits[0].total_transferred) : 0;
        
        if (totalTransferred + amount > DAILY_TRANSFER_LIMIT) {
            throw new Error(`Daily transfer limit of ₹${DAILY_TRANSFER_LIMIT} exceeded`);
        }
    }

    /**
     * Update daily limit
     */
    async updateDailyLimit(connection, userId, column, amount) {
        const today = new Date().toISOString().split('T')[0];
        
        await connection.query(
            `INSERT INTO daily_limits (user_id, date, ${column})
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE ${column} = ${column} + ?`,
            [userId, today, amount, amount]
        );
    }
}

module.exports = new WalletService();
