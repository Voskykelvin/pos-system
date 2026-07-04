import { useState, useEffect } from 'react';
import styles from './CustomerAdmin.module.css';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default function CustomerAdmin({ authToken, user }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);
  
  // Ledger Modal State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Request failed');
    return payload;
  }

  async function searchCustomers(e) {
    if (e) e.preventDefault();
    try {
      const payload = await api(`/api/customers/search?q=${encodeURIComponent(query)}`);
      setCustomers(payload);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openLedger(customer) {
    setSelectedCustomer(customer);
    setLedgerData(null);
    try {
      const payload = await api(`/api/customers/${customer.id}/ledger`);
      setLedgerData(payload);
    } catch (err) {
      alert(err.message);
      setSelectedCustomer(null);
    }
  }

  async function handlePayment(e) {
    e.preventDefault();
    if (!paymentAmount) return;
    setIsPaying(true);
    try {
      await api(`/api/customers/${selectedCustomer.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount, notes: paymentNotes })
      });
      setPaymentAmount('');
      setPaymentNotes('');
      // Reload ledger
      const payload = await api(`/api/customers/${selectedCustomer.id}/ledger`);
      setLedgerData(payload);
      // Reload customers list to reflect new balance
      searchCustomers();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsPaying(false);
    }
  }

  // Load all initially
  useEffect(() => {
    searchCustomers();
  }, []);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Customer Management</h1>
        <p>Manage customer profiles, loyalty points, and credit ledgers (Chalking).</p>
      </header>

      <div className={styles.panel}>
        <form className={styles.searchBar} onSubmit={searchCustomers}>
          <input 
            className={styles.searchInput}
            type="text" 
            placeholder="Search by name or phone..." 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
          />
          <button className={styles.searchBtn} type="submit">Search</button>
        </form>

        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Loyalty Pts</th>
              <th>Credit Balance</th>
              <th>Credit Limit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td>{c.name || '—'}</td>
                <td>{c.phone}</td>
                <td>{c.loyaltyPoints}</td>
                <td>
                  <strong style={{ color: Number(c.creditBalance) > 0 ? '#ef4444' : 'inherit' }}>
                    {formatKes(c.creditBalance)}
                  </strong>
                </td>
                <td>{formatKes(c.creditLimit)}</td>
                <td>
                  <button className={styles.actionBtn} onClick={() => openLedger(c)}>
                    View Ledger
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-soft)' }}>
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedCustomer && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>{selectedCustomer.name || selectedCustomer.phone}'s Ledger</h2>
            
            {!ledgerData ? (
              <p>Loading ledger...</p>
            ) : (
              <>
                <div className={styles.modalMeta}>
                  <strong>Current Debt:</strong> {formatKes(ledgerData.creditBalance)} <br/>
                  <strong>Credit Limit:</strong> {formatKes(ledgerData.creditLimit)}
                </div>

                <form className={styles.paymentForm} onSubmit={handlePayment}>
                  <input 
                    type="number" 
                    placeholder="Payment Amount" 
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(e.target.value)}
                    required
                    min="1"
                    max={ledgerData.creditBalance}
                  />
                  <input 
                    type="text" 
                    placeholder="Notes (optional)" 
                    value={paymentNotes} 
                    onChange={e => setPaymentNotes(e.target.value)}
                  />
                  <button className={styles.paymentBtn} type="submit" disabled={isPaying || Number(ledgerData.creditBalance) <= 0}>
                    {isPaying ? 'Processing...' : 'Record Payment'}
                  </button>
                </form>

                <div className={styles.ledgerRow} style={{ background: 'var(--panel)', borderRadius: '4px' }}>
                  <div className={styles.ledgerHeader}>Date</div>
                  <div className={styles.ledgerHeader}>Description</div>
                  <div className={styles.ledgerHeader}>Amount</div>
                  <div className={styles.ledgerHeader}>Balance</div>
                </div>
                
                {ledgerData.transactions.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
                    No credit history
                  </div>
                ) : (
                  ledgerData.transactions.map(t => (
                    <div className={styles.ledgerRow} key={t.id}>
                      <div>{formatDate(t.createdAt).split(',')[0]}</div>
                      <div>
                        {t.type === 'charge' ? '🛍️ Credit Sale' : '💰 Repayment'} 
                        {t.orderId && ` (Order #${t.orderId})`}
                        {t.notes && <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{t.notes}</div>}
                      </div>
                      <div className={t.type === 'charge' ? styles.amountCharge : styles.amountPayment}>
                        {t.type === 'charge' ? '+' : '-'}{formatKes(t.amount)}
                      </div>
                      <strong>{formatKes(t.balanceAfter)}</strong>
                    </div>
                  ))
                )}
              </>
            )}

            <button className={styles.closeBtn} onClick={() => setSelectedCustomer(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
