import { useState } from 'react';
import { walletAPI, userAPI } from '../services/api';
import { v4 as uuidv4 } from 'uuid';

function TransferMoneyForm({ onSuccess, currentBalance }) {
    const [step, setStep] = useState(1); // 1: Enter details, 2: OTP verification
    const [formData, setFormData] = useState({
        toEmail: '',
        amount: ''
    });
    const [otpData, setOtpData] = useState({
        otp: '',
        referenceId: null,
        recipientInfo: null
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setMessage(null);
        if (e.target.name === 'toEmail') {
            setEmailVerified(false);
        }
    };

    const verifyEmail = async () => {
        if (!formData.toEmail) return;
        
        setVerifyingEmail(true);
        setMessage(null);

        try {
            const response = await userAPI.searchUser(formData.toEmail);
            if (response.data.success) {
                setEmailVerified(true);
                setMessage({
                    type: 'success',
                    text: `Found: ${response.data.user.name}`
                });
            }
        } catch (error) {
            setEmailVerified(false);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'User not found'
            });
        } finally {
            setVerifyingEmail(false);
        }
    };

    const handleGenerateOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await walletAPI.generateTransferOTP({
                toEmail: formData.toEmail,
                amount: parseFloat(formData.amount)
            });

            setOtpData({
                otp: response.data.otp || '', // For dev environment
                referenceId: response.data.referenceId,
                recipientInfo: response.data.recipient
            });

            setMessage({
                type: 'success',
                text: response.data.message + (response.data.otp ? ` (OTP: ${response.data.otp})` : '')
            });

            setStep(2);
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to generate OTP. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await walletAPI.transfer({
                toEmail: formData.toEmail,
                amount: parseFloat(formData.amount),
                otp: otpData.otp,
                referenceId: otpData.referenceId,
                idempotencyKey: uuidv4()
            });

            setMessage({
                type: 'success',
                text: response.data.message
            });

            // Reset form
            setTimeout(() => {
                setFormData({ toEmail: '', amount: '' });
                setOtpData({ otp: '', referenceId: null, recipientInfo: null });
                setStep(1);
                setEmailVerified(false);
                onSuccess();
            }, 2000);

        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Transfer failed. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Transfer Money</h3>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {step === 1 ? (
                <form onSubmit={handleGenerateOTP}>
                    <div className="form-group">
                        <label className="form-label">Recipient Email</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="email"
                                name="toEmail"
                                className="form-input"
                                value={formData.toEmail}
                                onChange={handleChange}
                                required
                                placeholder="Enter recipient's email"
                                style={{ flex: 1 }}
                            />
                            <button
                                type="button"
                                onClick={verifyEmail}
                                className="btn btn-secondary"
                                disabled={verifyingEmail || !formData.toEmail}
                            >
                                {verifyingEmail ? 'Checking...' : 'Verify'}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Amount (₹)</label>
                        <input
                            type="number"
                            name="amount"
                            className="form-input"
                            value={formData.amount}
                            onChange={handleChange}
                            min="100"
                            max={currentBalance || "200000"}
                            step="0.01"
                            required
                            placeholder="Enter amount"
                        />
                        <small style={{ fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Available balance: ₹{parseFloat(currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </small>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-block"
                        disabled={loading || !emailVerified}
                    >
                        {loading ? 'Generating OTP...' : 'Generate OTP'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleTransfer}>
                    <div className="alert alert-info">
                        Transferring ₹{parseFloat(formData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} to {otpData.recipientInfo?.name} ({otpData.recipientInfo?.email})
                    </div>

                    <div className="form-group">
                        <label className="form-label">Enter OTP</label>
                        <input
                            type="text"
                            name="otp"
                            className="form-input"
                            value={otpData.otp}
                            onChange={(e) => setOtpData({ ...otpData, otp: e.target.value })}
                            maxLength="6"
                            required
                            placeholder="Enter 6-digit OTP"
                        />
                        <small style={{ fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            OTP is valid for 5 minutes
                        </small>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                            type="button"
                            onClick={() => {
                                setStep(1);
                                setOtpData({ otp: '', referenceId: null, recipientInfo: null });
                            }}
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-success"
                            style={{ flex: 1 }}
                            disabled={loading || otpData.otp.length !== 6}
                        >
                            {loading ? 'Processing...' : 'Confirm Transfer'}
                        </button>
                    </div>
                </form>
            )}

            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                ⚠️ Transfers are irreversible. Please verify recipient details before confirming.
            </div>
        </div>
    );
}

export default TransferMoneyForm;
