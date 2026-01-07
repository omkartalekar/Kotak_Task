# API Documentation

## Base URL
```
Development: http://localhost:5000/api
Production: https://api.digitalwallet.com/api
```

## Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <jwt_token>
```

---

## Auth Endpoints

### Register User
**POST** `/auth/register`

Create a new user account and wallet.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Validation:**
- `name`: Required, non-empty string
- `email`: Required, valid email format
- `password`: Required, minimum 6 characters

**Success Response (201):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- **400**: Validation error
- **500**: Email already registered

---

### Login
**POST** `/auth/login`

Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- **400**: Invalid credentials
- **401**: User not active

---

## User Endpoints

### Get Profile
**GET** `/user/profile`  
🔒 **Requires Authentication**

Get current user profile with wallet balance.

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-01T10:00:00Z",
    "balance": "5000.00",
    "currency": "INR"
  }
}
```

---

### Search User
**GET** `/user/search?email=recipient@example.com`  
🔒 **Requires Authentication**

Search for a user by email (for transfer recipient lookup).

**Query Parameters:**
- `email`: Email address to search

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
}
```

**Error Responses:**
- **400**: Email parameter missing
- **404**: User not found

---

## Wallet Endpoints

### Get Balance
**GET** `/wallet/balance`  
🔒 **Requires Authentication**

Get current wallet balance.

**Success Response (200):**
```json
{
  "success": true,
  "balance": {
    "balance": "5000.00",
    "currency": "INR"
  }
}
```

---

### Add Money
**POST** `/wallet/add-money`  
🔒 **Requires Authentication**  
💡 **Idempotent**

Add money to wallet via mock payment gateway.

**Request Body:**
```json
{
  "amount": 1000.50,
  "paymentMethod": "UPI",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:**
- `amount`: Required, 100-200000, max 2 decimal places
- `paymentMethod`: Required, one of ["UPI", "CARD", "NET_BANKING"]
- `idempotencyKey`: Optional, UUID format

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment successful via UPI",
  "transaction": {
    "id": "txn-uuid-here",
    "amount": 1000.50,
    "balance": 6000.50,
    "paymentMethod": "UPI",
    "status": "SUCCESS"
  }
}
```

**Failure Response (200):**
```json
{
  "success": false,
  "message": "UPI transaction failed - Insufficient balance in bank account",
  "transaction": {
    "id": "txn-uuid-here",
    "amount": 1000.50,
    "balance": 5000.00,
    "paymentMethod": "UPI",
    "status": "FAILED"
  }
}
```

**Idempotent Response:**
```json
{
  "success": true,
  "message": "Duplicate request - returning cached response",
  "transaction": { ... },
  "isDuplicate": true
}
```

**Error Responses:**
- **400**: Invalid input
- **429**: Daily limit exceeded

---

### Generate Transfer OTP
**POST** `/wallet/transfer/generate-otp`  
🔒 **Requires Authentication**

Generate OTP for money transfer.

**Request Body:**
```json
{
  "toEmail": "recipient@example.com",
  "amount": 500.00
}
```

**Validation:**
- `toEmail`: Required, valid email
- `amount`: Required, 100-200000, max 2 decimal places

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully. Valid for 5 minutes.",
  "referenceId": "ref-uuid-here",
  "recipient": {
    "name": "Jane Smith",
    "email": "recipient@example.com"
  },
  "otp": "123456"
}
```

**Note:** OTP is only returned in development environment. In production, it should be sent via SMS.

**Error Responses:**
- **400**: Recipient not found / Cannot transfer to yourself
- **400**: Insufficient balance
- **429**: Daily transfer limit exceeded

---

### Transfer Money
**POST** `/wallet/transfer`  
🔒 **Requires Authentication**  
💡 **Idempotent**

Transfer money to another user after OTP verification.

