const express = require('express');
const { body, query, validationResult } = require('express-validator');
const walletService = require('../services/walletService');
const authenticate = require('../middleware/auth');
const { PAYMENT_METHODS } = require('../config/constants');

const router = express.Router();

// Apply authentication to all wallet routes
router.use(authenticate);

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
 * GET /api/wallet/balance
 * Get wallet balance
 */
router.get('/balance', async (req, res, next) => {
    try {
        const balance = await walletService.getBalance(req.user.userId);
        res.json({
            success: true,
            balance
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/wallet/add-money
 * Add money to wallet
 */
router.post('/add-money', [
    body('amount')
        .isFloat({ min: 100, max: 200000 })
        .withMessage('Amount must be between ₹100 and ₹200,000'),
    body('paymentMethod')
        .isIn(Object.values(PAYMENT_METHODS))
        .withMessage('Invalid payment method'),
    body('idempotencyKey')
        .optional()
        .isUUID()
        .withMessage('Invalid idempotency key')
], validate, async (req, res, next) => {
    try {
        const { amount, paymentMethod, idempotencyKey } = req.body;
        const result = await walletService.addMoney(
            req.user.userId,
            parseFloat(amount),
            paymentMethod,
            idempotencyKey
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/wallet/transfer/generate-otp
 * Generate OTP for transfer
 */
router.post('/transfer/generate-otp', [
    body('toEmail').isEmail().withMessage('Invalid recipient email'),
    body('amount')
        .isFloat({ min: 100, max: 200000 })
        .withMessage('Amount must be between ₹100 and ₹200,000')
], validate, async (req, res, next) => {
    try {
        const { toEmail, amount } = req.body;
        const result = await walletService.generateTransferOTP(
            req.user.userId,
            toEmail,
            parseFloat(amount)
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/wallet/transfer
 * Transfer money to another user
 */
router.post('/transfer', [
    body('toEmail').isEmail().withMessage('Invalid recipient email'),
    body('amount')
        .isFloat({ min: 100, max: 200000 })
        .withMessage('Amount must be between ₹100 and ₹200,000'),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .withMessage('OTP must be 6 digits'),
    body('referenceId')
        .isUUID()
        .withMessage('Invalid reference ID'),
    body('idempotencyKey')
        .optional()
        .isUUID()
        .withMessage('Invalid idempotency key')
], validate, async (req, res, next) => {
    try {
        const { toEmail, amount, otp, referenceId, idempotencyKey } = req.body;
        const result = await walletService.transfer(
            req.user.userId,
            toEmail,
            parseFloat(amount),
            otp,
            referenceId,
            idempotencyKey
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/wallet/transactions
 * Get transaction history
 */
router.get('/transactions', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        const result = await walletService.getTransactionHistory(req.user.userId, page, limit);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
