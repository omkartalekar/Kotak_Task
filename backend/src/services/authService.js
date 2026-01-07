const db = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');

class AuthService {
    /**
     * Register new user
     */
    async register(name, email, password) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Check if email already exists
            const [existingUsers] = await connection.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUsers.length > 0) {
                throw new Error('Email already registered');
            }

            // Hash password using SHA-256
            const passwordHash = hashPassword(password);

            // Insert user
            const [result] = await connection.query(
                'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                [name, email, passwordHash]
            );

            const userId = result.insertId;

            // Create wallet for user
            await connection.query(
                'INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)',
                [userId]
            );

            await connection.commit();

            // Generate JWT token
            const token = jwt.sign(
                { userId, email, name },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return {
                success: true,
                user: { id: userId, name, email },
                token
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Login user
     */
    async login(email, password) {
        const [users] = await db.query(
            'SELECT id, name, email, password_hash FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        if (users.length === 0) {
            throw new Error('Invalid email or password');
        }

        const user = users[0];

        // Verify password
        const isValidPassword = verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
            throw new Error('Invalid email or password');
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return {
            success: true,
            user: { id: user.id, name: user.name, email: user.email },
            token
        };
    }

    /**
     * Get user profile with wallet balance
     */
    async getProfile(userId) {
        const [users] = await db.query(
            `SELECT u.id, u.name, u.email, u.created_at, w.balance, w.currency
             FROM users u
             LEFT JOIN wallets w ON u.id = w.user_id
             WHERE u.id = ? AND u.is_active = TRUE`,
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        return users[0];
    }
}

module.exports = new AuthService();
