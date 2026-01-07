# System Design Document

## Digital Wallet System Architecture

### 1. System Overview

The Digital Wallet System is a three-tier application designed to handle secure financial transactions with enterprise-grade reliability and performance.

```
┌────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   React SPA (Port 3000)                              │  │
│  │   - Authentication UI                                │  │
│  │   - Wallet Dashboard                                 │  │
│  │   - Transaction Management                           │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬────────────────────────────────────┘
                        │ HTTPS/REST API
┌───────────────────────▼────────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   Node.js + Express (Port 5000)                      │  │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │   │   Auth     │  │  Wallet    │  │  Payment   │    │  │
│  │   │  Service   │  │  Service   │  │  Gateway   │    │  │
│  │   └────────────┘  └────────────┘  └────────────┘    │  │
│  │   ┌────────────────────────────────────────────┐    │  │
│  │   │     Middleware Layer                       │    │  │
│  │   │  - JWT Authentication                      │    │  │
│  │   │  - Input Validation                        │    │  │
│  │   │  - Error Handling                          │    │  │
│  │   │  - Logging                                 │    │  │
│  │   └────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬────────────────────────────────────┘
                        │ MySQL Protocol
┌───────────────────────▼────────────────────────────────────┐
│                      Data Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   MySQL Database (Port 3306)                         │  │
│  │   - Users & Wallets                                  │  │
│  │   - Transactions (Audit Log)                         │  │
│  │   - Daily Limits                                     │  │
│  │   - OTP Management                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 2. Component Architecture

#### 2.1 Frontend (React)
```
src/
├── components/
│   ├── AddMoneyForm.jsx          # Mock payment integration
│   ├── TransferMoneyForm.jsx     # P2P transfer with OTP
│   └── TransactionHistory.jsx    # Paginated transaction list
├── pages/
│   ├── Login.jsx                 # Authentication
│   ├── Register.jsx              # User onboarding
│   └── Dashboard.jsx             # Main wallet interface
├── services/
│   └── api.js                    # Axios client with interceptors
└── context/
    └── AuthContext.jsx           # Global auth state management
```

#### 2.2 Backend (Node.js)
```
src/
├── config/
│   ├── database.js               # MySQL connection pool
│   └── constants.js              # App configuration
├── middleware/
│   ├── auth.js                   # JWT verification
│   └── errorHandler.js           # Centralized error handling
├── services/
│   ├── authService.js            # User management
│   ├── walletService.js          # Core wallet operations
│   └── paymentGateway.js         # Mock payment processor
├── routes/
│   ├── authRoutes.js             # /api/auth/*
│   ├── walletRoutes.js           # /api/wallet/*
│   └── userRoutes.js             # /api/user/*
└── utils/
    ├── crypto.js                 # SHA-256 hashing
    └── logger.js                 # Winston logger
```

### 3. Data Flow Diagrams

#### 3.1 User Registration Flow
```
User → Register Form → Backend
                         ↓
                  Validate Input
                         ↓
                  Hash Password (SHA-256)
                         ↓
                  Begin Transaction
                         ↓
          ┌──────────────┴──────────────┐
          ↓                             ↓
    Create User                   Create Wallet
    (users table)                 (balance = 0)
          └──────────────┬──────────────┘
                         ↓
                  Commit Transaction
                         ↓
                  Generate JWT Token
                         ↓
                  Return User + Token
```

#### 3.2 Add Money Flow
```
User → Select Amount + Payment Method
         ↓
    Generate Idempotency Key
         ↓
    Backend → Check Idempotency
         ↓
    Check Daily Limit
         ↓
    Create PENDING Transaction
         ↓
    Call Mock Payment Gateway
         ↓
    ┌────┴────┐
    ↓         ↓
 Success   Failure
    ↓         ↓
Update    Update
Wallet    Status
+₹        FAILED
    ↓         ↓
Update    Return
Status    Error
SUCCESS   Message
    ↓
Return Success
```

#### 3.3 P2P Transfer Flow (with Concurrency Handling)
```
User A → Enter Recipient Email + Amount
           ↓
      Verify Recipient Exists
           ↓
      Check Sender Balance
           ↓
      Check Daily Limit
           ↓
      Generate OTP (5 min validity)
           ↓
