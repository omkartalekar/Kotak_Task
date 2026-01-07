const authService = require('../src/services/authService');
const db = require('../src/config/database');
const { hashPassword } = require('../src/utils/crypto');

describe('AuthService', () => {
    const testEmail = `test_${Date.now()}@example.com`;
    let testUserId;

    afterAll(async () => {
        // Cleanup
        if (testUserId) {
            await db.query('DELETE FROM wallets WHERE user_id = ?', [testUserId]);
            await db.query('DELETE FROM users WHERE id = ?', [testUserId]);
        }
        await db.end();
    });

    describe('Register', () => {
        test('should register new user successfully', async () => {
            const result = await authService.register('Test User', testEmail, 'password123');
            
            expect(result.success).toBe(true);
            expect(result.user.email).toBe(testEmail);
            expect(result.token).toBeDefined();
            
            testUserId = result.user.id;
        });

        test('should prevent duplicate email registration', async () => {
            await expect(
                authService.register('Another User', testEmail, 'password123')
            ).rejects.toThrow('Email already registered');
        });
    });

    describe('Login', () => {
        test('should login with correct credentials', async () => {
            const result = await authService.login(testEmail, 'password123');
            
            expect(result.success).toBe(true);
            expect(result.user.email).toBe(testEmail);
            expect(result.token).toBeDefined();
        });

        test('should reject incorrect password', async () => {
            await expect(
                authService.login(testEmail, 'wrongpassword')
            ).rejects.toThrow('Invalid email or password');
        });

        test('should reject non-existent email', async () => {
            await expect(
                authService.login('nonexistent@example.com', 'password123')
            ).rejects.toThrow('Invalid email or password');
        });
    });

    describe('Profile', () => {
        test('should get user profile with wallet', async () => {
            const profile = await authService.getProfile(testUserId);
            
            expect(profile.id).toBe(testUserId);
            expect(profile.email).toBe(testEmail);
            expect(profile.balance).toBeDefined();
        });

        test('should throw error for invalid user', async () => {
            await expect(
                authService.getProfile(999999)
            ).rejects.toThrow('User not found');
        });
    });
});
