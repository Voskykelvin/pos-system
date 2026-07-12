'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import styles from './Checkout.module.css';
import {
  OFFLINE_QUEUE_EVENT,
  addOrderToQueue,
  cacheCatalog,
  getCachedCatalog,
  getOfflineQueueSummary,
  registerBackgroundSync,
  retryDeadLetterOrder,
  syncOfflineOrders
} from '../utils/offlineQueue';
import {
  createHeldSaleSnapshot,
  formatHeldSaleAge,
  heldSalesStorageKey,
  insertHeldSale
} from '../utils/heldSaleState.mjs';
import { productTaxCategory, taxLabel, taxRateForCategory } from '../utils/taxCategories';

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

const SCAN_CODE_PATTERN = /^[A-Za-z0-9._-]{4,}$/;

function amountNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sanitizeMoneyInput(value) {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  const [wholePart, ...decimalParts] = cleaned.split('.');

  if (decimalParts.length === 0) return wholePart;

  const decimalPart = decimalParts.join('').slice(0, 2);
  if (!wholePart && !decimalPart) return '0.';
  return `${wholePart || '0'}.${decimalPart}`;
}

function formatKes(amount) {
  return `KES ${amountNumber(amount).toFixed(2)}`;
}

function roundMoney(amount) {
  return Number(amountNumber(amount).toFixed(2));
}

function taxAmountFromGross(grossAmount, rate) {
  const gross = amountNumber(grossAmount);
  const taxRate = Number(rate || 0);
  if (taxRate <= 0) return 0;
  return gross * (taxRate / (1 + taxRate));
}

function formatTaxPercent(rate) {
  return `${(Number(rate || 0) * 100).toFixed(0)}%`;
}

function formatQuantity(value) {
  const quantity = Number(value || 0);
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function taxMarker(item) {
  if (item.taxCategory === 'exempt') return 'E';
  if (item.taxCategory === 'zero_rated') return 'Z';
  return Number(item.taxRate || 0) > 0 ? 'T' : 'Z';
}

function createReceiptBarcodeSvg(value) {
  if (!value) return '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, String(value), {
      format: 'CODE128',
      displayValue: true,
      margin: 0,
      width: 1.25,
      height: 48,
      fontSize: 10
    });
    return svg.outerHTML;
  } catch {
    return '';
  }
}

function summarizeTaxFromLines(lines, discountTotal = 0) {
  const grossTotal = lines.reduce((sum, line) => sum + Number(line.gross || 0), 0);
  const discountRatio = grossTotal > 0
    ? Math.max((grossTotal - amountNumber(discountTotal)) / grossTotal, 0)
    : 1;
  const groups = new Map();

  for (const line of lines) {
    const rate = Number(line.rate || 0);
    const key = rate.toFixed(4);
    const current = groups.get(key) || { rate, gross: 0, taxable: 0, tax: 0 };
    const gross = Number(line.gross || 0) * discountRatio;
    const tax = taxAmountFromGross(gross, rate);
    current.gross += gross;
    current.taxable += gross - tax;
    current.tax += tax;
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.rate - a.rate)
    .map((group) => ({
      ...group,
      gross: roundMoney(group.gross),
      taxable: roundMoney(group.taxable),
      tax: roundMoney(group.tax)
    }));
}

