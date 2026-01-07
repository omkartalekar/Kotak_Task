import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth APIs
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getProfile: () => api.get('/user/profile')
};

// Wallet APIs
export const walletAPI = {
    getBalance: () => api.get('/wallet/balance'),
    addMoney: (data) => api.post('/wallet/add-money', data),
    generateTransferOTP: (data) => api.post('/wallet/transfer/generate-otp', data),
    transfer: (data) => api.post('/wallet/transfer', data),
    getTransactions: (page = 1, limit = 20) => 
        api.get(`/wallet/transactions?page=${page}&limit=${limit}`)
};

// User APIs
export const userAPI = {
    searchUser: (email) => api.get(`/user/search?email=${email}`)
};

export default api;
