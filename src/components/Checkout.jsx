'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Checkout.module.css';
import { addOrderToQueue, getCachedCatalog, cacheCatalog } from '../utils/offlineQueue';
import {
  createHeldSaleSnapshot,
  formatHeldSaleAge,
  heldSalesStorageKey,
  insertHeldSale
} from '../utils/heldSaleState.mjs';

function Toast({ message, tone, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`${styles.toast} ${tone === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button type="button" onClick={onClose} className={styles.toastClose}>x</button>
    </div>
  );
}

const VAT_RATES = { standard: 0.16, zero_rated: 0, exempt: 0 };
const SCAN_CODE_PATTERN = /^[A-Za-z0-9._-]{4,}$/;

function formatKes(amount) {
  return `KES ${Number(amount).toFixed(2)}`;
}

function createClientIdempotencyKey(prefix) {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
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

function saveHeldSales(user, heldSales) {
  try {
    localStorage.setItem(heldSalesStorageKey(user), JSON.stringify(heldSales));
  } catch {
    // If local storage is full or blocked, the in-memory state still works for this tab.
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Customer search panel ----------------------------------------------------
function CustomerPanel({ authToken, customer, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const h = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(h);
  }, [authToken, query]);

  async function handleCreate() {
    if (!newPhone && !newName) return;
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: newName, phone: newPhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSelect(data);
      setCreating(false);
      setQuery('');
      setResults([]);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (customer) {
    return (
      <div className={styles.customerChip}>
        <div className={styles.customerInfo}>
          <span className={styles.customerName}>{customer.name || customer.phone}</span>
          {customer.loyaltyPoints > 0 && (
            <span className={styles.loyaltyBadge}>{customer.loyaltyPoints} pts</span>
          )}
        </div>
        <button className={styles.customerClear} onClick={onClear} type="button">x</button>
      </div>
    );
  }

  return (
    <div className={styles.customerPanel}>
      {!creating ? (
        <>
          <input
            className={styles.customerSearch}
            type="text"
            placeholder="Search customer by phone or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div className={styles.customerResults}>
              {results.map((c) => (
                <button
                  key={c.id}
                  className={styles.customerResult}
                  onClick={() => { onSelect(c); setQuery(''); setResults([]); }}
                  type="button"
                >
                  <span>{c.name || '-'}</span>
                  <span className={styles.customerPhone}>{c.phone}</span>
                  {c.loyaltyPoints > 0 && <span className={styles.loyaltySmall}>{c.loyaltyPoints} pts</span>}
                </button>
              ))}
              <button className={styles.customerNewBtn} onClick={() => setCreating(true)} type="button">
                + Add as new customer
              </button>
            </div>
          )}
          {query.trim().length >= 3 && results.length === 0 && (
            <div className={styles.customerResults}>
              <button className={styles.customerNewBtn} onClick={() => { setCreating(true); setNewPhone(query.trim()); }} type="button">
                + No match - add as new customer
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.customerCreate}>
          <input className={styles.customerSearch} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className={styles.customerSearch} placeholder="Phone (07XX...)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <div className={styles.customerCreateActions}>
            <button className={styles.customerSaveBtn} onClick={handleCreate} disabled={saving} type="button">
              {saving ? 'Saving...' : 'Save customer'}
            </button>
            <button className={styles.customerCancelBtn} onClick={() => setCreating(false)} type="button">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Split-tender payments panel ----------------------------------------------
function PaymentsPanel({ total, payments, onChange, customer }) {
  function addRow(method) {
    const existingSum = payments.filter((p) => p.method !== method).reduce((s, p) => s + Number(p.amount || 0), 0);
    const remaining = Math.max(total - existingSum, 0);
    onChange([...payments, { method, amount: remaining.toFixed(2), mpesaPhone: '' }]);
  }

  function removeRow(idx) {
    onChange(payments.filter((_, i) => i !== idx));
  }

  function updateRow(idx, field, value) {
    onChange(payments.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function distributeEvenly() {
    const share = (total / payments.length).toFixed(2);
    onChange(payments.map((p) => ({ ...p, amount: share })));
  }

  const paymentSum = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = Number((total - paymentSum).toFixed(2));

  const canAddCash  = !payments.find((p) => p.method === 'cash');
  const canAddMpesa = !payments.find((p) => p.method === 'mpesa');
  const canAddCredit = customer && !payments.find((p) => p.method === 'credit');

  return (
    <div className={styles.paymentsPanel}>
      <div className={styles.paymentsPanelHeader}>
        <span className={styles.paymentsPanelTitle}>Payment</span>
        {payments.length > 1 && (
          <button className={styles.splitEvenBtn} onClick={distributeEvenly} type="button">Split evenly</button>
        )}
      </div>

      {payments.map((p, idx) => (
        <div key={idx} className={styles.paymentRow}>
          <span className={`${styles.paymentMethodBadge} ${styles[p.method]}`}>
            {p.method === 'cash' ? 'Cash' : p.method === 'mpesa' ? 'M-Pesa' : 'Credit'}
          </span>
          <input
            className={styles.paymentAmountInput}
            type="number"
            min="0"
            step="0.01"
            value={p.amount}
            onChange={(e) => updateRow(idx, 'amount', e.target.value)}
          />
          {p.method === 'mpesa' && (
            <input
              className={styles.paymentPhoneInput}
              type="tel"
              placeholder="07XX XXX XXX"
              value={p.mpesaPhone}
              onChange={(e) => updateRow(idx, 'mpesaPhone', e.target.value)}
            />
          )}
          {payments.length > 1 && (
            <button className={styles.paymentRemoveBtn} onClick={() => removeRow(idx)} type="button">x</button>
          )}
        </div>
      ))}

      {remaining > 0 && (
        <div className={styles.addPaymentOptions}>
          {canAddCash && <button onClick={() => addRow('cash')} type="button">+ Cash</button>}
          {canAddMpesa && <button onClick={() => addRow('mpesa')} type="button">+ M-Pesa</button>}
          {canAddCredit && <button onClick={() => addRow('credit')} type="button">+ Credit</button>}
        </div>
      )}

      {remaining > 0 && <div className={styles.remainingWarn}>Remaining: {formatKes(remaining)}</div>}
      {remaining < 0 && payments.some(p => p.method === 'cash') && (
        <div className={styles.changeDue}>Change due: {formatKes(Math.abs(remaining))}</div>
      )}

      {/* Cash-specific: cash chips + change */}
      {payments.length === 1 && payments[0].method === 'cash' && (
        <div className={styles.cashBox}>
          <label className={styles.cashLabel} htmlFor="cashReceived">Cash received</label>
          <input
            id="cashReceived"
            className={styles.phoneInput}
            type="number"
            min="0"
            step="1"
            value={payments[0].amount}
            onChange={(e) => updateRow(0, 'amount', e.target.value)}
            placeholder="0.00"
          />
          <div className={styles.cashChips}>
            {[total, 500, 1000, 2000].map((amt) => (
              <button
                key={amt}
                type="button"
                className={styles.cashChip}
                onClick={() => updateRow(0, 'amount', String(Math.ceil(amt)))}
              >
                {formatKes(Math.ceil(amt))}
              </button>
            ))}
          </div>
          {(() => {
            const cashVal = Number(payments[0].amount || 0);
            const change = cashVal - total;
            return (
              <div className={`${styles.totalsRow} ${styles.changeRow}`}>
                <span>{change < 0 ? 'Short' : 'Change'}</span>
                <span>{formatKes(Math.abs(change))}</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// --- Main Checkout component --------------------------------------------------
export default function Checkout({ authToken, cashierId, user }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [isWholesale, setIsWholesale] = useState(false);
  const [customer, setCustomer] = useState(null);

  // Payments: array of { method, amount, mpesaPhone }
  const [payments, setPayments] = useState([{ method: 'cash', amount: '0', mpesaPhone: '' }]);

  const [discountTotal, setDiscountTotal] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null); // { discountAmount, code, description } | null
  const [promoError, setPromoError] = useState(null);
  const [promoChecking, setPromoChecking] = useState(false);

  const [redeemLoyalty, setRedeemLoyalty] = useState(false);

  const [managerIdentifier, setManagerIdentifier] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [toast, setToast] = useState(null);
  const [heldSales, setHeldSales] = useState(() => loadHeldSales(user));
  const [holdNote, setHoldNote] = useState('');
  const pollRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    saveHeldSales(user, heldSales);
  }, [heldSales, user?.id, user?.tenantId]);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        productId: product.id,
        name: product.name,
        unitPrice: isWholesale ? Number(product.wholesalePrice || product.sellingPrice) : Number(product.sellingPrice),
        quantity: 1,
        taxCategory: product.Category?.taxCategory || 'standard'
      }];
    });
    setQuery('');
    setResults([]);
    setOrderStatus(null);
    setLastReceipt(null);
    setStatusMessage(null);
    setToast(null);
  }, [isWholesale]);

  const lookupProducts = useCallback(async (term, { preferBarcode = false, exactCode = false } = {}) => {
    const normalized = term.trim();
    if (!normalized) return [];

    let data = [];
    if (!navigator.onLine) {
      const cached = await getCachedCatalog();
      const lowered = normalized.toLowerCase();
      data = cached.filter((p) => {
        const barcode = p.barcode || '';
        const sku = p.sku || '';
        if (exactCode) return barcode === normalized || sku === normalized;
        return (
          p.name.toLowerCase().includes(lowered) ||
          barcode.toLowerCase().includes(lowered) ||
          sku.toLowerCase().includes(lowered)
        );
      });
    } else {
      if (preferBarcode) {
        const res = await fetch(`/api/products/search?barcode=${encodeURIComponent(normalized)}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        data = await res.json();
      }

      if ((!Array.isArray(data) || data.length === 0) && normalized.length >= 2) {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(normalized)}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        data = await res.json();
        if (exactCode && Array.isArray(data)) {
          data = data.filter((p) => p.barcode === normalized || p.sku === normalized);
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        await cacheCatalog(data);
      }
    }

    return Array.isArray(data) ? data : [];
  }, [authToken]);

  const addScannedProduct = useCallback(async (code) => {
    const normalized = code.trim();
    if (!SCAN_CODE_PATTERN.test(normalized)) return false;

    const data = await lookupProducts(normalized, { preferBarcode: true, exactCode: true });
    if (data.length === 0) return false;
    addToCart(data[0]);
    return true;
  }, [addToCart, lookupProducts]);

  // Debounced product search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(async () => {
      try {
        const term = query.trim();
        const data = await lookupProducts(term, { preferBarcode: /^\d{6,}$/.test(term) });
        setResults(data);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(h);
  }, [lookupProducts, query]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // --- Global Hardware Barcode Scanner Auto-Listener -------------------------
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e) => {
      // Ignore if user is actively typing inside an input element
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        const barcode = buffer.trim();
        buffer = '';
        if (SCAN_CODE_PATTERN.test(barcode)) {
          e.preventDefault();
          try { await addScannedProduct(barcode); } catch { /* ignore scan error */ }
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addScannedProduct]);

  // Sync payment total with cart total whenever total changes
  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const taxTotal = cart.reduce((sum, i) => {
    const rate = VAT_RATES[i.taxCategory] ?? 0.16;
    return sum + i.unitPrice * i.quantity * rate;
  }, 0);
  const discountValue = Number(discountTotal || 0);
  const promoDiscount = promoResult ? Number(promoResult.discountAmount) : 0;
  const loyaltyDiscount = redeemLoyalty && customer?.loyaltyPoints > 0 ? Math.floor(customer.loyaltyPoints / 100) : 0;
  const total = Math.max(subtotal + taxTotal - discountValue - promoDiscount - loyaltyDiscount, 0);

  // When total changes and there's a single payment row, auto-update its amount
  useEffect(() => {
    if (payments.length === 1 && payments[0].method === 'cash') {
      setPayments((prev) => [{ ...prev[0], amount: total.toFixed(2) }]);
    }
  }, [total, payments.length]);

  function changeQty(productId, delta) {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function holdCurrentSale() {
    if (cart.length === 0) return;
    if (orderStatus === 'waiting') {
      setError('This sale already has a pending M-Pesa request. Finish or retry it before holding another sale.');
      showToast('Finish the pending M-Pesa request first.', 'error');
      return;
    }

    const snapshot = createHeldSaleSnapshot({
      cashierId,
      cashierName: user?.name,
      cart,
      payments,
      customer,
      discountTotal,
      promoCode,
      promoResult,
      redeemLoyalty,
      isWholesale,
      note: holdNote,
      total
    });

    setHeldSales((current) => insertHeldSale(current, snapshot));
    resetSale({ clearReceipt: true });
    setStatusMessage('Sale held. You can recall it from the held sales list.');
    showToast('Sale held.');
  }

  function resumeHeldSale(heldSale) {
    if (cart.length > 0) {
      const replace = window.confirm('Replace the current sale with this held sale?');
      if (!replace) return;
    }

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setCart(heldSale.cart || []);
    setPayments(heldSale.payments?.length ? heldSale.payments : [{ method: 'cash', amount: '0', mpesaPhone: '' }]);
    setCustomer(heldSale.customer || null);
    setDiscountTotal(heldSale.discountTotal || '');
    setPromoCode(heldSale.promoCode || '');
    setPromoResult(heldSale.promoResult || null);
    setPromoError(null);
    setRedeemLoyalty(Boolean(heldSale.redeemLoyalty));
    setIsWholesale(Boolean(heldSale.isWholesale));
    setManagerIdentifier('');
    setManagerPassword('');
    setHoldNote(heldSale.note || '');
    setError(null);
    setOrderStatus(null);
    setLastReceipt(null);
    setStatusMessage('Held sale recalled.');
    setToast(null);
    setHeldSales((current) => current.filter((sale) => sale.id !== heldSale.id));
    showToast('Held sale recalled.');
  }

  function removeHeldSale(heldSaleId) {
    setHeldSales((current) => current.filter((sale) => sale.id !== heldSaleId));
    showToast('Held sale removed.');
  }

  async function checkPromo() {
    if (!promoCode.trim()) return;
    setPromoChecking(true);
    setPromoError(null);
    setPromoResult(null);
    setStatusMessage('Checking promo code...');
    showToast('Checking promo code...');
    try {
      const res = await fetch(
        `/api/promotions/validate?code=${encodeURIComponent(promoCode.trim())}&orderTotal=${total.toFixed(2)}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPromoResult(data);
      setStatusMessage(`Promo applied: ${data.code}`);
      showToast(`Promo applied: ${data.code}`);
    } catch (err) {
      setPromoError(err.message);
      setStatusMessage(null);
      showToast(err.message, 'error');
    } finally {
      setPromoChecking(false);
    }
  }

  const discountNeedsApproval = discountValue > 0 && user?.role === 'cashier';

  const pollOrderStatus = useCallback((orderId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, { headers: { Authorization: `Bearer ${authToken}` } });
        const data = await res.json();
        if (data.paymentStatus === 'paid') {
          clearInterval(pollRef.current);
          setOrderStatus('paid');
          setLastReceipt({
            orderId,
            orderNumber: data.orderNumber,
            total: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
            changeDue: 0
          });
          resetSale();
          setStatusMessage('Sale completed successfully.');
          showToast('Sale completed successfully.');
        } else if (data.payments?.some((p) => p.status === 'failed')) {
          clearInterval(pollRef.current);
          setOrderStatus('failed');
        }
      } catch { /* keep polling on transient errors */ }
    }, 3000);
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setOrderStatus((s) => s === 'waiting' ? 'failed' : s);
    }, 120000);
  }, [authToken]);

  function resetSale({ clearReceipt = false } = {}) {
    setCart([]);
    setPayments([{ method: 'cash', amount: '0', mpesaPhone: '' }]);
    setDiscountTotal('');
    setPromoCode('');
    setPromoResult(null);
    setPromoError(null);
    setRedeemLoyalty(false);
    setHoldNote('');
    setManagerIdentifier('');
    setManagerPassword('');
    setCustomer(null);
    setError(null);
    setOrderStatus(null);
    if (clearReceipt) setLastReceipt(null);
  }

  async function handleConfirm() {
    if (cart.length === 0) {
      setError('Add at least one item before confirming the sale.');
      return;
    }
    if (!paymentsBalanced) {
      setError('Payment amount must match the total before checkout.');
      return;
    }
    if (!mpesaComplete) {
      setError('Enter a valid phone number for each M-Pesa payment.');
      return;
    }
    if (discountNeedsApproval && !(managerIdentifier.trim() && managerPassword.trim())) {
      setError('Manager approval is required for this discount.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setStatusMessage('Processing sale...');
    showToast('Processing sale...');

    const paymentPayload = payments.map((p) => ({
      method: p.method,
      amount: Number(Number(p.amount).toFixed(2)),
      ...(p.method === 'mpesa' ? { mpesaPhone: p.mpesaPhone } : {})
    }));

    const orderPayload = {
      cashierId,
      customerId: customer?.id || undefined,
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      payments: paymentPayload,
      discountTotal: discountValue,
      promotionCode: promoResult ? promoCode.trim() : undefined,
      redeemPoints: redeemLoyalty && customer ? customer.loyaltyPoints : 0,
      managerApproval: discountNeedsApproval ? { identifier: managerIdentifier, password: managerPassword } : undefined
    };
    const checkoutIdempotencyKey = createClientIdempotencyKey('checkout');

    if (!navigator.onLine) {
      if (payments.some((p) => p.method === 'mpesa')) {
        setError('M-Pesa payments require an active internet connection.');
        setStatusMessage(null);
        showToast('M-Pesa payments require an active internet connection.', 'error');
        setSubmitting(false);
        return;
      }
      try {
        await addOrderToQueue({ ...orderPayload, idempotencyKey: checkoutIdempotencyKey });
        const cashPayment = payments.find((p) => p.method === 'cash');
        const changeDue = cashPayment ? Math.max(Number(cashPayment.amount) - total, 0) : 0;
        setOrderStatus('paid');
        setLastReceipt({ orderNumber: 'OFFLINE-' + Date.now().toString().slice(-4), total, changeDue });
        setStatusMessage('Sale queued offline and will sync automatically.');
        showToast('Sale queued offline and will sync automatically.');
        resetSale();
      } catch (err) {
        setError('Failed to queue offline order: ' + err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': checkoutIdempotencyKey
        },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      const hasMpesa = payments.some((p) => p.method === 'mpesa');

      if (!hasMpesa) {
        // All cash
        const cashPayment = payments.find((p) => p.method === 'cash');
        const changeDue = cashPayment ? Math.max(Number(cashPayment.amount) - total, 0) : 0;
        setOrderStatus('paid');
        setLastReceipt({ orderId: data.orderId, orderNumber: data.orderNumber, total: data.total, changeDue });
        setStatusMessage('Sale completed successfully.');
        showToast('Sale completed successfully.');
        resetSale();
        setSubmitting(false);
        return;
      }

      // Has M-Pesa payment(s) - trigger STK push
      setOrderStatus('waiting');
      setStatusMessage(null);
      const mpesaPayment = data.payments.find((p) => p.method === 'mpesa');
      const mpesaPhone = payments.find((p) => p.method === 'mpesa')?.mpesaPhone;

      const stkRes = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': createClientIdempotencyKey('mpesa')
        },
        body: JSON.stringify({ paymentId: mpesaPayment.id, phone: mpesaPhone })
      });
      const stkData = await stkRes.json();

      if (!stkRes.ok) {
        setOrderStatus('failed');
        setError(stkData.error || 'STK push failed');
        setStatusMessage(null);
        showToast(stkData.error || 'STK push failed', 'error');
        setSubmitting(false);
        return;
      }

      pollOrderStatus(data.orderId);
      setSubmitting(false);
    } catch (err) {
      setError(err.message);
      setStatusMessage(null);
      showToast(err.message, 'error');
      setSubmitting(false);
    }
  }

  const paymentSum = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const mpesaRows = payments.filter((p) => p.method === 'mpesa');
  const mpesaComplete = mpesaRows.every((p) => p.mpesaPhone?.trim().length >= 9);
  const paymentsBalanced = Math.abs(paymentSum - total) <= 0.01;

  const canConfirm =
    cart.length > 0 &&
    cashierId &&
    !submitting &&
    orderStatus !== 'waiting' &&
    total > 0 &&
    paymentsBalanced &&
    mpesaComplete &&
    (!discountNeedsApproval || (managerIdentifier.trim() && managerPassword.trim()));
  const canHoldSale = cart.length > 0 && !submitting && orderStatus !== 'waiting';

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key === 'F4') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        if (canHoldSale) holdCurrentSale();
        return;
      }

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        if (canConfirm) handleConfirm();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  function showToast(message, tone = 'success') {
    setToast({ message, tone });
  }

  async function printLastReceipt() {
    if (!lastReceipt) return;

    let receipt = null;
    if (lastReceipt.orderId && navigator.onLine) {
      try {
        const res = await fetch(`/api/orders/${lastReceipt.orderId}/receipt`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (res.ok) receipt = data;
      } catch {
        receipt = null;
      }
    }

    const receiptNumber = receipt?.orderNumber || lastReceipt.orderNumber;
    const totalPaid = receipt?.total ?? lastReceipt.total;
    const rows = receipt?.items?.length
      ? receipt.items.map((item) => `
          <tr>
            <td>${escapeHtml(item.name)} x ${Number(item.quantity)}</td>
            <td>${formatKes(item.lineTotal)}</td>
          </tr>
        `).join('')
      : `<tr><td>Sale total</td><td>${formatKes(totalPaid)}</td></tr>`;

    const paymentRows = receipt?.payments?.length
      ? receipt.payments.map((payment) => `
          <tr>
            <td>${escapeHtml(payment.method)} ${escapeHtml(payment.status)}</td>
            <td>${formatKes(payment.amount)}</td>
          </tr>
        `).join('')
      : `<tr><td>Payment</td><td>${formatKes(totalPaid)}</td></tr>`;

    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      setError('Allow pop-ups for this site, then try printing the receipt again.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(receiptNumber)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 14px;
              font-family: "Courier New", monospace;
              color: #111827;
              background: #ffffff;
              font-size: 12px;
            }
            .receipt { width: 76mm; max-width: 100%; margin: 0 auto; }
            .center { text-align: center; }
            h1 { font-size: 16px; margin: 0 0 4px; }
            .muted { color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            td { padding: 3px 0; vertical-align: top; }
            td:last-child { text-align: right; white-space: nowrap; }
            .line { border-top: 1px dashed #111827; margin: 8px 0; }
            .total { font-size: 15px; font-weight: 800; }
            @media print {
              body { padding: 0; }
              .receipt { width: 76mm; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <div class="center">
              <h1>${escapeHtml(receipt?.business?.name || 'Jijenge POS')}</h1>
              ${receipt?.business?.kraPin ? `<div class="muted">KRA PIN: ${escapeHtml(receipt.business.kraPin)}</div>` : ''}
              <div class="muted">${escapeHtml(receiptNumber)}</div>
              <div class="muted">${escapeHtml(new Date(receipt?.createdAt || Date.now()).toLocaleString())}</div>
            </div>
            <div class="line"></div>
            <table>${rows}</table>
            <div class="line"></div>
            <table>
              <tr><td>Subtotal</td><td>${formatKes(receipt?.subtotal ?? totalPaid)}</td></tr>
              <tr><td>VAT</td><td>${formatKes(receipt?.taxTotal || 0)}</td></tr>
              <tr><td>Discount</td><td>${formatKes(receipt?.discountTotal || 0)}</td></tr>
              <tr class="total"><td>Total</td><td>${formatKes(totalPaid)}</td></tr>
              <tr><td>Change</td><td>${formatKes(lastReceipt.changeDue || 0)}</td></tr>
            </table>
            <div class="line"></div>
            <table>${paymentRows}</table>
            ${receipt?.etims?.cuInvoiceNumber ? `<div class="center muted">CU: ${escapeHtml(receipt.etims.cuInvoiceNumber)}</div>` : ''}
            <div class="line"></div>
            <div class="center">Thank you</div>
          </main>
          <script>
            window.addEventListener('load', () => {
              window.print();
              window.setTimeout(() => window.close(), 300);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className={styles.page}>
      {!navigator.onLine && (
        <div style={{ background: '#ef4444', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', gridColumn: '1 / -1' }}>
          OFFLINE MODE: Sales will be queued locally and synced when connection is restored. M-Pesa is disabled.
        </div>
      )}
      {/* Product search + grid */}
      <div className={styles.catalog}>
        <div className={styles.searchBar}>
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Scan barcode or search a product..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return;
              const added = await addScannedProduct(query);
              if (added) e.preventDefault();
            }}
            autoFocus
          />
        </div>
        <div className={styles.priceToggleRow}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={isWholesale}
              onChange={(e) => setIsWholesale(e.target.checked)}
            />
            Wholesale Pricing Mode
          </label>
        </div>

        {results.length === 0 ? (
          <p className={styles.emptyState}>
            {query.trim().length >= 2 ? 'No products found' : 'Start typing to find a product'}
          </p>
        ) : (
          <div className={styles.productGrid}>
            {results.map((product) => (
              <button key={product.id} className={styles.productCard} onClick={() => addToCart(product)}>
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className={styles.productImg} />
                )}
                <div className={styles.productName}>{product.name}</div>
                <div className={styles.productMeta}>
                  {isWholesale && product.wholesalePrice
                    ? <><del style={{fontSize: '10px'}}>{formatKes(product.sellingPrice)}</del> {formatKes(product.wholesalePrice)}</>
                    : formatKes(product.sellingPrice)} / {product.unit}
                </div>
                <div className={styles.stockMeta}>Stock: {Number(product.stockQuantity)} {product.unit}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart / receipt panel */}
      <div className={styles.cartPanel}>
        {/* Customer lookup */}
        <div className={styles.customerSection}>
          <CustomerPanel
            authToken={authToken}
            customer={customer}
            onSelect={setCustomer}
            onClear={() => { setCustomer(null); setRedeemLoyalty(false); }}
          />
          {customer && customer.loyaltyPoints > 0 && (
            <label className={styles.loyaltyRedeemBox}>
              <input
                type="checkbox"
                checked={redeemLoyalty}
                onChange={(e) => setRedeemLoyalty(e.target.checked)}
              />
              <span>Redeem {customer.loyaltyPoints} pts (-KES {Math.floor(customer.loyaltyPoints / 100).toFixed(2)})</span>
            </label>
          )}
        </div>

        <div className={styles.cartHeader}>
          <div>
            <h2 className={`${styles.heading} ${styles.cartTitle}`}>Current sale</h2>
            {cart.length > 0 && (
              <div className={styles.orderNumber}>{cart.length} item{cart.length !== 1 ? 's' : ''}</div>
            )}
          </div>
          <button className={styles.holdSaleBtn} type="button" onClick={holdCurrentSale} disabled={!canHoldSale} title="F2">
            Hold sale
          </button>
        </div>

        {cart.length > 0 && orderStatus !== 'waiting' && (
          <div className={styles.holdNoteBox}>
            <label>
              Hold note
              <input
                value={holdNote}
                onChange={(event) => setHoldNote(event.target.value)}
                placeholder="e.g. M-Pesa delay, customer fetching cash"
              />
            </label>
            <small>Press F2 to hold, F4 to scan/search, Ctrl+Enter to confirm.</small>
          </div>
        )}

        {heldSales.length > 0 && (
          <div className={styles.heldSales}>
            <div className={styles.heldSalesHeader}>
              <strong>Held sales</strong>
              <span>{heldSales.length}</span>
            </div>
            <div className={styles.heldSalesList}>
              {heldSales.map((heldSale) => (
                <div className={styles.heldSaleRow} key={heldSale.id}>
                  <button className={styles.heldSaleMain} type="button" onClick={() => resumeHeldSale(heldSale)}>
                    <strong>{heldSale.label}</strong>
                    <span>{formatKes(heldSale.total)} - {heldSale.itemCount} item{heldSale.itemCount === 1 ? '' : 's'} - {formatHeldSaleAge(heldSale)}</span>
                    <small>{[heldSale.note, heldSale.cashierName].filter(Boolean).join(' - ') || 'No note'}</small>
                  </button>
                  <button className={styles.heldSaleRemove} type="button" onClick={() => removeHeldSale(heldSale.id)}>
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.cartItems}>
          {cart.length === 0 ? (
            <p className={styles.cartEmpty}>Cart is empty. Add a product to start.</p>
          ) : (
            cart.map((item) => (
              <div className={styles.cartRow} key={item.productId}>
                <div>
                  <div className={styles.cartItemName}>{item.name}</div>
                  <button className={styles.removeBtn} onClick={() => removeItem(item.productId)}>Remove</button>
                </div>
                <div className={styles.qtyControls}>
                  <button className={styles.qtyBtn} onClick={() => changeQty(item.productId, -1)}>-</button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button className={styles.qtyBtn} onClick={() => changeQty(item.productId, 1)}>+</button>
                </div>
                <div className={styles.lineTotal}>{formatKes(item.unitPrice * item.quantity)}</div>
              </div>
            ))
          )}
        </div>

        <div className={styles.totalsBlock}>
          <div className={styles.totalsRow}><span>Subtotal</span><span>{formatKes(subtotal)}</span></div>
          <div className={styles.totalsRow}><span>VAT</span><span>{formatKes(taxTotal)}</span></div>

          {/* Manual discount */}
          <div className={styles.discountRow}>
            <span>Discount</span>
            <input
              type="number" min="0" step="1"
              value={discountTotal}
              onChange={(e) => setDiscountTotal(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Promo code */}
          <div className={styles.promoRow}>
            <input
              className={styles.promoInput}
              type="text"
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value); setPromoResult(null); setPromoError(null); }}
            />
            <button
              className={styles.promoApplyBtn}
              onClick={checkPromo}
              disabled={promoChecking || !promoCode.trim()}
              type="button"
            >
              {promoChecking ? '...' : 'Apply'}
            </button>
          </div>
          {promoResult && (
            <div className={styles.promoSuccess}>
              {promoResult.code}: -{formatKes(promoResult.discountAmount)} {promoResult.description && `(${promoResult.description})`}
            </div>
          )}
          {promoError && <div className={styles.promoError}>{promoError}</div>}

          <div className={`${styles.totalsRow} ${styles.grand}`}><span>Total</span><span>{formatKes(total)}</span></div>
        </div>

        {/* Split-tender payments */}
        <PaymentsPanel total={total} payments={payments} onChange={setPayments} customer={customer} />

        {/* Manager approval for discounts */}
        {discountNeedsApproval && (
          <div className={styles.approvalBox}>
            <label className={styles.cashLabel}>Manager approval</label>
            <input className={styles.phoneInput} value={managerIdentifier} onChange={(e) => setManagerIdentifier(e.target.value)} placeholder="Manager email or phone" />
            <input className={styles.phoneInput} type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} placeholder="Manager password" />
          </div>
        )}

        <button className={styles.confirmBtn} disabled={!canConfirm} onClick={handleConfirm}>
          {submitting ? 'Processing...' : `Confirm sale - ${formatKes(total)}`}
        </button>

        {orderStatus === 'waiting' && <div className={styles.statusBanner}>Waiting for customer to enter M-Pesa PIN. Do not resend or hold this sale until it succeeds or fails.</div>}
        {orderStatus === 'paid' && <div className={`${styles.statusBanner} ${styles.success}`}>Payment confirmed. Sale complete.</div>}
        {orderStatus === 'failed' && (
          <div className={`${styles.statusBanner} ${styles.error}`}>
            Payment did not go through. Ask the customer to retry M-Pesa, switch the tender to cash, or find the receipt in Operations and void it if a backend order was created.
          </div>
        )}
        {statusMessage && <div className={`${styles.statusBanner} ${styles.success}`}>{statusMessage}</div>}
        {lastReceipt && (
          <div className={styles.receiptMini}>
            <div className={styles.receiptHeader}>
              <span>Receipt</span>
              <strong>{lastReceipt.orderNumber}</strong>
            </div>
            <div className={styles.receiptDivider} />
            <div><span>Amount paid</span><strong>{formatKes(lastReceipt.total)}</strong></div>
            <div><span>Change due</span><strong>{formatKes(lastReceipt.changeDue)}</strong></div>
            <button className={styles.receiptPrintBtn} type="button" onClick={printLastReceipt}>
              Print receipt
            </button>
          </div>
        )}
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