**Request Body:**
```json
{
  "toEmail": "recipient@example.com",
  "amount": 500.00,
  "otp": "123456",
  "referenceId": "ref-uuid-from-generate-otp",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:**
- `toEmail`: Required, valid email
- `amount`: Required, 100-200000
- `otp`: Required, exactly 6 characters
- `referenceId`: Required, UUID format
- `idempotencyKey`: Optional, UUID format

**Success Response (200):**
```json
{
  "success": true,
  "message": "Transfer successful",
  "transaction": {
    "id": "txn-uuid-here",
    "amount": 500.00,
    "balance": 4500.00,
    "recipient": "recipient@example.com",
    "status": "SUCCESS"
  }
}
```

**Error Responses:**
- **400**: Invalid or expired OTP
- **400**: Insufficient balance
- **404**: Recipient not found

**Transaction Atomicity:**
This operation creates two transactions:
1. TRANSFER_DEBIT for sender
2. TRANSFER_CREDIT for recipient

Both are created atomically. If either fails, the entire operation is rolled back.

---

### Get Transaction History
**GET** `/wallet/transactions?page=1&limit=20`  
🔒 **Requires Authentication**

Get paginated transaction history.

**Query Parameters:**
- `page`: Optional, integer >= 1, default: 1
- `limit`: Optional, integer 1-100, default: 20

**Success Response (200):**
```json
{
  "success": true,
  "transactions": [
    {
      "transaction_id": "txn-uuid",
      "type": "ADD_MONEY",
      "amount": "1000.00",
      "balance_after": "6000.00",
      "status": "SUCCESS",
      "payment_method": "UPI",
      "created_at": "2024-01-07T10:30:00Z"
    },
    {
      "transaction_id": "txn-uuid-2",
      "type": "TRANSFER_DEBIT",
      "amount": "500.00",
      "balance_after": "5500.00",
      "status": "SUCCESS",
      "counterparty_email": "jane@example.com",
      "counterparty_name": "Jane Smith",
      "created_at": "2024-01-07T11:00:00Z"
    },
    {
      "transaction_id": "txn-uuid-3",
      "type": "TRANSFER_CREDIT",
      "amount": "200.00",
      "balance_after": "5700.00",
      "status": "SUCCESS",
      "counterparty_email": "bob@example.com",
      "counterparty_name": "Bob Wilson",
      "created_at": "2024-01-07T11:30:00Z"
    },
    {
      "transaction_id": "txn-uuid-4",
      "type": "ADD_MONEY",
      "amount": "500.00",
      "balance_after": "5700.00",
      "status": "FAILED",
      "payment_method": "CARD",
      "failure_reason": "Card declined - Insufficient funds",
      "created_at": "2024-01-07T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

**Transaction Types:**
- `ADD_MONEY`: Money added to wallet
- `TRANSFER_DEBIT`: Money sent to another user
- `TRANSFER_CREDIT`: Money received from another user

**Transaction Status:**
- `SUCCESS`: Completed successfully
- `FAILED`: Failed (with failure_reason)
- `PENDING`: In progress

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "msg": "Detailed error message",
      "param": "field_name",
      "location": "body"
    }
  ]
}
```

**HTTP Status Codes:**
- `200`: Success (including payment failures)
- `201`: Resource created
- `400`: Bad request / Validation error
- `401`: Unauthorized / Invalid token
- `404`: Resource not found
- `429`: Rate limit / Daily limit exceeded
- `500`: Internal server error

---

## Rate Limits

### Transaction Limits
- **Single Transaction**: ₹100 - ₹200,000
- **Daily Add Money**: ₹500,000
- **Daily Transfer**: ₹500,000

### API Rate Limits (Future)
- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute

---

## Idempotency

Endpoints supporting idempotency:
- `/wallet/add-money`
- `/wallet/transfer`

**How to use:**
1. Generate UUID v4 on client side
2. Send as `idempotencyKey` in request body
3. If same key is sent again, cached response is returned
4. Idempotency keys expire after 24 hours

**Example:**
```javascript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();

// First request
await api.post('/wallet/add-money', {
  amount: 1000,
  paymentMethod: 'UPI',
  idempotencyKey
});

// Retry with same key (network timeout scenario)
await api.post('/wallet/add-money', {
  amount: 1000,
  paymentMethod: 'UPI',
  idempotencyKey // Same key - will return cached result
});
```

---

## Webhooks (Future)

### Transaction Status Update
**POST** `<your-webhook-url>`

Webhook payload for transaction status updates:

```json
{
  "event": "transaction.updated",
  "timestamp": "2024-01-07T10:30:00Z",
  "data": {
    "transaction_id": "txn-uuid",
    "user_id": 1,
    "type": "ADD_MONEY",
    "amount": 1000.00,
    "status": "SUCCESS",
    "balance_after": 6000.00
  }
}
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login
const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', response.data.token);
  return response.data;
};

// Add money
const addMoney = async (amount, paymentMethod) => {
  const response = await api.post('/wallet/add-money', {
    amount,
    paymentMethod,
    idempotencyKey: crypto.randomUUID()
  });
  return response.data;
};
```

### Python
```python
import requests
import uuid

BASE_URL = 'http://localhost:5000/api'

class WalletAPI:
    def __init__(self):
        self.token = None
    
    def login(self, email, password):
        response = requests.post(f'{BASE_URL}/auth/login', json={
            'email': email,
            'password': password
        })
        data = response.json()
        self.token = data['token']
        return data
    
    def add_money(self, amount, payment_method):
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.post(f'{BASE_URL}/wallet/add-money', 
            json={
                'amount': amount,
                'paymentMethod': payment_method,
                'idempotencyKey': str(uuid.uuid4())
            },
            headers=headers
        )
        return response.json()
```

---

## Testing

### Postman Collection
Import the Postman collection from `postman_collection.json`

### cURL Examples

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"pass123"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'
```

**Get Balance:**
```bash
curl -X GET http://localhost:5000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Add Money:**
```bash
curl -X POST http://localhost:5000/api/wallet/add-money \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"paymentMethod":"UPI"}'
```

---

**API Version:** 1.0  
**Last Updated:** January 2024
