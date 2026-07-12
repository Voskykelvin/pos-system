import { useEffect, useState } from 'react';
import styles from './Operations.module.css';
import {
  formatHeldSaleAge,
  heldSalesStorageKey,
  isHeldSaleStale
} from '../utils/heldSaleState.mjs';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function loadHeldSales(user) {
  try {
    const raw = localStorage.getItem(heldSalesStorageKey(user));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const [heldSales, setHeldSales] = useState([]);
  const [etimsDashboard, setEtimsDashboard] = useState(null);
  const [etimsError, setEtimsError] = useState(null);
  const [etimsBusy, setEtimsBusy] = useState(false);

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

  async function loadEtimsDashboard() {
    if (!canManageOrders) return;
    try {
      const payload = await api('/api/etims/dashboard');
      setEtimsDashboard(payload);
      setEtimsError(null);
    } catch (err) {
      setEtimsError(err.message);
    }
  }

  async function runEtimsAction(action) {
    if (!canManageOrders) return;
    setEtimsBusy(true);
    try {
      const path = action === 'requeue' ? '/api/etims/requeue-failed' : '/api/etims/sync';
      const payload = await api(path, { method: 'POST' });
      const message = action === 'requeue'
        ? `Requeued ${payload.requeued || 0} failed eTIMS invoice${payload.requeued === 1 ? '' : 's'}.`
        : `eTIMS sync: ${payload.transmitted || 0} transmitted, ${payload.failed || 0} failed, ${payload.skipped || 0} queued for retry.`;
      setShiftMessage(message);
      setEtimsError(null);
      await loadEtimsDashboard();
    } catch (err) {
      setEtimsError(err.message);
    } finally {
      setEtimsBusy(false);
    }
  }

  async function syncAndRefreshReceipt() {
    if (!receipt?.id) return;
    await runEtimsAction('sync');
    await loadReceipt(receipt.id);
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
      const status = await api('/api/etims/status');
      if ((Number(status.queued || 0) > 0 || Number(status.failed || 0) > 0)) {
        const proceed = window.confirm(
          `eTIMS has ${status.queued || 0} queued and ${status.failed || 0} failed invoice(s). ` +
          'Close this shift anyway?'
        );
        if (!proceed) return;
      }
    } catch {
      const proceed = window.confirm('Could not check eTIMS invoice status. Close this shift anyway?');
      if (!proceed) return;
    }
    if (heldSales.length > 0) {
      const oldest = heldSales[heldSales.length - 1];
      const proceed = window.confirm(
        `There ${heldSales.length === 1 ? 'is' : 'are'} ${heldSales.length} held sale${heldSales.length === 1 ? '' : 's'} on this till. ` +
        `Oldest: ${formatHeldSaleAge(oldest)}. Close shift anyway?`
      );
      if (!proceed) return;
    }
    try {
      const payload = await api(`/api/shifts/${shift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashCounted })
      });
      setShift(payload);
      setCashCounted('');
      setShiftMessage(payload.etimsWarning ? `Shift closed. ${payload.etimsWarning.message}` : 'Shift closed.');
      setShiftError(null);
      await loadAuditLogs();
      await loadShiftSummary();
      await loadEtimsDashboard();
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
    loadEtimsDashboard();
  }, [authToken, canViewAudit, canManageOrders]);

  useEffect(() => {
    const refreshHeldSales = () => setHeldSales(loadHeldSales(user));
    refreshHeldSales();
    window.addEventListener('focus', refreshHeldSales);
    window.addEventListener('storage', refreshHeldSales);
    return () => {
      window.removeEventListener('focus', refreshHeldSales);
      window.removeEventListener('storage', refreshHeldSales);
    };
  }, [user?.id, user?.tenantId]);

  const staleHeldSales = heldSales.filter((sale) => isHeldSaleStale(sale));
  const etimsSummary = etimsDashboard?.summary || {};
  const etimsReadiness = etimsDashboard?.readiness || {};

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
                  {heldSales.length > 0 && (
                    <div className={staleHeldSales.length > 0 ? styles.heldSaleWarning : styles.heldSaleNotice}>
                      <strong>{heldSales.length} held sale{heldSales.length === 1 ? '' : 's'} still parked on this till.</strong>
                      <span>
                        {staleHeldSales.length > 0
                          ? `${staleHeldSales.length} held sale${staleHeldSales.length === 1 ? '' : 's'} older than 30 minutes.`
                          : `Oldest held sale is ${formatHeldSaleAge(heldSales[heldSales.length - 1])}.`}
                      </span>
                    </div>
                  )}
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
              <h2>Today&apos;s Multi-Till Shift Summary</h2>
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

        {canManageOrders && (
          <section className={`${styles.panel} ${styles.etimsPanel}`}>
            <div className={styles.panelHeader}>
              <h2>eTIMS control</h2>
              <span>{etimsReadiness.productionMode ? 'production' : (etimsReadiness.env || 'sandbox')}</span>
            </div>
            <div className={styles.etimsBody}>
              <div className={styles.etimsStats}>
                <div><span>Queued</span><strong>{etimsSummary.queued || 0}</strong></div>
                <div><span>Transmitted</span><strong>{etimsSummary.transmitted || 0}</strong></div>
                <div><span>Failed</span><strong>{etimsSummary.failed || 0}</strong></div>
                <div><span>Retrying</span><strong>{etimsSummary.retrying || 0}</strong></div>
              </div>
              <div className={styles.etimsReadiness}>
                <span className={etimsReadiness.sellerPinSet ? styles.readyPill : styles.blockedPill}>
                  Seller PIN {etimsReadiness.sellerPinSet ? 'set' : 'missing'}
                </span>
                <span className={etimsReadiness.deviceSerialSet ? styles.readyPill : styles.pendingPill}>
                  Device serial {etimsReadiness.deviceSerialSet ? 'set' : 'missing'}
                </span>
                <span className={etimsReadiness.baseUrlSet && etimsReadiness.apiKeySet ? styles.readyPill : styles.pendingPill}>
                  API {etimsReadiness.baseUrlSet && etimsReadiness.apiKeySet ? 'configured' : 'pending'}
                </span>
              </div>
              <div className={styles.etimsActions}>
                <button type="button" onClick={() => runEtimsAction('sync')} disabled={etimsBusy}>
                  Sync now
                </button>
                <button type="button" onClick={() => runEtimsAction('requeue')} disabled={etimsBusy || !etimsSummary.failed}>
                  Requeue failed
                </button>
                <button type="button" onClick={loadEtimsDashboard} disabled={etimsBusy}>
                  Refresh
                </button>
              </div>
              {etimsError && <div className={styles.error}>{etimsError}</div>}
              <div className={styles.etimsList}>
                {(etimsDashboard?.recent || []).length === 0 ? (
                  <p className={styles.empty}>No queued or failed eTIMS invoices need attention.</p>
                ) : (
                  etimsDashboard.recent.map((invoice) => (
                    <div className={styles.etimsRow} key={invoice.id}>
                      <div>
                        <strong>{invoice.orderNumber || invoice.orderId}</strong>
                        <small>
                          {invoice.status.toUpperCase()} - retry {invoice.retryCount}/{invoice.maxRetries}
                          {invoice.fiscalReady ? ' - fiscal ready' : ''}
                        </small>
                        {invoice.error && <small className={styles.etimsErrorText}>{invoice.error}</small>}
                      </div>
                      <b>{formatKes(invoice.orderTotal)}</b>
                    </div>
                  ))
                )}
              </div>
            </div>
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
                <b>{formatKes(order.netTotal ?? order.total)}</b>
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
                {receipt.business.receiptPolicy && <small>{receipt.business.receiptPolicy}</small>}
                <strong>{receipt.business.name}</strong>
                {receipt.business.kraPin && <small>PIN {receipt.business.kraPin}</small>}
                {receipt.branch && <small>{[receipt.branch.code, receipt.branch.name].filter(Boolean).join(' - ')}</small>}
                {receipt.branch?.phone && <small>Tel {receipt.branch.phone}</small>}
                <span>{receipt.orderNumber}</span>
                <small>{formatDate(receipt.createdAt)}</small>
                <small>Served by {receipt.cashier?.name || 'Cashier'}</small>
                <small>
                  {receipt.etims?.fiscalReady ? 'Fiscal ready' : `${receipt.etims?.status || 'eTIMS pending'} - CU/QR pending`}
                </small>
              </div>
              <div className={styles.receiptLines}>
                {receipt.items.map((item) => (
                  <div className={styles.receiptLine} key={item.id}>
                    <span>
                      {item.name} x {item.quantity}
                      <small>{item.itemCode || item.barcode || item.sku || '-'} - VAT {(Number(item.taxRate || 0) * 100).toFixed(0)}%</small>
                      {item.refundedQuantity > 0 && <small>Returned {item.refundedQuantity}; remaining {item.refundableQuantity}</small>}
                    </span>
                    <b>{formatKes(item.lineTotal)}</b>
                  </div>
                ))}
              </div>
              <div className={styles.totals}>
                <div><span>Total items sold</span><b>{receipt.itemCount || receipt.items.length}</b></div>
                <div><span>Before VAT</span><b>{formatKes(receipt.subtotal)}</b></div>
                <div><span>VAT included</span><b>{formatKes(receipt.taxTotal)}</b></div>
                <div><span>Discount</span><b>{formatKes(receipt.discountTotal)}</b></div>
                <div className={styles.grand}><span>Total</span><b>{formatKes(receipt.total)}</b></div>
                {receipt.refundedTotal > 0 && <div><span>Refunded</span><b>-{formatKes(receipt.refundedTotal)}</b></div>}
                {receipt.refundedTotal > 0 && <div className={styles.grand}><span>Net sale</span><b>{formatKes(receipt.netTotal)}</b></div>}
              </div>
              {receipt.refunds?.length > 0 && (
                <div className={styles.paymentList}>
                  <strong>Refund history</strong>
                  {receipt.refunds.map((refund) => (
                    <div key={refund.id}>
                      {formatDate(refund.createdAt)} - {refund.type} - {formatKes(refund.total)}
                      {refund.reason ? ` - ${refund.reason}` : ''}
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.paymentList}>
                {receipt.payments.map((payment) => (
                  <div key={payment.id}>
                    {payment.method} - {payment.status} - {formatKes(payment.method === 'cash' ? receipt.tender?.amountTendered || payment.amount : payment.amount)}
                  </div>
                ))}
                {Number(receipt.tender?.changeDue || 0) > 0 && (
                  <div>change - {formatKes(receipt.tender.changeDue)}</div>
                )}
              </div>
              <div className={styles.receiptFiscal}>
                <div><span>eTIMS</span><b>{receipt.etims?.status || 'pending'}</b></div>
                <div><span>CU serial</span><b>{receipt.etims?.deviceSerial || 'pending'}</b></div>
                <div><span>CU invoice</span><b>{receipt.etims?.cuInvoiceNumber || 'pending'}</b></div>
                <div><span>Receipt no</span><b>{receipt.orderNumber}</b></div>
                <div><span>QR</span><b>{receipt.etims?.qrCodeUrl ? 'available' : 'pending'}</b></div>
                {receipt.etims?.qrCodeUrl && (
                  <img src={receipt.etims.qrCodeUrl} alt="eTIMS QR code" />
                )}
              </div>
              {canManageOrders && ['completed', 'partial_refund'].includes(receipt.status) && (
                <div className={styles.actionBox}>
                  <input
                    value={actionReason}
                    onChange={(event) => setActionReason(event.target.value)}
                    placeholder="Reason for action"
                  />
                  {receipt.status === 'completed' && (
                    <div className={styles.actionButtons}>
                      <button type="button" onClick={() => orderAction('void')}>Full Void</button>
                      <button type="button" onClick={() => orderAction('refund')}>Full Refund</button>
                    </div>
                  )}

                  {/* Partial Refund Section */}
                  <div className={styles.partialRefundBox}>
                    <small>Select line items to return:</small>
                    {receipt.items.map((item) => (
                      <div key={item.id} className={styles.partialRow}>
                        <span>{item.name} (Remaining {item.refundableQuantity ?? item.quantity})</span>
                        <input
                          type="number"
                          min="0"
                          max={item.refundableQuantity ?? item.quantity}
                          disabled={(item.refundableQuantity ?? item.quantity) <= 0}
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
                          setOrderError('Please enter a quantity for at least one item to refund.');
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
                          setOrderError(null);
                          setShiftMessage('Partial refund completed successfully.');
                        } catch (err) {
                          setOrderError(err.message);
                        }
                      }}
                    >
                      Partial Refund Selected
                    </button>
                  </div>
                </div>
              )}
              {canManageOrders && !receipt.etims?.fiscalReady && (
                <button className={styles.secondaryPrintBtn} type="button" onClick={syncAndRefreshReceipt} disabled={etimsBusy}>
                  Sync eTIMS and refresh receipt
                </button>
              )}
              <button className={styles.printBtn} type="button" onClick={() => window.print()}>
                {receipt.etims?.fiscalReady ? 'Reprint fiscal receipt' : 'Print sales copy'}
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
