require('dotenv').config();

module.exports = {
    // Transaction limits
    MIN_TRANSACTION_AMOUNT: parseFloat(process.env.MIN_TRANSACTION_AMOUNT) || 100,
    MAX_TRANSACTION_AMOUNT: parseFloat(process.env.MAX_TRANSACTION_AMOUNT) || 200000,
    DAILY_TRANSFER_LIMIT: parseFloat(process.env.DAILY_TRANSFER_LIMIT) || 500000,
    DAILY_ADD_MONEY_LIMIT: parseFloat(process.env.DAILY_ADD_MONEY_LIMIT) || 500000,

    // Transaction types
    TRANSACTION_TYPES: {
        ADD_MONEY: 'ADD_MONEY',
        TRANSFER_DEBIT: 'TRANSFER_DEBIT',
        TRANSFER_CREDIT: 'TRANSFER_CREDIT'
    },

    // Transaction statuses
    TRANSACTION_STATUS: {
        PENDING: 'PENDING',
        SUCCESS: 'SUCCESS',
        FAILED: 'FAILED'
    },

    // Payment methods
    PAYMENT_METHODS: {
        UPI: 'UPI',
        CARD: 'CARD',
        NET_BANKING: 'NET_BANKING'
    },

    // OTP
    OTP_VALIDITY_MINUTES: 5,
    OTP_LENGTH: 6,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'default_secret_change_in_production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h'
};
