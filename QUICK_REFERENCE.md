# 🚀 Quick Reference - Digital Wallet System

## ⚡ Quick Start (5 Minutes)

```bash
# 1. Backend Setup
cd backend
npm install
npm run db:setup
npm run dev

# 2. Frontend Setup (new terminal)
cd frontend
npm install
npm run dev

# 3. Access
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

## 🔑 Default Configuration

```
Frontend Port: 3000
Backend Port:  5000
MySQL Port:    3306
Database Name: digital_wallet
```

## 📝 Common Commands

### Backend
```bash
npm run dev          # Start development server
npm test            # Run unit tests
npm run test:concurrency  # Run concurrency tests
npm run db:setup    # Create database & tables
```

### Frontend
```bash
npm run dev         # Start development server (port 3000)
npm run build       # Build for production
npm run preview     # Preview production build
```

## 🧪 Quick Test Scenario

1. **Register User 1**
   - Email: user1@test.com
   - Password: password123

2. **Add Money**
   - Amount: 5000
   - Method: UPI

3. **Register User 2**
   - Email: user2@test.com  
   - Password: password123

4. **Transfer (from User 1 to User 2)**
   - Amount: 1000
   - Verify email → Generate OTP → Enter OTP → Confirm

5. **Verify Transfer**
   - Login as User 2
   - Check balance = 1000
   - View transaction history

## 🎯 Key Features to Demo

1. **Atomic Transactions**: Show concurrency test
2. **Idempotency**: Retry same request with same key
3. **Mock Gateway**: Random success/failure
4. **Security**: JWT auth, password hashing
5. **Audit Trail**: Complete transaction history

## 📊 Database Quick Queries

```sql
USE digital_wallet;

-- View all users with balances
SELECT u.name, u.email, w.balance 
FROM users u 
JOIN wallets w ON u.id = w.user_id;

-- Recent transactions
SELECT * FROM transactions 
ORDER BY created_at DESC 
LIMIT 10;

-- Daily limits
SELECT u.name, dl.* 
FROM daily_limits dl 
JOIN users u ON dl.user_id = u.id;
```

## 🔧 Troubleshooting (30 seconds)

**Backend won't start?**
→ Check MySQL is running (with empty root password)
→ Run `npm run db:setup`

**Frontend shows errors?**
→ Ensure backend is running on port 5000
→ Check browser console for details

**Can't transfer?**
→ Verify both users registered
→ Check sender has sufficient balance
→ OTP is valid (not expired)

## 🏗️ Architecture (One Liner)

```
React (3000) → Express API (5000) → MySQL (3306)
             ↓
        Mock Payment Gateway
```

## 💡 Important Files

```
Backend:
- src/server.js              # Entry point
- src/services/walletService.js  # Core logic
- src/database/schema.sql    # Database schema

Frontend:
- src/App.jsx                # Router
- src/pages/Dashboard.jsx    # Main UI
- src/services/api.js        # API client

Docs:
- README.md                  # Start here
- SETUP_GUIDE.md            # Installation
- API_DOCS.md               # API reference
```

## 🎓 Interview Talking Points

1. **Concurrency**: Row-level locks, sorted locking to prevent deadlock
2. **Idempotency**: UUID keys, cached responses for retries
3. **Atomicity**: MySQL transactions, all-or-nothing updates
4. **Audit**: Every transaction logged with before/after balance
5. **Security**: SHA-256 hashing, JWT auth, input validation

## ✅ Pre-Demo Checklist

- [ ] MySQL running
- [ ] Backend starts without errors (port 5000)
- [ ] Frontend loads (port 3000)
- [ ] Can register and login
- [ ] Add money works (both success & failure)
- [ ] Transfer works with OTP
- [ ] Transaction history displays
- [ ] Concurrency test passes

## 📞 Emergency Fixes

**Port already in use?**
```bash
# Change backend port in backend/.env
PORT=5001

# Change frontend port in frontend/vite.config.js
server: { port: 3001 }
```

**Database connection error?**
```bash
# Reset database
cd backend
npm run db:setup
```

**Lost OTP in production mode?**
```env
# In backend/.env, set:
NODE_ENV=development
# OTP will be returned in API response
```

---

## 🚀 Production Deployment URLs

```bash
# Build commands
cd backend && npm install --production
cd frontend && npm run build

# Recommended hosting:
Frontend: Vercel, Netlify
Backend: Heroku, AWS EC2
Database: AWS RDS, DigitalOcean
```

---

**Need more details?** Check:
- README.md for overview
- SETUP_GUIDE.md for step-by-step
- API_DOCS.md for API details
- DESIGN.md for architecture