User A → Enter OTP
           ↓
      Validate OTP
           ↓
      Begin Transaction
           ↓
    Lock Both Wallets (sorted by user_id)
    ┌─────────────────┴─────────────────┐
    ↓                                   ↓
Debit User A                      Credit User B
wallet.balance -= amount          wallet.balance += amount
    │                                   │
    ↓                                   ↓
Create TRANSFER_DEBIT             Create TRANSFER_CREDIT
transaction                       transaction
    └─────────────────┬─────────────────┘
                      ↓
              Mark OTP as used
                      ↓
              Update Daily Limit
                      ↓
              Commit Transaction
                      ↓
              Return Success
```

### 4. Concurrency & Race Condition Handling

#### 4.1 Problem: Multiple Simultaneous Transfers
```
Without Locking:
User A: Balance = 1000

Transfer 1: A → B (500)    |  Transfer 2: A → C (600)
Read balance: 1000         |  Read balance: 1000
Calculate: 1000 - 500      |  Calculate: 1000 - 600
Update balance: 500        |  Update balance: 400
✗ Lost update! Final: 400 (Should be error - insufficient funds)
```

#### 4.2 Solution: Row-Level Locking with Consistent Ordering
```javascript
// Lock wallets in sorted order to prevent deadlock
const userIds = [senderId, recipientId].sort((a, b) => a - b);

await connection.query(
  'SELECT user_id, balance FROM wallets WHERE user_id IN (?, ?) FOR UPDATE',
  userIds
);

// Now safely update balances
```

**Why Sorted Locking?**
```
Without Sorting:
Thread 1: Lock(A) → Lock(B)
Thread 2: Lock(B) → Lock(A)
Result: DEADLOCK

With Sorting:
Thread 1: Lock(A) → Lock(B)
Thread 2: Lock(A) [waits] → Lock(B)
Result: Sequential execution
```

### 5. Database Design

#### 5.1 Entity Relationship Diagram
```
┌─────────────┐
│    Users    │
│─────────────│
│ PK id       │
│    name     │──┐
│ UK email    │  │ 1
│ password_   │  │
│    hash     │  │
└─────────────┘  │
                 │  1:1
      ┌──────────┴────────┐
      │                   │
      ↓                   ↓
┌─────────────┐    ┌──────────────┐
│   Wallets   │    │ Transactions │
│─────────────│    │──────────────│
│ PK id       │    │ PK id        │
│ FK user_id  │    │ UK trans_id  │
│    balance  │    │ UK idemp_key │
│  (DECIMAL)  │    │ FK user_id   │
│ CK >=0      │    │    type      │
└─────────────┘    │    amount    │
                   │    bal_before│
                   │    bal_after │
                   │    status    │
                   │ FK counter_  │
                   │    party_id  │
                   └──────────────┘
```

#### 5.2 Index Strategy
```sql
-- Users
INDEX idx_email (email)              -- Login lookup

-- Wallets  
INDEX idx_user_id (user_id)          -- User → Wallet lookup

-- Transactions
INDEX idx_transaction_id (transaction_id)
INDEX idx_user_id_created (user_id, created_at DESC)  -- User history
INDEX idx_idempotency_key (idempotency_key)          -- Duplicate check
INDEX idx_status (status)                             -- Status filtering
```

### 6. Security Architecture

#### 6.1 Authentication Flow
```
Login → SHA-256(password) → Compare with stored hash
                                ↓
                          Generate JWT
                         (userId, email, name)
                                ↓
                          Send to Client
                                ↓
                    Store in localStorage
                                ↓
    Subsequent Requests:
    Authorization: Bearer <JWT>
```

#### 6.2 Security Layers
```
┌────────────────────────────────────┐
│  1. Input Validation               │
│     - express-validator            │
│     - Type checking                │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│  2. Authentication                 │
│     - JWT verification             │
│     - Token expiry check           │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│  3. Authorization                  │
│     - User-specific operations     │
│     - Balance verification         │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│  4. Database Security              │
│     - Parameterized queries        │
│     - Stored procedures ready      │
└────────────────────────────────────┘
```

### 7. Idempotency Design

#### 7.1 Why Idempotency?
```
Scenario: Network timeout during add money
User clicks "Add ₹1000" → Request sent → Network timeout
User retries → Without idempotency: ₹2000 added (BAD!)
             → With idempotency: ₹1000 added (GOOD!)
