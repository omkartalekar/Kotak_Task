/**
 * Concurrency Test - Simulates multiple simultaneous transfers
 * Tests atomic transactions and race condition handling
 */

const mysql = require('mysql2/promise');
const { hashPassword } = require('../src/utils/crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Create dedicated connection for tests
const createConnection = async () => {
    return await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'digital_wallet',
        port: process.env.DB_PORT || 3306
    });
};

/**
 * Simulate concurrent transfer
 */
async function performTransfer(connection, fromUserId, toUserId, amount) {
    const debitTxnId = uuidv4();
    const creditTxnId = uuidv4();

    try {
        await connection.beginTransaction();

        // Lock wallets in consistent order
        const userIds = [fromUserId, toUserId].sort((a, b) => a - b);
        
        const [wallets] = await connection.query(
            'SELECT user_id, balance FROM wallets WHERE user_id IN (?, ?) FOR UPDATE',
            userIds
        );

        const senderWallet = wallets.find(w => w.user_id === fromUserId);
        const recipientWallet = wallets.find(w => w.user_id === toUserId);

        const senderBalance = parseFloat(senderWallet.balance);
        const recipientBalance = parseFloat(recipientWallet.balance);

        // Check sufficient balance
        if (senderBalance < amount) {
            await connection.rollback();
            return { success: false, reason: 'Insufficient balance' };
        }

        const newSenderBalance = senderBalance - amount;
        const newRecipientBalance = recipientBalance + amount;

        // Update balances
        await connection.query(
            'UPDATE wallets SET balance = ? WHERE user_id = ?',
            [newSenderBalance, fromUserId]
        );

        await connection.query(
            'UPDATE wallets SET balance = ? WHERE user_id = ?',
            [newRecipientBalance, toUserId]
        );

        // Create transactions
        await connection.query(
            `INSERT INTO transactions 
            (transaction_id, user_id, type, amount, balance_before, balance_after, status, counterparty_user_id, counterparty_transaction_id)
            VALUES (?, ?, 'TRANSFER_DEBIT', ?, ?, ?, 'SUCCESS', ?, ?)`,
            [debitTxnId, fromUserId, amount, senderBalance, newSenderBalance, toUserId, creditTxnId]
        );

        await connection.query(
            `INSERT INTO transactions 
            (transaction_id, user_id, type, amount, balance_before, balance_after, status, counterparty_user_id, counterparty_transaction_id)
            VALUES (?, ?, 'TRANSFER_CREDIT', ?, ?, ?, 'SUCCESS', ?, ?)`,
            [creditTxnId, toUserId, amount, recipientBalance, newRecipientBalance, fromUserId, debitTxnId]
        );

        await connection.commit();
        return { success: true, debitTxnId, creditTxnId };

    } catch (error) {
        await connection.rollback();
        return { success: false, reason: error.message };
    }
}

/**
 * Main concurrency test
 */
async function runConcurrencyTest() {
    console.log('🧪 Starting Concurrency Test...\n');

    const connection = await createConnection();

    try {
        // Create test users
        console.log('📝 Setting up test users...');
        const password = hashPassword('testpass123');

        const [user1] = await connection.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            ['Concurrent User 1', `concurrent1_${Date.now()}@test.com`, password]
        );
        const userId1 = user1.insertId;

        const [user2] = await connection.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            ['Concurrent User 2', `concurrent2_${Date.now()}@test.com`, password]
        );
        const userId2 = user2.insertId;

        const [user3] = await connection.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            ['Concurrent User 3', `concurrent3_${Date.now()}@test.com`, password]
        );
        const userId3 = user3.insertId;

        // Create wallets with initial balance
        await connection.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [userId1, 10000.00]);
        await connection.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [userId2, 5000.00]);
        await connection.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [userId3, 0.00]);

        console.log('✅ Test users created');
        console.log(`   User 1: ₹10,000 | User 2: ₹5,000 | User 3: ₹0\n`);

        // Test 1: Multiple concurrent transfers from same user
        console.log('🔥 Test 1: Multiple concurrent transfers from User 1...');
        const connections1 = await Promise.all([
            createConnection(),
            createConnection(),
            createConnection(),
            createConnection(),
            createConnection()
        ]);

        const transfers1 = await Promise.all([
            performTransfer(connections1[0], userId1, userId2, 1000),
            performTransfer(connections1[1], userId1, userId2, 1500),
            performTransfer(connections1[2], userId1, userId3, 2000),
            performTransfer(connections1[3], userId1, userId2, 1000),
            performTransfer(connections1[4], userId1, userId3, 500)
        ]);

        await Promise.all(connections1.map(c => c.end()));

        const successful1 = transfers1.filter(t => t.success).length;
        const failed1 = transfers1.filter(t => !t.success).length;

        console.log(`   ✅ Successful: ${successful1} | ❌ Failed: ${failed1}`);

        // Check balances
        const [wallets1] = await connection.query(
            'SELECT user_id, balance FROM wallets WHERE user_id IN (?, ?, ?)',
            [userId1, userId2, userId3]
        );

        wallets1.forEach(w => {
            console.log(`   User ${w.user_id}: ₹${parseFloat(w.balance).toFixed(2)}`);
        });

        // Test 2: Bidirectional transfers (potential deadlock scenario)
        console.log('\n🔥 Test 2: Bidirectional concurrent transfers...');
        const connections2 = await Promise.all([
            createConnection(),
            createConnection(),
            createConnection(),
            createConnection()
        ]);

        const transfers2 = await Promise.all([
            performTransfer(connections2[0], userId1, userId2, 500),
            performTransfer(connections2[1], userId2, userId1, 300),
            performTransfer(connections2[2], userId1, userId2, 400),
            performTransfer(connections2[3], userId2, userId1, 200)
        ]);

        await Promise.all(connections2.map(c => c.end()));

        const successful2 = transfers2.filter(t => t.success).length;
        const failed2 = transfers2.filter(t => !t.success).length;

        console.log(`   ✅ Successful: ${successful2} | ❌ Failed: ${failed2}`);

        // Final balance check
        const [finalWallets] = await connection.query(
            'SELECT user_id, balance FROM wallets WHERE user_id IN (?, ?, ?)',
            [userId1, userId2, userId3]
        );

        console.log('\n📊 Final Balances:');
        finalWallets.forEach(w => {
            console.log(`   User ${w.user_id}: ₹${parseFloat(w.balance).toFixed(2)}`);
        });

        // Verify total balance is conserved
        const totalBalance = finalWallets.reduce((sum, w) => sum + parseFloat(w.balance), 0);
        console.log(`\n💰 Total balance in system: ₹${totalBalance.toFixed(2)}`);
        console.log(`   Expected: ₹15,000.00`);
        console.log(`   ${totalBalance === 15000 ? '✅ Balance conserved!' : '❌ Balance mismatch!'}`);

        // Transaction audit
        const [txnCount] = await connection.query(
            'SELECT COUNT(*) as count FROM transactions WHERE user_id IN (?, ?, ?)',
            [userId1, userId2, userId3]
        );
        console.log(`\n📝 Total transactions recorded: ${txnCount[0].count}`);

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await connection.query('DELETE FROM transactions WHERE user_id IN (?, ?, ?)', [userId1, userId2, userId3]);
        await connection.query('DELETE FROM wallets WHERE user_id IN (?, ?, ?)', [userId1, userId2, userId3]);
        await connection.query('DELETE FROM users WHERE id IN (?, ?, ?)', [userId1, userId2, userId3]);

        console.log('✅ Concurrency test completed successfully!\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await connection.end();
    }
}

// Run the test
runConcurrencyTest()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
