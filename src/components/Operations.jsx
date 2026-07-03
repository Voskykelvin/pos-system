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
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditError, setAuditError] = useState(null);

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
    } catch (err) {
      setShiftError(err.message);
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
      const payload = await api('/api/audit-logs?limit=20');
      setAuditLogs(payload);
      setAuditError(null);
    } catch (err) {
      setAuditError(err.message);
    }
  }

  async function orderAction(action) {
    if (!receipt?.id) return;
    try {
      const payload = await api(`/api/orders/${receipt.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionReason || `Order ${action}` })
      });
      await loadReceipt(payload.orderId);
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
  }, [authToken, canViewAudit]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Operations</h1>
          <p>Shift control, cash reconciliation, and receipt lookup.</p>
        </div>
      </header>

      <div className={styles.grid}>
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
              {shift.status === 'open' ? (
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
