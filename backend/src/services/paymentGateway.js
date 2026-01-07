const { PAYMENT_METHODS } = require('../config/constants');

/**
 * Mock Payment Gateway
 * Simulates UPI, Card, and Net Banking payments with success/failure scenarios
 */
class PaymentGateway {
    /**
     * Process payment
     * @param {string} method - Payment method (UPI, CARD, NET_BANKING)
     * @param {number} amount - Amount to process
     * @returns {Promise<{success: boolean, transactionId?: string, message: string}>}
     */
    async processPayment(method, amount) {
        // Simulate network delay
        await this.delay(1000 + Math.random() * 2000);

        // Random failure simulation (20% failure rate)
        const failureRate = parseFloat(process.env.PAYMENT_GATEWAY_FAILURE_RATE) || 0.2;
        const shouldFail = Math.random() < failureRate;

        if (shouldFail) {
            return this.simulateFailure(method);
        }

        // Generate mock transaction ID
        const transactionId = this.generateTransactionId(method);

        return {
            success: true,
            transactionId,
            message: `Payment successful via ${method}`,
            gatewayResponse: {
                method,
                amount,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Simulate payment failure with realistic error messages
     */
    simulateFailure(method) {
        const failures = {
            UPI: [
                'UPI transaction failed - Insufficient balance in bank account',
                'UPI transaction declined by bank',
                'UPI PIN incorrect',
                'Transaction timeout - Please try again',
                'UPI app not responding'
            ],
            CARD: [
                'Card declined - Insufficient funds',
                'Invalid CVV',
                'Card expired',
                'Transaction declined by bank',
                '3D Secure authentication failed',
                'Card blocked - Contact your bank'
            ],
            NET_BANKING: [
                'Net banking session timeout',
                'Invalid credentials',
                'Bank server not responding',
                'Transaction declined by bank',
                'Daily transaction limit exceeded'
            ]
        };

        const methodFailures = failures[method] || ['Transaction failed'];
        const randomFailure = methodFailures[Math.floor(Math.random() * methodFailures.length)];

        return {
            success: false,
            message: randomFailure,
            errorCode: `PG_${method}_${Math.floor(Math.random() * 1000)}`
        };
    }

    /**
     * Generate mock transaction ID
     */
    generateTransactionId(method) {
        const prefix = {
            UPI: 'UPI',
            CARD: 'CRD',
            NET_BANKING: 'NBK'
        };

        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 100000);
        
        return `${prefix[method]}${timestamp}${random}`;
    }

    /**
     * Simulate network delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate payment method
     */
    isValidPaymentMethod(method) {
        return Object.values(PAYMENT_METHODS).includes(method);
    }
}

module.exports = new PaymentGateway();
