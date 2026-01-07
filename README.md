# Digital Wallet System 💰

A production-grade digital wallet application with secure peer-to-peer transfers, mock payment gateway integration, and comprehensive transaction management.

## 🎯 Overview

This project demonstrates enterprise-level software engineering practices including:
- **Atomic Transactions** - ACID-compliant database operations
- **Idempotent APIs** - Safe retry mechanism for network failures
- **Concurrency Handling** - Race condition prevention with database locks
- **Audit Trail** - Complete transaction history with balance tracking
- **Security** - SHA-256 password hashing, JWT authentication
- **Mock Payment Gateway** - Realistic UPI/Card/NetBanking simulation

## 🏗️ Architecture

### High-Level Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   React     │─────▶│   Node.js    │─────▶│    MySQL     │
│  Frontend   │      │   Backend    │      │   Database   │
│  (Port 3000)│      │  (Port 5000) │      │  (Port 3306) │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Mock Payment │
                    │   Gateway    │
                    └──────────────┘
```

### Tech Stack
- **Frontend**: React 18, React Router, Axios, Vite
- **Backend**: Node.js, Express, MySQL2, JWT, Winston
- **Database**: MySQL with InnoDB engine
- **Testing**: Jest, Supertest

## 📋 Features

### ✅ Implemented Requirements

#### Functional Features
- ✅ User registration and authentication (JWT)
- ✅ Wallet creation with initial ₹0 balance
- ✅ Add money via mock payment gateway (UPI/Card/NetBanking)
- ✅ Peer-to-peer money transfers with OTP verification
- ✅ Transaction history with pagination
- ✅ Real-time balance updates

#### System Constraints
- ✅ **Atomic Balance Updates** - Using MySQL transactions with row-level locking
- ✅ **No Negative Balances** - Database constraints + validation
- ✅ **Idempotent APIs** - Idempotency keys for add money and transfers
- ✅ **Audit Trail** - Every transaction logged with before/after balances

#### Edge Cases Handled
- ✅ **Concurrent Transfers** - Row locking with consistent ordering to prevent deadlocks
- ✅ **Retry of Failed Requests** - Idempotency key checking
- ✅ **Partial Database Failures** - Proper rollback mechanisms
- ✅ **Precision Issues** - DECIMAL(15,2) for monetary values

### 🔐 Security Features
- SHA-256 password hashing
- JWT token-based authentication
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS protection
- CORS configuration

### 💳 Transaction Limits
- Single transaction: ₹100 - ₹200,000
- Daily add money limit: ₹500,000
- Daily transfer limit: ₹500,000

## 🗄️ Database Schema

### Users Table
```sql
- id (INT, Primary Key)
- name (VARCHAR)
- email (VARCHAR, Unique)
- password_hash (VARCHAR)
- is_active (BOOLEAN)
- created_at, updated_at
```

### Wallets Table
```sql
- id (INT, Primary Key)
- user_id (INT, Unique, Foreign Key)
- balance (DECIMAL(15,2))
- currency (VARCHAR)
- CHECK constraint: balance >= 0
```

### Transactions Table
```sql
- id (INT, Primary Key)
- transaction_id (UUID, Unique)
- idempotency_key (UUID, Unique)
- user_id (INT, Foreign Key)
- type (ENUM: ADD_MONEY, TRANSFER_DEBIT, TRANSFER_CREDIT)
- amount (DECIMAL(15,2))
- balance_before (DECIMAL(15,2))
- balance_after (DECIMAL(15,2))
- status (ENUM: PENDING, SUCCESS, FAILED)
- payment_method (ENUM: UPI, CARD, NET_BANKING)
- counterparty_user_id (INT, nullable)
- metadata (JSON)
- failure_reason (VARCHAR)
- created_at, updated_at
```

### Daily Limits Table
```sql
- user_id + date (Unique composite key)
- total_added (DECIMAL)
- total_transferred (DECIMAL)
```

### OTPs Table
```sql
- user_id, otp_code, purpose
- reference_id, expires_at
- is_used (BOOLEAN)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- MySQL 8.0+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup database
npm run db:setup

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## 🧪 Testing

### Unit Tests
```bash
cd backend
npm test
```

### Concurrency Tests
```bash
cd backend
npm run test:concurrency
```

This test simulates:
- Multiple simultaneous transfers from same user
- Bidirectional transfers (potential deadlock scenarios)
- Balance conservation verification

## 📡 API Documentation

### Authentication

#### POST /api/auth/register
Register new user
```json
Request:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "user": { "id": 1, "name": "John Doe", "email": "john@example.com" },
  "token": "jwt_token_here"
}
```