```

#### 7.2 Implementation
```javascript
// Client generates UUID
const idempotencyKey = uuidv4();

// Backend checks before processing
const existing = await db.query(
  'SELECT * FROM transactions WHERE idempotency_key = ?',
  [idempotencyKey]
);

if (existing.length > 0) {
  // Return cached result
  return {
    ...existing[0],
    isDuplicate: true
  };
}

// Process new request
```

### 8. Scalability Considerations

#### 8.1 Current Architecture (Single Server)
```
Load Balancer (Future)
        ↓
   [App Server]
        ↓
   [MySQL DB]
```

#### 8.2 Horizontal Scaling (Future)
```
    Load Balancer
    /     |     \
[App1] [App2] [App3]
    \     |     /
   MySQL Primary
         |
    Replication
    /         \
[Read-1]   [Read-2]
```

#### 8.3 Database Sharding Strategy (Future)
```
Shard by user_id % 4:

Shard 0: user_id % 4 = 0
Shard 1: user_id % 4 = 1
Shard 2: user_id % 4 = 2
Shard 3: user_id % 4 = 3

Note: Cross-shard transfers require distributed transactions
```

### 9. Performance Optimizations

#### 9.1 Database
- Connection pooling (10 connections)
- Indexed columns for fast lookups
- DECIMAL for precise calculations
- InnoDB for row-level locking

#### 9.2 Application
- JWT for stateless auth
- Async/await for non-blocking I/O
- Input validation before DB queries
- Proper error handling (no crashes)

#### 9.3 Frontend
- React lazy loading (future)
- Pagination for transactions
- Optimistic UI updates (future)

### 10. Monitoring & Observability

#### 10.1 Logging Strategy
```
Winston Logger:
- error.log: Errors only
- combined.log: All logs
- Console: Development mode

Log Structure:
{
  timestamp: "2024-01-07 10:30:45",
  level: "error",
  message: "Transfer failed",
  service: "digital-wallet",
  userId: 123,
  transactionId: "uuid",
  error: { ... }
}
```

#### 10.2 Metrics (Future)
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate
- Database query time
- Active users
- Transaction success rate

### 11. Disaster Recovery

#### 11.1 Backup Strategy
```
Daily: Full database backup
Hourly: Incremental backups
Real-time: Binary log replication
```

#### 11.2 Recovery Plan
```
1. Identify failure point
2. Restore from latest backup
3. Replay binary logs
4. Verify data consistency
5. Resume operations
```

### 12. Testing Strategy

#### 12.1 Unit Tests
- Service layer logic
- Utility functions
- Input validation

#### 12.2 Integration Tests
- API endpoints
- Database operations
- Authentication flow

#### 12.3 Concurrency Tests
- Simultaneous transfers
- Deadlock scenarios
- Balance conservation

#### 12.4 Load Tests (Future)
- 1000 concurrent users
- 10,000 transactions/hour
- Database connection pool stress

### 13. Assumptions & Trade-offs

#### Assumptions
1. Single currency (INR)
2. Mock payment gateway acceptable
3. Mock OTP acceptable
4. Single region deployment
5. English language only

#### Trade-offs
1. **Consistency vs Availability**: Chose consistency (ACID)
2. **Complexity vs Performance**: Row locking adds complexity but ensures correctness
3. **Storage vs Speed**: Storing balance_before/after for audit vs calculating
4. **Denormalization**: daily_limits table for faster checks

### 14. Future Roadmap

#### Phase 2 (Next 3 months)
- Real payment gateway
- SMS OTP integration
- Email notifications
- Refund functionality

#### Phase 3 (6 months)
- Multi-currency support
- International transfers
- Scheduled payments
- Merchant integrations

#### Phase 4 (1 year)
- Mobile app (React Native)
- Rewards program
- Credit line feature
- Investment options

---

**Document Version**: 1.0  
**Last Updated**: January 2024  
**Author**: Engineering Team