function summarizePayments(payments, total) {
  const totalDue = roundMoney(total);
  const cashPayment = payments.find((payment) => payment.method === 'cash');
  const cashTendered = roundMoney(cashPayment?.amount);
  const nonCashTotal = roundMoney(
    payments
      .filter((payment) => payment.method !== 'cash')
      .reduce((sum, payment) => sum + amountNumber(payment.amount), 0)
  );
  const dueBeforeCash = roundMoney(Math.max(totalDue - nonCashTotal, 0));
  const changeDue = cashPayment ? roundMoney(Math.max(cashTendered - dueBeforeCash, 0)) : 0;
  const shortAmount = cashPayment
    ? roundMoney(Math.max(dueBeforeCash - cashTendered, 0))
    : roundMoney(Math.max(totalDue - nonCashTotal, 0));
  const overpaidNonCash = !cashPayment && nonCashTotal > totalDue + 0.01;

  return {
    cashTendered,
    changeDue,
    dueBeforeCash,
    isSatisfied: !overpaidNonCash && shortAmount <= 0.01,
    nonCashTotal,
    overpaidNonCash,
    shortAmount
  };
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
  const [settledCashAmount, setSettledCashAmount] = useState(payments[0]?.method === 'cash' ? payments[0].amount : '');
  const [cashEditing, setCashEditing] = useState(false);

  function addRow(method) {
    if (
      method !== 'cash' &&
      payments.length === 1 &&
      payments[0].method === 'cash' &&
      amountNumber(payments[0].amount) <= 0
    ) {
      onChange([{ method, amount: total.toFixed(2), mpesaPhone: '' }]);
      return;
    }

    const existingSummary = summarizePayments(payments, total);
    const existingSum = method === 'cash'
      ? existingSummary.nonCashTotal
      : payments.reduce((s, p) => s + amountNumber(p.amount), 0);
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

  const paymentSummary = summarizePayments(payments, total);
  const singleCash = payments.length === 1 && payments[0].method === 'cash';
  const cashAmount = singleCash ? payments[0].amount : '';
  const cashDisplaySummary = summarizePayments([{ method: 'cash', amount: settledCashAmount }], total);

  useEffect(() => {
    if (!singleCash) return;
    if (!cashEditing) setSettledCashAmount(cashAmount);
  }, [cashAmount, cashEditing, singleCash]);

  const canAddCash = !payments.find((p) => p.method === 'cash');
  const canAddMpesa = !payments.find((p) => p.method === 'mpesa');
  const canAddCredit = customer && !payments.find((p) => p.method === 'credit');
  const quickCashValues = Array.from(new Set([
    roundMoney(total),
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    500,
    1000
  ].filter((amount) => amount > 0 && amount >= total))).slice(0, 4);

  if (singleCash) {
    const cashValueSettled = settledCashAmount === cashAmount;

    return (
      <div className={styles.paymentsPanel}>
        <div className={styles.paymentsPanelHeader}>
          <span className={styles.paymentsPanelTitle}>Payment</span>
        </div>

        <div className={styles.cashBox}>
          <label className={styles.cashLabel} htmlFor="cashReceived">Cash received</label>
          <input
            id="cashReceived"
            className={styles.cashInput}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={cashAmount}
            onFocus={() => setCashEditing(true)}
            onBlur={() => {
              setSettledCashAmount(cashAmount);
              setCashEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            onChange={(e) => {
              setCashEditing(true);
              updateRow(0, 'amount', sanitizeMoneyInput(e.target.value));
            }}
            placeholder="0.00"
          />
          <div className={styles.cashChips}>
            {quickCashValues.map((amt) => (
              <button
                key={amt}
                type="button"
                className={styles.cashChip}
                onClick={() => {
                  const nextAmount = String(roundMoney(amt));
                  updateRow(0, 'amount', nextAmount);
                  setSettledCashAmount(nextAmount);
                  setCashEditing(false);
                }}
              >
                {formatKes(amt)}
              </button>
            ))}
          </div>

          {cashAmount !== '' && cashValueSettled && (
            <div className={`${styles.changeRow} ${cashDisplaySummary.shortAmount > 0 ? styles.changeShort : styles.changePositive}`}>
              <span>{cashDisplaySummary.shortAmount > 0 ? 'Short' : 'Change'}</span>
              <span>{formatKes(cashDisplaySummary.shortAmount > 0 ? cashDisplaySummary.shortAmount : cashDisplaySummary.changeDue)}</span>
            </div>
          )}
        </div>

        <div className={styles.addPaymentOptions}>
          {canAddMpesa && <button onClick={() => addRow('mpesa')} type="button">+ M-Pesa</button>}
          {canAddCredit && <button onClick={() => addRow('credit')} type="button">+ Credit</button>}
        </div>
      </div>
    );
  }

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
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`${p.method} payment amount`}
            value={p.amount}
            onChange={(e) => updateRow(idx, 'amount', sanitizeMoneyInput(e.target.value))}
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

      {paymentSummary.shortAmount > 0 && (
        <div className={styles.addPaymentOptions}>
          {canAddCash && <button onClick={() => addRow('cash')} type="button">+ Cash</button>}
          {canAddMpesa && <button onClick={() => addRow('mpesa')} type="button">+ M-Pesa</button>}
          {canAddCredit && <button onClick={() => addRow('credit')} type="button">+ Credit</button>}
        </div>
      )}

      {paymentSummary.shortAmount > 0 && <div className={styles.remainingWarn}>Remaining: {formatKes(paymentSummary.shortAmount)}</div>}
      {paymentSummary.changeDue > 0 && (
        <div className={styles.changeDue}>Change due: {formatKes(paymentSummary.changeDue)}</div>
      )}
    </div>
  );
}

function HeldSalesPanel({ heldSales, onResume, onRemove }) {
  if (heldSales.length === 0) return null;

  return (
    <div className={styles.heldSales}>
      <div className={styles.heldSalesHeader}>
        <strong>Held sales</strong>
        <span>{heldSales.length}</span>
      </div>
      <div className={styles.heldSalesList}>
        {heldSales.map((heldSale) => (
          <div className={styles.heldSaleRow} key={heldSale.id}>
            <button className={styles.heldSaleMain} type="button" onClick={() => onResume(heldSale)}>
              <strong>{heldSale.label}</strong>
              <span>{formatKes(heldSale.total)} - {heldSale.itemCount} item{heldSale.itemCount === 1 ? '' : 's'} - {formatHeldSaleAge(heldSale)}</span>
              <small>{[heldSale.note, heldSale.cashierName].filter(Boolean).join(' - ') || 'No note'}</small>
            </button>
            <button className={styles.heldSaleRemove} type="button" onClick={() => onRemove(heldSale.id)}>
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Checkout component --------------------------------------------------
export default function Checkout({ authToken, cashierId, user }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [isWholesale, setIsWholesale] = useState(false);
  const [mobilePane, setMobilePane] = useState('catalog');
  const [autoPrint, setAutoPrint] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_auto_print');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('pos_auto_print', JSON.stringify(autoPrint));
  }, [autoPrint]);
  const [customer, setCustomer] = useState(null);

  // Payments: array of { method, amount, mpesaPhone }
  const [payments, setPayments] = useState([{ method: 'cash', amount: '', mpesaPhone: '' }]);

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
  const [showHeldSales, setShowHeldSales] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [etimsStatus, setEtimsStatus] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineSummary, setOfflineSummary] = useState({
    queued: 0,
    rejected: 0,
    states: {},
    orders: [],
    rejectedOrders: []
  });
  const [offlineSyncing, setOfflineSyncing] = useState(false);

  const refreshOfflineSummary = useCallback(async () => {
    try {
      setOfflineSummary(await getOfflineQueueSummary());
    } catch {
      // IndexedDB availability errors are surfaced when attempting to queue a sale.
    }
  }, []);

  useEffect(() => {
    refreshOfflineSummary();
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshOfflineSummary);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshOfflineSummary);
  }, [refreshOfflineSummary]);
  const pollRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadEtimsStatus = useCallback(async () => {
    if (!navigator.onLine) {
      setEtimsStatus(null);
      return;
    }
    try {
      const res = await fetch('/api/etims/status', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) setEtimsStatus(data);
    } catch {
      setEtimsStatus(null);
    }
  }, [authToken]);

  useEffect(() => {
    const refreshOnlineState = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) loadEtimsStatus();
    };
    refreshOnlineState();
    const interval = window.setInterval(loadEtimsStatus, 60000);
    window.addEventListener('online', refreshOnlineState);
    window.addEventListener('offline', refreshOnlineState);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refreshOnlineState);
      window.removeEventListener('offline', refreshOnlineState);
    };
  }, [loadEtimsStatus]);

  useEffect(() => {
    saveHeldSales(user, heldSales);
  }, [heldSales, user?.id, user?.tenantId]);

  useEffect(() => {
    async function hydrateCatalog() {
      if (!navigator.onLine) return;
      try {
        const res = await fetch('/api/products', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const products = await res.json();
          if (Array.isArray(products) && products.length > 0) {
            await cacheCatalog(products);
          }
        }
      } catch (err) {
        // Fallback silently if offline/error during startup
      }
    }
    hydrateCatalog();
  }, [authToken]);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        productId: product.id,
        name: product.name,
        unitPrice: isWholesale ? Number(product.wholesalePrice || product.sellingPrice) : Number(product.sellingPrice),
        quantity: 1,
        taxCategory: productTaxCategory(product)
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

  const itemsTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const discountValue = amountNumber(discountTotal);
  const promoDiscount = promoResult ? Number(promoResult.discountAmount) : 0;
  const loyaltyDiscount = redeemLoyalty && customer?.loyaltyPoints > 0 ? Math.floor(customer.loyaltyPoints / 100) : 0;
  const totalDiscount = discountValue + promoDiscount + loyaltyDiscount;
  const total = Math.max(itemsTotal - totalDiscount, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const taxSummary = summarizeTaxFromLines(
    cart.map((item) => ({
      gross: item.unitPrice * item.quantity,
      rate: taxRateForCategory(item.taxCategory)
    })),
    totalDiscount
  );
  const taxTotal = roundMoney(taxSummary.reduce((sum, group) => sum + group.tax, 0));
  const netSubtotal = roundMoney(total - taxTotal);

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
    setShowHeldSales(true);
    resetSale({ clearReceipt: true });
    setMobilePane('catalog');
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
    setMobilePane('cart');
    setPayments(heldSale.payments?.length ? heldSale.payments : [{ method: 'cash', amount: '', mpesaPhone: '' }]);
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
    setShowHeldSales(false);
    showToast('Held sale recalled.');
  }

  function removeHeldSale(heldSaleId) {
    setHeldSales((current) => current.filter((sale) => sale.id !== heldSaleId));
    if (heldSales.length <= 1) setShowHeldSales(false);
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
          const newReceipt = {
            orderId,
            orderNumber: data.orderNumber,
            total,
            itemCount: cartItemCount,
            cashierName: user?.name,
            createdAt: new Date().toISOString(),
            changeDue: 0
          };
          setLastReceipt(newReceipt);
          if (autoPrint) {
            printLastReceipt(newReceipt);
          }
          resetSale();
          setStatusMessage('Sale completed successfully.');
          showToast('Sale completed successfully.');
          loadEtimsStatus();
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
  }, [authToken, autoPrint, cartItemCount, loadEtimsStatus, total, user?.name]);

  function resetSale({ clearReceipt = false } = {}) {
    setCart([]);
    setPayments([{ method: 'cash', amount: '', mpesaPhone: '' }]);
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
      setError(paymentSummary.overpaidNonCash
        ? 'M-Pesa and credit payments cannot be more than the sale total.'
        : `Payment is short by ${formatKes(paymentSummary.shortAmount)}.`);
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
      amount: roundMoney(p.amount),
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
      const unsafeOfflineReason = payments.some((p) => p.method !== 'cash')
        ? 'Offline checkout currently supports cash only.'
        : customer || promoResult || discountValue > 0 || redeemLoyalty
          ? 'Customer credit, loyalty, promotions, and discounts require an online checkout.'
          : null;
      if (unsafeOfflineReason) {
        setError(unsafeOfflineReason);
        setStatusMessage(null);
        showToast(unsafeOfflineReason, 'error');
        setSubmitting(false);
        return;
      }
      try {
        const queuedSale = await addOrderToQueue(orderPayload, {
          tenantId: user?.tenantId,
          cashierId,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxCategory: item.taxCategory
          }))
        });
        registerBackgroundSync().catch(() => {});
        setOrderStatus('paid');
        const newReceipt = {
          orderNumber: `OFFLINE-${queuedSale.sequence}`,
          total,
          itemCount: cartItemCount,
          amountTendered: paymentSummary.cashTendered || total,
          changeDue: paymentSummary.changeDue,
          cashierName: user?.name,
          createdAt: new Date().toISOString()
        };
        setLastReceipt(newReceipt);
        if (autoPrint) {
          printLastReceipt(newReceipt);
        }
        setStatusMessage('Sale queued offline and will sync automatically.');
        showToast('Sale queued offline and will sync automatically.');
        resetSale();
        setEtimsStatus(null);
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
        setOrderStatus('paid');
        const newReceipt = {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          total: data.total,
          itemCount: cartItemCount,
          amountTendered: Number(data.amountTendered || paymentSummary.cashTendered || data.total),
          changeDue: Number(data.changeDue || paymentSummary.changeDue),
          cashierName: user?.name,
          createdAt: data.createdAt || new Date().toISOString()
        };
        setLastReceipt(newReceipt);
        if (autoPrint) {
          printLastReceipt(newReceipt);
        }
        setStatusMessage('Sale completed successfully.');
        showToast('Sale completed successfully.');
        resetSale();
        loadEtimsStatus();
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

  const paymentSummary = summarizePayments(payments, total);
  const mpesaRows = payments.filter((p) => p.method === 'mpesa');
  const mpesaComplete = mpesaRows.every((p) => p.mpesaPhone?.trim().length >= 9);
  const paymentsBalanced = paymentSummary.isSatisfied;

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

  async function printLastReceipt(receiptParam = null) {
    const activeReceipt = receiptParam?.orderNumber ? receiptParam : lastReceipt;
    if (!activeReceipt) return;

    let receipt = null;
    if (activeReceipt.orderId && navigator.onLine) {
      try {
        const res = await fetch(`/api/orders/${activeReceipt.orderId}/receipt`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (res.ok) receipt = data;
      } catch {
        receipt = null;
      }
    }

    const receiptNumber = receipt?.orderNumber || activeReceipt.orderNumber;
    const totalPaid = receipt?.total ?? activeReceipt.total;
    const saleDate = receipt?.createdAt || activeReceipt.createdAt || new Date().toISOString();
    const saleDateText = new Date(saleDate).toLocaleString();
    const cashierName = receipt?.cashier?.name || activeReceipt.cashierName || user?.name || 'Cashier';
    const businessName = receipt?.business?.name || 'Jijenge POS';
    const sellerPin = receipt?.business?.kraPin || '';
    const receiptPolicy = receipt?.business?.receiptPolicy || '';
    const receiptFooter = receipt?.business?.receiptFooter || 'Thank you';
    const branchLabel = receipt?.branch
      ? [receipt.branch.code, receipt.branch.name].filter(Boolean).join(' - ')
      : '';
    const branchAddress = receipt?.branch
      ? [receipt.branch.address, receipt.branch.city].filter(Boolean).join(', ')
      : '';
    const branchPhone = receipt?.branch?.phone || '';
    const etimsStatus = receipt?.etims?.status || 'not_created';
    const cuInvoiceNumber = receipt?.etims?.cuInvoiceNumber || '';
    const qrCodeUrl = receipt?.etims?.qrCodeUrl || '';
    const deviceSerial = receipt?.etims?.deviceSerial || '';
    const fiscalReady = Boolean(receipt?.etims?.fiscalReady ?? (cuInvoiceNumber && qrCodeUrl));
    const etimsStatusText = etimsStatus === 'transmitted'
      ? 'eTIMS: TRANSMITTED'
      : etimsStatus === 'queued'
        ? 'eTIMS: QUEUED'
        : etimsStatus === 'failed'
          ? 'eTIMS: FAILED'
          : 'eTIMS: NOT CREATED';
    const fiscalNotice = fiscalReady
      ? ''
      : receipt
        ? 'NOT FISCAL UNTIL ETIMS CONFIRMS'
        : 'OFFLINE COPY - ETIMS PENDING';
    const receiptChange = Number(receipt?.tender?.changeDue ?? activeReceipt.changeDue ?? 0);
    const receiptTendered = Number(receipt?.tender?.amountTendered ?? activeReceipt.amountTendered ?? totalPaid + receiptChange);
    const receiptItemCount = Number(receipt?.itemCount ?? activeReceipt.itemCount ?? 0);
    const receiptBarcodeSvg = createReceiptBarcodeSvg(receiptNumber);
    const receiptTaxSummary = receipt?.items?.length
      ? summarizeTaxFromLines(
          receipt.items.map((item) => ({ gross: Number(item.lineTotal || 0), rate: Number(item.taxRate || 0) })),
          receipt?.discountTotal || 0
        )
      : taxSummary;
    const rows = receipt?.items?.length
      ? receipt.items.map((item) => {
          const itemCode = item.itemCode || item.barcode || item.sku || '';
          const unit = item.unit || 'each';
          return `
          <tr>
            <td>
              <div class="item-code">${escapeHtml(itemCode || '-')}</div>
              <div>${escapeHtml(item.name)}</div>
              <div class="muted">${formatQuantity(item.quantity)} ${escapeHtml(unit)} x ${formatKes(item.unitPrice)} | VAT ${formatTaxPercent(item.taxRate)} ${taxMarker(item)}</div>
            </td>
            <td>${formatKes(item.lineTotal)} ${taxMarker(item)}</td>
          </tr>
        `;
        }).join('')
      : `<tr><td>Sale total</td><td>${formatKes(totalPaid)}</td></tr>`;

    const paymentRows = receipt?.payments?.length
      ? receipt.payments.map((payment) => `
          <tr>
            <td>${escapeHtml(payment.method).toUpperCase()} ${escapeHtml(payment.status)}${payment.mpesaReceiptNumber ? `<div class="muted">${escapeHtml(payment.mpesaReceiptNumber)}</div>` : ''}</td>
            <td>${formatKes(payment.method === 'cash' ? receiptTendered : payment.amount)}</td>
          </tr>
        `).join('') + (receiptChange > 0 ? `<tr><td>Change</td><td>${formatKes(receiptChange)}</td></tr>` : '')
      : `<tr><td>Payment</td><td>${formatKes(totalPaid)}</td></tr>`;
    const taxSummaryRows = receiptTaxSummary.length
      ? receiptTaxSummary.map((row) => `
          <tr>
            <td>${formatTaxPercent(row.rate)}</td>
            <td>${formatKes(row.taxable)}</td>
            <td>${formatKes(row.tax)}</td>
          </tr>
        `).join('')
      : '<tr><td>0%</td><td>KES 0.00</td><td>KES 0.00</td></tr>';

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
            .receipt-policy { font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { font-size: 11px; text-align: left; border-bottom: 1px dashed #111827; padding-bottom: 4px; }
            th:last-child { text-align: right; }
            td { padding: 3px 0; vertical-align: top; }
            td:last-child { text-align: right; white-space: nowrap; }
            .line { border-top: 1px dashed #111827; margin: 8px 0; }
            .total { font-size: 15px; font-weight: 800; }
            .warning { color: #991b1b; font-weight: 800; }
            .item-code { font-weight: 800; letter-spacing: 0; }
            .served { font-size: 11px; margin: 10px 0 6px; }
            .receipt-meta { margin: 8px 0 4px; }
            .receipt-meta td { font-size: 11px; }
            .receipt-title { font-size: 16px; font-weight: 900; letter-spacing: 1px; margin-top: 4px; }
            .section-title { font-size: 12px; font-weight: 900; margin: 8px 0 4px; }
            .barcode svg { width: 100%; height: 46px; margin: 8px auto 2px; display: block; }
            .control-info { font-size: 11px; display: grid; gap: 2px; margin-top: 4px; }
            .qr { width: 96px; height: 96px; object-fit: contain; margin: 6px auto 0; display: block; }
            .vat-summary th,
            .vat-summary td { font-size: 11px; }
            .vat-summary th { text-align: right; font-weight: 800; }
            .vat-summary th:first-child,
            .vat-summary td:first-child { text-align: left; }
            @media print {
              body { padding: 0; }
              .receipt { width: 76mm; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <div class="center">
              ${receiptPolicy ? `<div class="receipt-policy">${escapeHtml(receiptPolicy)}</div>` : ''}
              <h1>${escapeHtml(businessName)}</h1>
              ${sellerPin ? `<div class="muted">TRADER PIN: ${escapeHtml(sellerPin)}</div>` : receipt ? '<div class="warning">PIN NOT SET</div>' : ''}
              ${branchLabel ? `<div class="muted">Store: ${escapeHtml(branchLabel)}</div>` : ''}
              ${branchAddress ? `<div class="muted">${escapeHtml(branchAddress)}</div>` : ''}
              ${branchPhone ? `<div class="muted">Tel: ${escapeHtml(branchPhone)}</div>` : ''}
              <div class="muted">USER: ${escapeHtml(cashierName)}</div>
              <div class="muted">${escapeHtml(receiptNumber)}</div>
              <div class="muted">${escapeHtml(saleDateText)}</div>
            </div>
            <div class="line"></div>
            <div class="center section-title">- START OF ${fiscalReady ? 'FISCAL RECEIPT' : 'SALES RECEIPT'} -</div>
            <table>
              <thead><tr><th>ITEM</th><th>AMOUNT</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="muted">TOTAL NUMBER OF ITEMS SOLD = ${escapeHtml(formatQuantity(receiptItemCount))}</div>
            <div class="line"></div>
            <table>
              <tr><td>Items total</td><td>${formatKes(totalPaid + Number(receipt?.discountTotal || 0))}</td></tr>
              <tr><td>Before VAT</td><td>${formatKes(receipt?.subtotal ?? totalPaid - Number(receipt?.taxTotal || 0))}</td></tr>
              <tr><td>VAT included</td><td>${formatKes(receipt?.taxTotal || 0)}</td></tr>
              <tr><td>Discount</td><td>${formatKes(receipt?.discountTotal || 0)}</td></tr>
              <tr class="total"><td>Total</td><td>${formatKes(totalPaid)}</td></tr>
            </table>
            <div class="line"></div>
            <table class="vat-summary">
              <thead><tr><th>RATE</th><th>TAXABLE</th><th>VAT</th></tr></thead>
              <tbody>${taxSummaryRows}</tbody>
            </table>
            <div class="center muted">Prices include VAT where applicable</div>
            <div class="line"></div>
            <table>${paymentRows}</table>
            <div class="center muted">${escapeHtml(etimsStatusText)}</div>
            ${fiscalNotice ? `<div class="center warning">${escapeHtml(fiscalNotice)}</div>` : ''}
            <div class="line"></div>
            <div class="center served">You were served by ${escapeHtml(cashierName)}</div>
            <div class="center">${escapeHtml(receiptFooter)}</div>
            <table class="receipt-meta">
              <tr><td>Receipt #</td><td>${escapeHtml(receiptNumber)}</td></tr>
              <tr><td>Date/Time</td><td>${escapeHtml(saleDateText)}</td></tr>
            </table>
            ${receiptBarcodeSvg ? `<div class="barcode">${receiptBarcodeSvg}</div>` : ''}
            <div class="center section-title">- CONTROL UNIT INFO -</div>
            <div class="control-info">
              <div>CU Serial No: ${escapeHtml(deviceSerial || 'pending')}</div>
              <div>CU Invoice No: ${escapeHtml(cuInvoiceNumber || 'pending')}</div>
              <div>Receipt No: ${escapeHtml(receiptNumber)}</div>
            </div>
            ${qrCodeUrl ? `<img class="qr" src="${escapeHtml(qrCodeUrl)}" alt="eTIMS QR code" />` : '<div class="center muted">QR code pending</div>'}
            <div class="center receipt-title">${fiscalReady ? 'FISCAL RECEIPT' : 'SALES RECEIPT'}</div>
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

  const etimsNotice = !isOnline
    ? { tone: 'pending', text: 'Offline mode: eTIMS sync is paused until internet returns.' }
    : Number(etimsStatus?.failed || 0) > 0
      ? { tone: 'error', text: `${etimsStatus.failed} failed eTIMS invoice(s) need manager attention.` }
      : Number(etimsStatus?.queued || 0) > 0
        ? { tone: 'pending', text: `${etimsStatus.queued} receipt(s) pending eTIMS transmission.` }
        : etimsStatus?.warnings?.productionBlocked
          ? { tone: 'error', text: 'Production eTIMS is blocked until fiscal settings are complete.' }
          : etimsStatus
            ? { tone: 'ok', text: 'eTIMS queue clear.' }
            : null;

  return (
    <div className={styles.page}>
      {!navigator.onLine && (
        <div className={styles.offlineBanner}>
          OFFLINE MODE: Cash-only sales can be queued. Payments and price-sensitive adjustments require internet.
        </div>
      )}
      {(offlineSummary.queued > 0 || offlineSummary.rejected > 0) && (
        <div className={styles.offlineQueuePanel} role="status" aria-live="polite">
          <div>
            <strong>Offline reconciliation</strong>
            <span>
              {offlineSummary.queued} waiting
              {offlineSummary.states.auth_required ? ` · ${offlineSummary.states.auth_required} need sign-in` : ''}
              {offlineSummary.rejected ? ` · ${offlineSummary.rejected} need review` : ''}
            </span>
          </div>
          <div className={styles.offlineQueueActions}>
            {isOnline && offlineSummary.queued > 0 && (
              <button
                type="button"
                disabled={offlineSyncing}
                onClick={async () => {
                  setOfflineSyncing(true);
                  try {
                    await syncOfflineOrders(authToken, {
                      force: true,
                      cashierId,
                      tenantId: user?.tenantId || null
                    });
                    await refreshOfflineSummary();
                  } finally {
                    setOfflineSyncing(false);
                  }
                }}
              >
                {offlineSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            )}
            {offlineSummary.rejectedOrders.slice(0, 2).map((order) => (
              <button
                type="button"
                key={order.id}
                title={order.rejectionReason}
                onClick={async () => {
                  await retryDeadLetterOrder(order.id);
                  await refreshOfflineSummary();
                }}
              >
                Retry offline #{order.sequence}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Product search + grid */}
      <div className={`${styles.catalog} ${mobilePane === 'cart' ? styles.mobilePaneHidden : ''}`}>
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
          <label className={styles.toggleLabel} style={{ marginLeft: '20px' }}>
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
            />
            Auto-print Receipts
          </label>
        </div>

        {results.length === 0 ? (
          <p className={styles.emptyState}>
            {query.trim().length >= 2 ? 'No products found' : 'Start typing to find a product'}
          </p>
        ) : (
          <div className={styles.productGrid}>
            {results.map((product) => (
              <button key={product.id} className={styles.productCard} type="button" onClick={() => addToCart(product)}>
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className={styles.productImg} />
                )}
                <div className={styles.productName}>{product.name}</div>
                <div className={styles.productMeta}>
                  {isWholesale && product.wholesalePrice
                    ? <><del style={{fontSize: '10px'}}>{formatKes(product.sellingPrice)}</del> {formatKes(product.wholesalePrice)}</>
                    : formatKes(product.sellingPrice)} / {product.unit}
                </div>
                <div className={styles.stockMeta}>{taxLabel(productTaxCategory(product))}</div>
                <div className={styles.stockMeta}>Stock: {Number(product.stockQuantity)} {product.unit}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart / receipt panel */}
      <div className={`${styles.cartPanel} ${mobilePane === 'catalog' ? styles.mobilePaneHidden : ''}`}>
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
          <div className={styles.headerActions}>
            {heldSales.length > 0 && (
              <button
                className={styles.heldSalesToggle}
                type="button"
                onClick={() => setShowHeldSales((visible) => !visible)}
              >
                Held ({heldSales.length})
              </button>
            )}
            <button className={styles.holdSaleBtn} type="button" onClick={holdCurrentSale} disabled={!canHoldSale} title="F2">
              Hold sale
            </button>
          </div>
        </div>

        {showHeldSales && (
          <HeldSalesPanel heldSales={heldSales} onResume={resumeHeldSale} onRemove={removeHeldSale} />
        )}

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

        <div className={styles.cartItems}>
          {cart.length === 0 ? (
            <p className={styles.cartEmpty}>Cart is empty. Add a product to start.</p>
          ) : (
            cart.map((item) => (
              <div className={styles.cartRow} key={item.productId}>
                <div>
                  <div className={styles.cartItemName}>{item.name}</div>
                  <div className={styles.cartTax}>{taxLabel(item.taxCategory)}</div>
                  <button className={styles.removeBtn} type="button" onClick={() => removeItem(item.productId)}>Remove</button>
                </div>
                <div className={styles.qtyControls}>
                  <button className={styles.qtyBtn} type="button" aria-label={`Decrease ${item.name} quantity`} onClick={() => changeQty(item.productId, -1)}>-</button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button className={styles.qtyBtn} type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => changeQty(item.productId, 1)}>+</button>
                </div>
                <div className={styles.lineTotal}>{formatKes(item.unitPrice * item.quantity)}</div>
              </div>
            ))
          )}
        </div>

        <div className={styles.totalsBlock}>
          <div className={styles.totalsRow}><span>Items total</span><span>{formatKes(itemsTotal)}</span></div>
          <div className={styles.totalsRow}><span>Before VAT</span><span>{formatKes(netSubtotal)}</span></div>
          {(taxSummary.length ? taxSummary : [{ rate: 0, tax: 0 }]).map((group) => (
            <div className={styles.totalsRow} key={group.rate}>
              <span>VAT {formatTaxPercent(group.rate)} incl.</span>
              <span>{formatKes(group.tax)}</span>
            </div>
          ))}

          {/* Manual discount */}
          <div className={styles.discountRow}>
            <span>Discount</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={discountTotal}
              onChange={(e) => setDiscountTotal(sanitizeMoneyInput(e.target.value))}
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

        <button className={styles.confirmBtn} type="button" disabled={!canConfirm} onClick={handleConfirm}>
          {submitting ? 'Processing...' : `Confirm sale - ${formatKes(total)}`}
        </button>

        {etimsNotice && (
          <div className={`${styles.etimsNotice} ${styles[`etims${etimsNotice.tone}`]}`}>
            {etimsNotice.text}
          </div>
        )}

        {orderStatus === 'waiting' && <div className={styles.statusBanner} role="status" aria-live="polite">Waiting for customer to enter M-Pesa PIN. Do not resend or hold this sale until it succeeds or fails.</div>}
        {orderStatus === 'paid' && <div className={`${styles.statusBanner} ${styles.success}`} role="status" aria-live="polite">Payment confirmed. Sale complete.</div>}
        {orderStatus === 'failed' && (
          <div className={`${styles.statusBanner} ${styles.error}`} role="alert">
            Payment did not go through. Ask the customer to retry M-Pesa, switch the tender to cash, or find the receipt in Operations and void it if a backend order was created.
          </div>
        )}
        {statusMessage && <div className={`${styles.statusBanner} ${styles.success}`} role="status" aria-live="polite">{statusMessage}</div>}
        {lastReceipt && (
          <div className={styles.receiptMini}>
            <div className={styles.receiptHeader}>
              <span>Receipt</span>
              <strong>{lastReceipt.orderNumber}</strong>
            </div>
            <div className={styles.receiptMetaRow}><span>Served by</span><strong>{lastReceipt.cashierName || user?.name || 'Cashier'}</strong></div>
            <div className={styles.receiptMetaRow}><span>Time</span><strong>{new Date(lastReceipt.createdAt || Date.now()).toLocaleString()}</strong></div>
            <div className={styles.receiptMetaRow}><span>Items sold</span><strong>{formatQuantity(lastReceipt.itemCount || 0)}</strong></div>
            <div className={styles.receiptDivider} />
            <div className={styles.receiptAmountRow}><span>Sale total</span><strong>{formatKes(lastReceipt.total)}</strong></div>
            <div className={styles.receiptChangeRow}><span>Change due</span><strong>{formatKes(lastReceipt.changeDue)}</strong></div>
            <button className={styles.receiptPrintBtn} type="button" onClick={() => printLastReceipt()}>
              Print receipt
            </button>
          </div>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <nav className={styles.mobileSaleBar} aria-label="Checkout view">
        <button
          type="button"
          className={mobilePane === 'catalog' ? styles.mobileSaleBarActive : ''}
          aria-pressed={mobilePane === 'catalog'}
          onClick={() => {
            setMobilePane('catalog');
            window.setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
        >
          Products
        </button>
        <div className={styles.mobileSaleSummary} aria-live="polite">
          <span>{cartItemCount} item{cartItemCount === 1 ? '' : 's'}</span>
          <strong>{formatKes(total)}</strong>
        </div>
        <button
          type="button"
          className={mobilePane === 'cart' ? styles.mobileSaleBarActive : ''}
          aria-pressed={mobilePane === 'cart'}
          onClick={() => setMobilePane('cart')}
        >
          Cart{cartItemCount > 0 ? ` (${formatQuantity(cartItemCount)})` : ''}
        </button>
      </nav>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
