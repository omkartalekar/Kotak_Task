import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.login(formData);
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h1 className="auth-title">🔐 Digital Wallet</h1>
                <h2 style={{ textAlign: 'center', fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                    Login
                </h2>

                {error && (
                    <div className="alert alert-error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            name="email"
                            className="form-input"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="Enter your email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="form-input"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Enter your password"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-block"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="auth-link">
                    Don't have an account? <Link to="/register">Register</Link>
                </div>
            </div>
        </div>
    );
}

export default Login;
