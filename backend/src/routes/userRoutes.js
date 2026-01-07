const express = require('express');
const authService = require('../services/authService');
const authenticate = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/user/profile
 * Get user profile with wallet balance
 */
router.get('/profile', authenticate, async (req, res, next) => {
    try {
        const profile = await authService.getProfile(req.user.userId);
        res.json({
            success: true,
            user: profile
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/user/search
 * Search users by email (for transfer recipient lookup)
 */
router.get('/search', authenticate, async (req, res, next) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email parameter is required'
            });
        }

        const db = require('../config/database');
        const [users] = await db.query(
            'SELECT id, name, email FROM users WHERE email = ? AND is_active = TRUE AND id != ?',
            [email, req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
