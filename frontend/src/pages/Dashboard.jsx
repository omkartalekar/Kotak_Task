import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { walletAPI } from '../services/api';
import AddMoneyForm from '../components/AddMoneyForm';
import TransferMoneyForm from '../components/TransferMoneyForm';
import TransactionHistory from '../components/TransactionHistory';

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [balance, setBalance] = useState(null);
    const [activeTab, setActiveTab] = useState('add-money');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        try {
            const response = await walletAPI.getBalance();
            setBalance(response.data.balance);
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleTransactionSuccess = () => {
        fetchBalance();
    };

    if (loading) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    return (
        <div>
            {/* Navbar */}
            <nav className="navbar">
                <div className="container navbar-content">
                    <div className="navbar-brand">💰 Digital Wallet</div>
                    <div className="navbar-menu">
                        <span className="navbar-user">👤 {user?.name}</span>
                        <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            {/* Dashboard Content */}
            <div className="container dashboard">
                {/* Balance Card */}
                <div className="balance-card">
                    <div className="balance-label">Current Balance</div>
                    <div className="balance-amount">
                        ₹{balance ? parseFloat(balance.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                    <div className="balance-currency">{balance?.currency || 'INR'}</div>
                </div>

                {/* Tabs */}
                <div className="tabs">
                    <button 
                        className={`tab ${activeTab === 'add-money' ? 'active' : ''}`}
                        onClick={() => setActiveTab('add-money')}
                    >
                        💵 Add Money
                    </button>
                    <button 
                        className={`tab ${activeTab === 'transfer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transfer')}
                    >
                        💸 Transfer Money
                    </button>
                    <button 
                        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        📊 Transaction History
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'add-money' && (
                    <AddMoneyForm onSuccess={handleTransactionSuccess} />
                )}

                {activeTab === 'transfer' && (
                    <TransferMoneyForm onSuccess={handleTransactionSuccess} currentBalance={balance?.balance} />
                )}

                {activeTab === 'history' && (
                    <TransactionHistory />
                )}
            </div>
        </div>
    );
}

export default Dashboard;
