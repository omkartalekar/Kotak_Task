import { useState } from 'react';
import { walletAPI } from '../services/api';
import { v4 as uuidv4 } from 'uuid';

function AddMoneyForm({ onSuccess }) {
    const [formData, setFormData] = useState({
        amount: '',
        paymentMethod: 'UPI'
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setMessage(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await walletAPI.addMoney({
                amount: parseFloat(formData.amount),
                paymentMethod: formData.paymentMethod,
                idempotencyKey: uuidv4()
            });

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: response.data.message
                });
                setFormData({ amount: '', paymentMethod: 'UPI' });
                onSuccess();
            } else {
                setMessage({
                    type: 'error',
                    text: response.data.message
                });
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to add money. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Add Money to Wallet</h3>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Amount (₹)</label>
                    <input
                        type="number"
                        name="amount"
                        className="form-input"
                        value={formData.amount}
                        onChange={handleChange}
                        min="100"
                        max="200000"
                        step="0.01"
                        required
                        placeholder="Enter amount (₹100 - ₹200,000)"
                    />
                    <small style={{ fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                        Minimum: ₹100 | Maximum: ₹2,00,000
                    </small>
                </div>

                <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                        name="paymentMethod"
                        className="form-select"
                        value={formData.paymentMethod}
                        onChange={handleChange}
                        required
                    >
                        <option value="UPI">UPI</option>
                        <option value="CARD">Debit/Credit Card</option>
                        <option value="NET_BANKING">Net Banking</option>
                    </select>
                </div>

                <button 
                    type="submit" 
                    className="btn btn-primary btn-block"
                    disabled={loading}
                >
                    {loading ? 'Processing Payment...' : 'Add Money'}
                </button>
            </form>

            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                ℹ️ This is a mock payment gateway. Payments may succeed or fail randomly for testing purposes.
            </div>
        </div>
    );
}

export default AddMoneyForm;
