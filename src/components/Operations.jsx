import { useEffect, useState } from 'react';
import styles from './Operations.module.css';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default function Operations({ authToken, user }) {
  const [shift, setShift] = useState(null);
  const [openingFloat, setOpeningFloat] = useState('1000');
  const [cashCounted, setCashCounted] = useState('');
  const [shiftMessage, setShiftMessage] = useState(null);
  const [shiftError, setShiftError] = useState(null);
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [orderError, setOrderError] = useState(null);
  const [actionReason, setActionReason] = useState('');

  // Expenses state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('wages');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseLogging, setExpenseLogging] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditError, setAuditError] = useState(null);

  // Multi-till shift summary state for managers
  const [shiftSummary, setShiftSummary] = useState(null);

  const canManageOrders = user?.role === 'admin' || user?.role === 'manager';
  const canViewAudit = user?.role === 'admin' || user?.role === 'manager';

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

  async function loadShift() {
    try {
      const payload = await api('/api/shifts/current');
      setShift(payload);
      setShiftError(null);
    } catch (err) {
      setShiftError(err.message);
    }
  }

  async function loadShiftSummary() {
    if (!canManageOrders) return;
    try {
      const payload = await api('/api/shifts/summary');
      setShiftSummary(payload);
    } catch { /* ignore */ }
  }

  async function openShift() {
    try {
      const payload = await api('/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat })
      });
      setShift(payload);
      setShiftMessage('Shift opened.');
      setShiftError(null);
      await loadAuditLogs();
      await loadShiftSummary();
    } catch (err) {
      setShiftError(err.message);
    }
  }

  async function closeShift() {
    if (!shift?.id) return;
    try {
      const payload = await api(`/api/shifts/${shift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashCounted })
      });
      setShift(payload);
      setCashCounted('');
      setShiftMessage('Shift closed.');
      setShiftError(null);
      await loadAuditLogs();
      await loadShiftSummary();
    } catch (err) {
      setShiftError(err.message);
    }
  }

  async function logExpense(e) {
    e.preventDefault();
    if (!expenseAmount) return;
    setExpenseLogging(true);
    try {
      await api('/api/shifts/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: expenseAmount,
          category: expenseCategory,
          description: expenseDesc
        })
      });
      setExpenseAmount('');
      setExpenseDesc('');
      setShiftMessage('Expense logged successfully.');
      await loadShift();
      await loadShiftSummary();
      await loadAuditLogs();
    } catch (err) {
      setShiftError(err.message);
    } finally {
      setExpenseLogging(false);
    }
  }

  async function searchOrders(nextQuery = query) {
    try {
      const payload = await api(`/api/orders/search?q=${encodeURIComponent(nextQuery)}`);
      setOrders(payload);
      setOrderError(null);
    } catch (err) {
      setOrderError(err.message);
    }
  }

  async function loadReceipt(orderId) {
    try {
      const payload = await api(`/api/orders/${orderId}/receipt`);
      setReceipt(payload);
      setActionReason('');
      setOrderError(null);
    } catch (err) {
      setOrderError(err.message);
    }
  }

  async function loadAuditLogs() {
    if (!canViewAudit) return;
    try {
      const payload = await api('/api/audit-logs');
      setAuditLogs(payload);
      setAuditError(null);
    } catch (err) {
      setAuditError(err.message);
    }
  }

  async function orderAction(type) {
    if (!receipt?.id) return;
    try {
      await api(`/api/orders/${receipt.id}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionReason })
      });
      await loadReceipt(receipt.id);
      await searchOrders();
      await loadAuditLogs();
      setOrderError(null);
    } catch (err) {
      setOrderError(err.message);
    }
  }

  useEffect(() => {
    loadShift();
    searchOrders('');
    loadAuditLogs();
    loadShiftSummary();
  }, [authToken, canViewAudit]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Operations</h1>
          <p>Shift control, multi-till cash reconciliation, and receipt lookup.</p>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Current Shift panel */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Current shift</h2>
            <span>{shift?.status || 'none'}</span>
          </div>
          {!shift ? (
            <div className={styles.formBlock}>
              <label>
                Opening float
                <input
                  type="number"
                  value={openingFloat}
                  onChange={(event) => setOpeningFloat(event.target.value)}
                />
              </label>
              <button type="button" onClick={openShift}>Open shift</button>
            </div>
          ) : (
            <div className={styles.shiftDetails}>
              <div className={styles.row}>
                <span>Opened</span>
                <strong>{formatDate(shift.openedAt)}</strong>
              </div>
              <div className={styles.row}>
                <span>Opening float</span>
                <strong>{formatKes(shift.openingFloat)}</strong>
              </div>
              <div className={styles.row}>
                <span>Cash sales</span>
                <strong>{formatKes(shift.currentCashSalesExpected ?? shift.cashSalesExpected)}</strong>
              </div>
              <div className={styles.row}>
                <span>Till Expenses</span>
                <strong style={{ color: '#ef4444' }}>- {formatKes(shift.totalExpenses)}</strong>
              </div>
              {shift.status === 'open' ? (
                <>
                  <form className={styles.expenseForm} onSubmit={logExpense}>
                    <h4>Log Petty Cash Expense</h4>
                    <div className={styles.expenseInputs}>
                      <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>
                        <option value="wages">Casual Wages</option>
                        <option value="utilities">Utilities (Tokens/Water)</option>
                        <option value="supplies">Store Supplies</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        required
                        min="1"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Description (Optional)"
                      value={expenseDesc}
                      onChange={e => setExpenseDesc(e.target.value)}
                    />
                    <button type="submit" disabled={expenseLogging} className={styles.expenseBtn}>
                      {expenseLogging ? 'Logging...' : 'Log Expense'}
                    </button>
                  </form>
                  <div className={styles.formBlock}>
                  <label>
                    Cash counted
                    <input
                      type="number"
                      value={cashCounted}
                      onChange={(event) => setCashCounted(event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <button type="button" onClick={closeShift} disabled={!cashCounted}>
                    Close shift
                  </button>
                </div>
                </>
              ) : (
                <>
                  <div className={styles.row}>
                    <span>Cash counted</span>
                    <strong>{formatKes(shift.cashCounted)}</strong>
                  </div>
                  <div className={styles.row}>
                    <span>Variance</span>
                    <strong>{formatKes(shift.cashVariance)}</strong>
                  </div>
                </>
              )}
            </div>
          )}
          {shiftError && <div className={styles.error}>{shiftError}</div>}
          {shiftMessage && <div className={styles.success}>{shiftMessage}</div>}
        </section>

        {/* Multi-Till Shift Summary for Managers */}
        {canManageOrders && shiftSummary && (
          <section className={`${styles.panel} ${styles.summaryPanel}`}>
            <div className={styles.panelHeader}>
              <h2>Today's Multi-Till Shift Summary</h2>
              <span>{shiftSummary.date}</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.summaryTable}>
                <thead>
                  <tr>
                    <th>Cashier</th>
                    <th>Status</th>
                    <th>Float</th>
                    <th>Expected</th>
                    <th>Counted</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftSummary.shifts.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.cashierName}</strong></td>
                      <td><span className={s.status === 'open' ? styles.statusOpen : styles.statusClosed}>{s.status.toUpperCase()}</span></td>
                      <td>{formatKes(s.openingFloat)}</td>
                      <td>{formatKes(s.currentCashSalesExpected ?? s.cashSalesExpected)}</td>
                      <td>{s.cashCounted !== null ? formatKes(s.cashCounted) : '-'}</td>
                      <td className={Number(s.cashVariance) < 0 ? styles.varNeg : styles.varOk}>
                        {s.cashVariance !== null ? formatKes(s.cashVariance) : '-'}
                      </td>
                    </tr>
                  ))}
                  {shiftSummary.shifts.length === 0 && (
                    <tr><td colSpan="6" className={styles.empty}>No shifts recorded today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {shiftSummary.totals && (
              <div className={styles.summaryTotalsRow}>
                <div><span>Total Floats:</span> <strong>{formatKes(shiftSummary.totals.totalFloats)}</strong></div>
                <div><span>Total Cash Expected:</span> <strong>{formatKes(shiftSummary.totals.totalExpectedCash)}</strong></div>
                <div><span>Total Counted:</span> <strong>{formatKes(shiftSummary.totals.totalCashCounted)}</strong></div>
                <div><span>Total Variance:</span> <strong className={Number(shiftSummary.totals.totalVariance) < 0 ? styles.varNeg : styles.varOk}>{formatKes(shiftSummary.totals.totalVariance)}</strong></div>
              </div>
            )}
          </section>
        )}

        {/* Receipt search */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Receipt search</h2>
            <span>{orders.length}</span>
          </div>
          <div className={styles.searchBar}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Receipt number..."
            />
            <button type="button" onClick={() => searchOrders()}>Search</button>
          </div>
          <div className={styles.orderList}>
            {orders.map((order) => (
              <button key={order.id} type="button" onClick={() => loadReceipt(order.id)}>
                <span>
                  <strong>{order.orderNumber}</strong>
                  <small>{order.status} - {order.paymentStatus}</small>
                </span>
                <b>{formatKes(order.total)}</b>
              </button>
            ))}
          </div>
          {orderError && <div className={styles.error}>{orderError}</div>}
        </section>

        {/* Receipt Details */}
        <section className={`${styles.panel} ${styles.receiptPanel}`}>
          <div className={styles.panelHeader}>
            <h2>Receipt</h2>
            {receipt && <span>{receipt.status}</span>}
          </div>
          {!receipt ? (
            <p className={styles.empty}>Select an order to view the receipt.</p>
          ) : (
            <div className={styles.receipt}>
              <div className={styles.receiptTop}>
                <strong>{receipt.business.name}</strong>
                <span>{receipt.orderNumber}</span>
                <small>{formatDate(receipt.createdAt)}</small>
              </div>
              <div className={styles.receiptLines}>
                {receipt.items.map((item) => (
                  <div className={styles.receiptLine} key={item.id}>
                    <span>{item.name} x {item.quantity}</span>
                    <b>{formatKes(item.lineTotal)}</b>
                  </div>
                ))}
              </div>
              <div className={styles.totals}>
                <div><span>Subtotal</span><b>{formatKes(receipt.subtotal)}</b></div>
                <div><span>VAT</span><b>{formatKes(receipt.taxTotal)}</b></div>
                <div><span>Discount</span><b>{formatKes(receipt.discountTotal)}</b></div>
                <div className={styles.grand}><span>Total</span><b>{formatKes(receipt.total)}</b></div>
              </div>
              <div className={styles.paymentList}>
                {receipt.payments.map((payment) => (
                  <div key={payment.id}>
                    {payment.method} - {payment.status} - {formatKes(payment.amount)}
                  </div>
                ))}
              </div>
              {canManageOrders && ['completed', 'partial_refund'].includes(receipt.status) && (
                <div className={styles.actionBox}>
                  <input
                    value={actionReason}
                    onChange={(event) => setActionReason(event.target.value)}
                    placeholder="Reason for action"
                  />
                  <div className={styles.actionButtons}>
                    <button type="button" onClick={() => orderAction('void')}>Full Void</button>
                    <button type="button" onClick={() => orderAction('refund')}>Full Refund</button>
                  </div>

                  {/* Partial Refund Section */}
                  <div className={styles.partialRefundBox}>
                    <small>Select line items to return:</small>
                    {receipt.items.map((item) => (
                      <div key={item.id} className={styles.partialRow}>
                        <span>{item.name} (Max {item.quantity})</span>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          placeholder="0"
                          id={`refund-qty-${item.id}`}
                          className={styles.partialInput}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.partialBtn}
                      onClick={async () => {
                        const itemsToRefund = receipt.items.map((item) => {
                          const val = Number(document.getElementById(`refund-qty-${item.id}`)?.value || 0);
                          return val > 0 ? { orderItemId: item.id, quantity: val } : null;
                        }).filter(Boolean);

                        if (itemsToRefund.length === 0) {
                          alert('Please enter a quantity for at least one item to refund');
                          return;
                        }

                        try {
                          await api(`/api/orders/${receipt.id}/refund/partial`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: itemsToRefund, reason: actionReason })
                          });
                          await loadReceipt(receipt.id);
                          setActionReason('');
                          alert('Partial refund completed successfully');
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      Partial Refund Selected
                    </button>
                  </div>
                </div>
              )}
              <button className={styles.printBtn} type="button" onClick={() => window.print()}>
                Print
              </button>
            </div>
          )}
        </section>

        {/* Audit Trail */}
        {canViewAudit && (
          <section className={`${styles.panel} ${styles.auditPanel}`}>
            <div className={styles.panelHeader}>
              <h2>Recent audit trail</h2>
              <span>{auditLogs.length}</span>
            </div>
            <div className={styles.auditList}>
              {auditLogs.map((entry) => (
                <div className={styles.auditRow} key={entry.id}>
                  <span>
                    <strong>{entry.action}</strong>
                    <small>
                      {entry.actor?.name || 'System'}
                      {entry.approver && entry.approver.id !== entry.actor?.id
                        ? ` approved by ${entry.approver.name}`
                        : ''}
                    </small>
                  </span>
                  <time>{formatDate(entry.createdAt)}</time>
                </div>
              ))}
              {auditLogs.length === 0 && !auditError && (
                <p className={styles.empty}>No audit events yet.</p>
              )}
              {auditError && <div className={styles.error}>{auditError}</div>}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
