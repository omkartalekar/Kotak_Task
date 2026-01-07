const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');

const router = express.Router();

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
], validate, async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const result = await authService.register(name, email, password);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required')
], validate, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
