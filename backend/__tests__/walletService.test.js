const walletService = require('../src/services/walletService');
const db = require('../src/config/database');
const { hashPassword } = require('../src/utils/crypto');
const { v4: uuidv4 } = require('uuid');

describe('WalletService - Transaction Logic', () => {
    let testUserId1, testUserId2;
    
    beforeAll(async () => {
        // Create test users
        const password = hashPassword('testpass123');
        
        const [user1] = await db.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            ['Test User 1', 'test1@example.com', password]
        );
        testUserId1 = user1.insertId;
        
        const [user2] = await db.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            ['Test User 2', 'test2@example.com', password]
        );
        testUserId2 = user2.insertId;
        
        // Create wallets
        await db.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [testUserId1, 1000.00]);
        await db.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [testUserId2, 500.00]);
    });

    afterAll(async () => {
        // Cleanup
        await db.query('DELETE FROM transactions WHERE user_id IN (?, ?)', [testUserId1, testUserId2]);
        await db.query('DELETE FROM daily_limits WHERE user_id IN (?, ?)', [testUserId1, testUserId2]);
        await db.query('DELETE FROM wallets WHERE user_id IN (?, ?)', [testUserId1, testUserId2]);
        await db.query('DELETE FROM users WHERE id IN (?, ?)', [testUserId1, testUserId2]);
        await db.end();
    });

    describe('Add Money', () => {
        test('should validate minimum amount', async () => {
            await expect(
                walletService.addMoney(testUserId1, 50, 'UPI', uuidv4())
            ).rejects.toThrow('Minimum transaction amount');
        });

        test('should validate maximum amount', async () => {
            await expect(
                walletService.addMoney(testUserId1, 300000, 'UPI', uuidv4())
            ).rejects.toThrow('Maximum transaction amount');
        });

        test('should validate decimal precision', async () => {
            await expect(
                walletService.addMoney(testUserId1, 100.123, 'UPI', uuidv4())
            ).rejects.toThrow('maximum 2 decimal places');
        });

        test('should handle idempotent requests', async () => {
            const idempotencyKey = uuidv4();
            
            // First request
            const result1 = await walletService.addMoney(testUserId1, 500, 'UPI', idempotencyKey);
            
            // Second request with same key should return cached response
            const result2 = await walletService.addMoney(testUserId1, 500, 'UPI', idempotencyKey);
            
            expect(result2.isDuplicate).toBe(true);
            expect(result2.transaction.transaction_id).toBe(result1.transaction.id);
        });
    });

    describe('Transfer Money', () => {
        test('should prevent negative balance', async () => {
            const otp = '123456';
            const referenceId = uuidv4();
            
            // Add OTP for test
            await db.query(
                'INSERT INTO otps (user_id, otp_code, purpose, reference_id, expires_at) VALUES (?, ?, ?, ?, ?)',
                [testUserId2, otp, 'TRANSFER', referenceId, new Date(Date.now() + 300000)]
            );
            
            await expect(
                walletService.transfer(testUserId2, 'test1@example.com', 1000, otp, referenceId, uuidv4())
            ).rejects.toThrow('Insufficient balance');
        });

        test('should prevent self-transfer', async () => {
            await expect(
                walletService.generateTransferOTP(testUserId1, 'test1@example.com', 100)
            ).rejects.toThrow('Cannot transfer to yourself');
        });

        test('should validate recipient exists', async () => {
            await expect(
                walletService.generateTransferOTP(testUserId1, 'nonexistent@example.com', 100)
            ).rejects.toThrow('Recipient not found');
        });

        test('should require valid OTP', async () => {
            const referenceId = uuidv4();
            
            await expect(
                walletService.transfer(testUserId1, 'test2@example.com', 100, '999999', referenceId, uuidv4())
            ).rejects.toThrow('Invalid or expired OTP');
        });
    });

    describe('Transaction History', () => {
        test('should return paginated results', async () => {
            const result = await walletService.getTransactionHistory(testUserId1, 1, 10);
            
            expect(result).toHaveProperty('transactions');
            expect(result).toHaveProperty('pagination');
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(10);
        });
    });

    describe('Balance Operations', () => {
        test('should get current balance', async () => {
            const balance = await walletService.getBalance(testUserId1);
            
            expect(balance).toHaveProperty('balance');
            expect(balance).toHaveProperty('currency');
            expect(balance.currency).toBe('INR');
        });

        test('should throw error for non-existent wallet', async () => {
            await expect(
                walletService.getBalance(999999)
            ).rejects.toThrow('Wallet not found');
        });
    });
});
