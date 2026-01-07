import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';

function TransactionHistory() {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchTransactions(currentPage);
    }, [currentPage]);

    const fetchTransactions = async (page) => {
        setLoading(true);
        try {
            const response = await walletAPI.getTransactions(page, 20);
            setTransactions(response.data.transactions);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTransactionTypeLabel = (type) => {
        switch (type) {
            case 'ADD_MONEY':
                return '💰 Money Added';
            case 'TRANSFER_DEBIT':
                return '📤 Money Sent';
            case 'TRANSFER_CREDIT':
                return '📥 Money Received';
            default:
                return type;
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            SUCCESS: { bg: '#dcfce7', color: '#166534', text: '✓ Success' },
            FAILED: { bg: '#fee2e2', color: '#991b1b', text: '✗ Failed' },
            PENDING: { bg: '#fed7aa', color: '#9a3412', text: '⏳ Pending' }
        };
        const style = styles[status] || styles.PENDING;
        
        return (
            <span style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: style.bg,
                color: style.color
            }}>
                {style.text}
            </span>
        );
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    if (loading && transactions.length === 0) {
        return (
            <div className="card">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Loading transactions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Transaction History</h3>
            </div>

            {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No transactions yet
                </div>
            ) : (
                <>
                    <ul className="transaction-list">
                        {transactions.map((txn) => (
                            <li key={txn.transaction_id} className="transaction-item">
                                <div className="transaction-info">
                                    <div className="transaction-type">
                                        {getTransactionTypeLabel(txn.type)}
                                        {txn.counterparty_email && (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                                                {txn.type === 'TRANSFER_DEBIT' ? 'to' : 'from'} {txn.counterparty_name || txn.counterparty_email}
                                            </span>
                                        )}
                                        {txn.payment_method && (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                                                via {txn.payment_method}
                                            </span>
                                        )}
                                    </div>
                                    <div className="transaction-date">{formatDate(txn.created_at)}</div>
                                    {txn.failure_reason && (
                                        <div style={{ fontSize: '0.813rem', color: 'var(--danger-color)', marginTop: '0.25rem' }}>
                                            {txn.failure_reason}
                                        </div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className={`transaction-amount ${txn.type === 'TRANSFER_CREDIT' || txn.type === 'ADD_MONEY' ? 'credit' : 'debit'}`}>
                                        {txn.type === 'TRANSFER_DEBIT' ? '-' : '+'}₹{parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                    {getStatusBadge(txn.status)}
                                </div>
                            </li>
                        ))}
                    </ul>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="btn btn-secondary btn-sm"
                            >
                                Previous
                            </button>
                            <span style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Page {currentPage} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === pagination.totalPages}
                                className="btn btn-secondary btn-sm"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default TransactionHistory;