#### POST /api/auth/login
```json
Request:
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Wallet Operations

#### GET /api/wallet/balance
Get current balance (requires authentication)

#### POST /api/wallet/add-money
```json
Request:
{
  "amount": 1000,
  "paymentMethod": "UPI",
  "idempotencyKey": "uuid-here" // Optional
}

Response:
{
  "success": true,
  "message": "Payment successful via UPI",
  "transaction": {
    "id": "txn-uuid",
    "amount": 1000,
    "balance": 1000,
    "status": "SUCCESS"
  }
}
```

#### POST /api/wallet/transfer/generate-otp
```json
Request:
{
  "toEmail": "recipient@example.com",
  "amount": 500
}

Response:
{
  "success": true,
  "message": "OTP sent successfully",
  "referenceId": "ref-uuid",
  "recipient": { "name": "Jane Doe", "email": "recipient@example.com" },
  "otp": "123456" // Only in development mode
}
```

#### POST /api/wallet/transfer
```json
Request:
{
  "toEmail": "recipient@example.com",
  "amount": 500,
  "otp": "123456",
  "referenceId": "ref-uuid",
  "idempotencyKey": "uuid-here" // Optional
}
```

#### GET /api/wallet/transactions?page=1&limit=20
Get transaction history with pagination

## 🔧 Key Implementation Details

### Atomic Transactions
```javascript
// Using MySQL transactions with row-level locking
await connection.beginTransaction();

// Lock wallets in consistent order to prevent deadlock
const userIds = [senderId, recipientId].sort();
await connection.query(
  'SELECT * FROM wallets WHERE user_id IN (?, ?) FOR UPDATE',
  userIds
);

// Perform updates
// ...

await connection.commit();
```

### Idempotency
```javascript
// Check if request was already processed
const existing = await db.query(
  'SELECT * FROM transactions WHERE idempotency_key = ?',
  [idempotencyKey]
);

if (existing.length > 0) {
  return existing[0]; // Return cached response
}
```

### Concurrency Handling
- Row-level locks (`FOR UPDATE`)
- Consistent lock ordering (sort user IDs)
- Proper transaction isolation
- Deadlock prevention

### Mock Payment Gateway
Simulates real-world payment scenarios:
- Random success/failure (20% failure rate)
- Network delays (1-3 seconds)
- Realistic error messages per payment method

## 📊 Design Decisions

### Why MySQL over MongoDB?
- ACID guarantees crucial for financial transactions
- Strong consistency requirements
- Complex relational queries (transactions with users)

### Why Row-Level Locking?
- Prevents race conditions in concurrent transfers
- Better performance than table locks
- Consistent lock ordering prevents deadlocks

### Why Idempotency Keys?
- Safe retry mechanism for network failures
- Prevents duplicate charges
- Industry standard for payment APIs

### Why Separate Debit/Credit Transactions?
- Clear audit trail for both parties
- Easier reconciliation
- Better transaction history

## 🎨 Frontend Features

- Responsive design with plain CSS
- Real-time balance updates
- Tabbed interface for better UX
- Email verification before transfer
- OTP-based transfer confirmation
- Transaction status indicators
- Pagination for transaction history

## 🐛 Known Limitations

1. Mock payment gateway (not real integration)
2. Mock OTP generation (not real SMS)
3. Single currency support (INR only)
4. No password recovery mechanism
5. No email notifications

## 🔮 Future Enhancements

- [ ] Real payment gateway integration
- [ ] SMS OTP integration
- [ ] Email notifications
- [ ] Multi-currency support
- [ ] Refund functionality
- [ ] Scheduled transfers
- [ ] Transaction receipts (PDF)
- [ ] Two-factor authentication
- [ ] Admin dashboard
- [ ] Analytics and reporting

## 📝 Testing Checklist

- [x] Unit tests for transaction logic
- [x] Concurrent transfer scenarios
- [x] Idempotency verification
- [x] Negative balance prevention
- [x] Daily limit enforcement
- [x] OTP expiry handling
- [x] Payment failure scenarios

## 👨‍💻 Development Notes

### Code Quality
- ESLint configuration
- Consistent error handling
- Comprehensive logging (Winston)
- Input validation (express-validator)
- Proper HTTP status codes

### Production Readiness
- Environment-based configuration
- Database connection pooling
- Transaction rollback on errors
- Comprehensive error messages
- API versioning ready

## 📄 License

This is a case study project for interview purposes.

## 🙏 Acknowledgments

Built with production-level thinking and best practices for financial applications.
