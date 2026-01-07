# 🚀 Quick Start Guide - Digital Wallet System

## Prerequisites

Ensure you have the following installed:
- **Node.js** 16.x or higher
- **MySQL** 8.0 or higher
- **npm** or **yarn**
- **Git** (optional)

---

## 📦 Installation Steps

### Step 1: Database Setup

1. **Start MySQL Server**
   ```bash
   # Windows (if MySQL is a service)
   net start MySQL80
   
   # Or start via MySQL Workbench
   ```

2. **Run Database Setup Script**
   
   Navigate to backend folder:
   ```bash
   cd backend
   ```
   ```bash
   # Install dependencies first
   npm install
   
   # Create database and tables
   npm run db:setup
   ```
   
   You should see:
   ```
   ✅ Connected to MySQL
   ✅ Database schema created successfully
   🎉 Database setup completed!
   ```

### Step 2: Backend Setup

From the `backend` directory:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

You should see:
```
🚀 Server running on port 5000
📊 Environment: development
🔗 Health check: http://localhost:5000/health
✅ Database connected successfully
```

**Test the backend:**
Open browser and visit: http://localhost:5000/health

### Step 3: Frontend Setup

Open a new terminal window.

Navigate to frontend folder:
```bash
cd frontend
```

Install dependencies and start:
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 4: Access the Application

Open your browser and visit:
```
http://localhost:3000
```

---

## 🧪 Testing the Application

### 1. Create Test Users

**User 1:**
- Name: `Test User 1`
- Email: `user1@test.com`
- Password: `password123`

**User 2:**
- Name: `Test User 2`
- Email: `user2@test.com`
- Password: `password123`

### 2. Test Add Money Flow

1. Login as User 1
2. Click "Add Money" tab
3. Enter amount: `5000`
4. Select payment method: `UPI`
5. Click "Add Money"
6. Observe: Payment may succeed or fail randomly (mock gateway)
7. Check balance update

### 3. Test Transfer Flow

1. Login as User 1 (should have balance from step 2)
2. Click "Transfer Money" tab
3. Enter recipient email: `user2@test.com`
4. Click "Verify" - should show "Found: Test User 2"
5. Enter amount: `1000`
6. Click "Generate OTP"
7. Note the OTP shown in development mode (e.g., `123456`)
8. Enter the OTP
9. Click "Confirm Transfer"
10. Check balance deducted

4. **Verify Transfer (Login as User 2)**
   - Login as user2@test.com
   - Check balance (should be ₹1000)
   - View transaction history (should show TRANSFER_CREDIT)

### 4. Test Transaction History

1. Click "Transaction History" tab
2. Verify all transactions are listed
3. Check pagination if more than 20 transactions

---

## 🧪 Running Tests

### Unit Tests
```bash
cd backend
npm test
```

Expected output:
```
PASS  __tests__/authService.test.js
PASS  __tests__/walletService.test.js
```

### Concurrency Tests
```bash
cd backend
npm run test:concurrency
```

Expected output:
```
🧪 Starting Concurrency Test...
📝 Setting up test users...
✅ Test users created
🔥 Test 1: Multiple concurrent transfers...
✅ Successful: 5 | ❌ Failed: 0
💰 Total balance in system: ₹15,000.00
✅ Balance conserved!
```

---

## 📊 Database Inspection

To view data in MySQL:

```sql
-- Connect to database
USE digital_wallet;

-- View users
SELECT id, name, email, created_at FROM users;

-- View wallets
SELECT w.id, u.name, w.balance, w.currency 
FROM wallets w 
JOIN users u ON w.user_id = u.id;

-- View transactions
SELECT 
    t.transaction_id,
    u.name as user,
    t.type,
    t.amount,
    t.status,
    t.created_at
FROM transactions t
JOIN users u ON t.user_id = u.id
ORDER BY t.created_at DESC
LIMIT 20;

-- Check daily limits
SELECT 
    u.name,
    dl.date,
    dl.total_added,
    dl.total_transferred
FROM daily_limits dl
JOIN users u ON dl.user_id = u.id;
```

---

## 🔧 Troubleshooting

### Backend won't start

**Issue:** `Database connection failed`
- **Solution:** Check MySQL is running and credentials in `.env` are correct

**Issue:** `Port 5000 already in use`
- **Solution:** Change PORT in `.env` to different port (e.g., 5001)

### Frontend won't start

**Issue:** `Port 3000 already in use`
- **Solution:** 
  1. Kill process on port 3000, or
  2. Edit `vite.config.js` and change `server.port` to 3001

### Database errors

**Issue:** `Table doesn't exist`
- **Solution:** Run `npm run db:setup` again

**Issue:** `Access denied for user`
- **Solution:** Check MySQL user has proper permissions:
  ```sql
  GRANT ALL PRIVILEGES ON digital_wallet.* TO 'root'@'localhost';
  FLUSH PRIVILEGES;
  ```

### Login/Register not working

**Issue:** CORS errors in browser console
- **Solution:** Ensure backend is running on port 5000 and frontend on 3000

**Issue:** "Invalid credentials"
- **Solution:** Re-register the user or check if password is correct

---

## 📁 Project Structure

```
Kotak Project/
│
├── backend/
│   ├── src/
│   │   ├── config/          # Database & constants
│   │   ├── middleware/      # Auth & error handling
│   │   ├── services/        # Business logic
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Helper functions
│   │   └── server.js        # Entry point
│   ├── __tests__/           # Unit tests
│   ├── tests/               # Integration tests
│   ├── package.json
│   └── .env                 # Configuration
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   ├── context/         # Auth context
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
├── README.md               # Main documentation
├── DESIGN.md              # System design
└── API_DOCS.md            # API reference
```

---

## 🎯 Key Features to Demonstrate

When presenting this project, highlight:

1. **Atomic Transactions**
   - Show concurrent transfer test
   - Explain row-level locking

2. **Idempotency**
   - Retry same add money request with same idempotency key
   - Show cached response

3. **Mock Payment Gateway**
   - Random success/failure simulation
   - Different payment methods

4. **Security**
   - SHA-256 password hashing
   - JWT authentication
   - Input validation

5. **Transaction Audit**
   - Complete history with before/after balances
   - Failed transactions also logged

6. **Edge Cases**
   - Negative balance prevention
   - Daily limit enforcement
   - OTP expiry
   - Concurrent transfers

---

## 🚦 Production Deployment (Future)

### Environment Variables
```env
NODE_ENV=production
DB_HOST=production-db-host
JWT_SECRET=strong-random-secret
```

### Build Commands
```bash
# Backend
cd backend
npm install --production

# Frontend
cd frontend
npm run build
```

### Recommended Hosting
- **Backend**: AWS EC2, Heroku, DigitalOcean
- **Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Database**: AWS RDS, DigitalOcean Managed MySQL

---

## 📞 Support

For issues or questions about this project:
1. Check the README.md
2. Review API_DOCS.md
3. Read DESIGN.md for architecture details

---

## ✅ Pre-Interview Checklist

Before your interview, ensure:
- [ ] Backend starts without errors
- [ ] Frontend loads in browser
- [ ] Can register new user
- [ ] Can add money (test both success and failure)
- [ ] Can transfer money between users
- [ ] Transaction history shows correctly
- [ ] Concurrency test passes
- [ ] You can explain the architecture
- [ ] You understand atomic transactions
- [ ] You know how idempotency works
- [ ] You can discuss trade-offs made

---

**Good luck with your interview! 🚀**
