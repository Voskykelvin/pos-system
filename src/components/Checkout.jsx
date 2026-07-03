'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Checkout.module.css';

const VAT_RATES = { standard: 0.16, zero_rated: 0, exempt: 0 };

function formatKes(amount) {
  return `KES ${Number(amount).toFixed(2)}`;
}

export default function Checkout({ authToken, cashierId, user }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // [{ productId, name, unitPrice, quantity, taxCategory }]
  const [method, setMethod] = useState('cash');
  const [phone, setPhone] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [discountTotal, setDiscountTotal] = useState('');
  const [managerIdentifier, setManagerIdentifier] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null); // 'waiting' | 'paid' | 'failed'
  const [lastReceipt, setLastReceipt] = useState(null);
  const pollRef = useRef(null);

  // Debounced product search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const term = query.trim();
        const searchParams = /^\d{6,}$/.test(term)
          ? `barcode=${encodeURIComponent(term)}`
          : `q=${encodeURIComponent(term)}`;
        const res = await fetch(`/api/products/search?${searchParams}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [authToken, query]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.sellingPrice),
          quantity: 1,
          taxCategory: product.Category?.taxCategory || 'standard'
        }
      ];
    });
    setQuery('');
    setResults([]);
    setOrderStatus(null);
    setLastReceipt(null);
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const taxTotal = cart.reduce((sum, i) => {
    const rate = VAT_RATES[i.taxCategory] ?? 0.16;
    return sum + i.unitPrice * i.quantity * rate;
  }, 0);
  const discountValue = Number(discountTotal || 0);
  const total = Math.max(subtotal + taxTotal - discountValue, 0);
  const cashValue = Number(cashReceived || 0);
  const changeDue = method === 'cash' ? Math.max(cashValue - total, 0) : 0;
  const cashShort = method === 'cash' && cashValue < total;
  const discountNeedsApproval = discountValue > 0 && user?.role === 'cashier';

  const pollOrderStatus = useCallback((orderId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.paymentStatus === 'paid') {
          clearInterval(pollRef.current);
          setOrderStatus('paid');
          setCart([]);
        } else if (data.payments?.some((p) => p.status === 'failed')) {
          clearInterval(pollRef.current);
          setOrderStatus('failed');
        }
      } catch {
        // transient network hiccup, keep polling
      }
    }, 3000);

    // give up after 2 minutes so the cashier isn't stuck waiting forever
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setOrderStatus((s) => (s === 'waiting' ? 'failed' : s));
    }, 120000);
  }, [authToken]);

  async function handleConfirm() {
    if (cart.length === 0) return;
    setError(null);
    setSubmitting(true);

    const paymentPayload =
      method === 'cash'
        ? [{ method: 'cash', amount: total.toFixed(2) }]
        : [{ method: 'mpesa', amount: total.toFixed(2), mpesaPhone: phone }];

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          cashierId,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          payments: paymentPayload,
          discountTotal: discountValue,
          managerApproval: discountNeedsApproval
            ? { identifier: managerIdentifier, password: managerPassword }
            : undefined
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      if (method === 'cash') {
        setOrderStatus('paid');
        setLastReceipt({
          orderNumber: data.orderNumber,
          total: data.total,
          changeDue
        });
        setCart([]);
        setCashReceived('');
        setDiscountTotal('');
        setManagerIdentifier('');
        setManagerPassword('');
        setSubmitting(false);
        return;
      }

      // M-Pesa: trigger the STK push, then poll for confirmation
      const mpesaPayment = data.payments.find((p) => p.method === 'mpesa');
      setOrderStatus('waiting');

      const stkRes = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ paymentId: mpesaPayment.id, phone })
      });
      const stkData = await stkRes.json();

      if (!stkRes.ok) {
        setOrderStatus('failed');
        setError(stkData.error || 'STK push failed');
        setSubmitting(false);
        return;
      }

      pollOrderStatus(data.orderId);
      setSubmitting(false);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const canConfirm =
    cart.length > 0 &&
    cashierId &&
    !submitting &&
    orderStatus !== 'waiting' &&
    total > 0 &&
    (!discountNeedsApproval || (managerIdentifier.trim() && managerPassword.trim())) &&
    ((method === 'cash' && !cashShort) || phone.trim().length >= 9);

  return (
    <div className={styles.page}>
      {/* Product search + grid */}
      <div className={styles.catalog}>
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Scan barcode or search a product..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {results.length === 0 ? (
          <p className={styles.emptyState}>
            {query.trim().length >= 2 ? 'No products found' : 'Start typing to find a product'}
          </p>
        ) : (
          <div className={styles.productGrid}>
            {results.map((product) => (
              <button
                key={product.id}
                className={styles.productCard}
                onClick={() => addToCart(product)}
              >
                <div className={styles.productName}>{product.name}</div>
                <div className={styles.productMeta}>
                  {formatKes(product.sellingPrice)} / {product.unit}
                </div>
                <div className={styles.stockMeta}>
                  Stock: {Number(product.stockQuantity)} {product.unit}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart / receipt panel */}
      <div className={styles.cartPanel}>
        <div className={styles.cartHeader}>
          <h2 className={`${styles.heading} ${styles.cartTitle}`}>Current sale</h2>
          {cart.length > 0 && (
            <div className={styles.orderNumber}>{cart.length} item{cart.length !== 1 ? 's' : ''}</div>
          )}
        </div>

        <div className={styles.cartItems}>
          {cart.length === 0 ? (
            <p className={styles.cartEmpty}>Cart is empty. Add a product to start.</p>
          ) : (
            cart.map((item) => (
              <div className={styles.cartRow} key={item.productId}>
                <div>
                  <div className={styles.cartItemName}>{item.name}</div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeItem(item.productId)}
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.qtyControls}>
                  <button className={styles.qtyBtn} onClick={() => changeQty(item.productId, -1)}>
                    -
                  </button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button className={styles.qtyBtn} onClick={() => changeQty(item.productId, 1)}>
                    +
                  </button>
                </div>
                <div className={styles.lineTotal}>
                  {formatKes(item.unitPrice * item.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.totalsBlock}>
          <div className={styles.totalsRow}>
            <span>Subtotal</span>
            <span>{formatKes(subtotal)}</span>
          </div>
          <div className={styles.totalsRow}>
            <span>VAT</span>
            <span>{formatKes(taxTotal)}</span>
          </div>
          <div className={styles.discountRow}>
            <span>Discount</span>
            <input
              type="number"
              min="0"
              step="1"
              value={discountTotal}
              onChange={(e) => setDiscountTotal(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className={`${styles.totalsRow} ${styles.grand}`}>
            <span>Total</span>
            <span>{formatKes(total)}</span>
          </div>
        </div>

        <div className={styles.paymentSection}>
          <div className={styles.methodToggle}>
            <button
              className={`${styles.methodBtn} ${method === 'cash' ? styles.active : ''}`}
              onClick={() => setMethod('cash')}
            >
              Cash
            </button>
            <button
              className={`${styles.methodBtn} ${method === 'mpesa' ? styles.active : ''}`}
              onClick={() => setMethod('mpesa')}
            >
              M-Pesa
            </button>
          </div>

          {method === 'mpesa' && (
            <input
              className={styles.phoneInput}
              type="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}

          {method === 'cash' && (
            <div className={styles.cashBox}>
              <label className={styles.cashLabel} htmlFor="cashReceived">
                Cash received
              </label>
              <input
                id="cashReceived"
                className={styles.phoneInput}
                type="number"
                min="0"
                step="1"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
              />
              <div className={styles.cashChips}>
                {[total, 500, 1000, 2000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={styles.cashChip}
                    onClick={() => setCashReceived(String(Math.ceil(amount)))}
                  >
                    {formatKes(Math.ceil(amount))}
                  </button>
                ))}
              </div>
              <div className={`${styles.totalsRow} ${styles.changeRow}`}>
                <span>{cashShort ? 'Short' : 'Change'}</span>
                <span>{formatKes(cashShort ? total - cashValue : changeDue)}</span>
              </div>
            </div>
          )}

          {discountNeedsApproval && (
            <div className={styles.approvalBox}>
              <label className={styles.cashLabel}>Manager approval</label>
              <input
                className={styles.phoneInput}
                value={managerIdentifier}
                onChange={(e) => setManagerIdentifier(e.target.value)}
                placeholder="Manager email or phone"
              />
              <input
                className={styles.phoneInput}
                type="password"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                placeholder="Manager password"
              />
            </div>
          )}

          <button className={styles.confirmBtn} disabled={!canConfirm} onClick={handleConfirm}>
            {submitting
              ? 'Processing...'
              : method === 'cash'
              ? `Confirm sale - ${formatKes(total)}`
              : `Send M-Pesa prompt - ${formatKes(total)}`}
          </button>

          {orderStatus === 'waiting' && (
            <div className={styles.statusBanner}>
              Waiting for customer to enter M-Pesa PIN on their phone...
            </div>
          )}
          {orderStatus === 'paid' && (
            <div className={`${styles.statusBanner} ${styles.success}`}>
              Payment confirmed. Sale complete.
            </div>
          )}
          {lastReceipt && (
            <div className={styles.receiptMini}>
              <div>
                <span>Receipt</span>
                <strong>{lastReceipt.orderNumber}</strong>
              </div>
              <div>
                <span>Change</span>
                <strong>{formatKes(lastReceipt.changeDue)}</strong>
              </div>
            </div>
          )}
          {orderStatus === 'failed' && (
            <div className={`${styles.statusBanner} ${styles.error}`}>
              Payment did not go through. Try again or use cash.
            </div>
          )}
          {error && <p className={styles.errorText}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
