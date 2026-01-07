const crypto = require('crypto');

/**
 * Hash password using SHA-256
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
function hashPassword(password) {
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}

/**
 * Verify password
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {boolean}
 */
function verifyPassword(password, hash) {
    const passwordHash = hashPassword(password);
    return passwordHash === hash;
}

/**
 * Generate OTP
 * @param {number} length - OTP length
 * @returns {string}
 */
function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateOTP
};
