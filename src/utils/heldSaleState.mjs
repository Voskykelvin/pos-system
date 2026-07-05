export const MAX_HELD_SALES = 8;
export const STALE_HELD_SALE_MINUTES = 30;

export function createHeldSaleId() {
  return globalThis.crypto?.randomUUID?.() || `held-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function heldSalesStorageKey(user) {
  return `jijenge-held-sales:${user?.tenantId || user?.id || 'default'}`;
}

export function buildHeldSaleLabel(snapshot) {
  if (snapshot.customer?.name || snapshot.customer?.phone) {
    return snapshot.customer.name || snapshot.customer.phone;
  }
  if (snapshot.cart?.length > 0) {
    return snapshot.cart[0].name;
  }
  return 'Walk-in customer';
}

export function createHeldSaleSnapshot({
  cashierId,
  cashierName,
  cart,
  payments,
  customer,
  discountTotal,
  promoCode,
  promoResult,
  redeemLoyalty,
  isWholesale,
  note,
  total,
  createdAt = new Date().toISOString(),
  id = createHeldSaleId()
}) {
  const snapshot = {
    id,
    label: '',
    createdAt,
    cashierId,
    cashierName: cashierName || '',
    note: String(note || '').trim(),
    cart: Array.isArray(cart) ? cart : [],
    payments: Array.isArray(payments) ? payments : [],
    customer: customer || null,
    discountTotal: discountTotal || '',
    promoCode: promoCode || '',
    promoResult: promoResult || null,
    redeemLoyalty: Boolean(redeemLoyalty),
    isWholesale: Boolean(isWholesale),
    itemCount: (Array.isArray(cart) ? cart : []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    total: Number(Number(total || 0).toFixed(2))
  };
  snapshot.label = buildHeldSaleLabel(snapshot);
  return snapshot;
}

export function insertHeldSale(current, snapshot, max = MAX_HELD_SALES) {
  const existing = Array.isArray(current) ? current : [];
  return [snapshot, ...existing].slice(0, max);
}

export function isHeldSaleStale(sale, now = new Date(), minutes = STALE_HELD_SALE_MINUTES) {
  if (!sale?.createdAt) return false;
  const created = new Date(sale.createdAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(current)) return false;
  return current - created >= minutes * 60 * 1000;
}

export function formatHeldSaleAge(sale, now = new Date()) {
  if (!sale?.createdAt) return 'unknown age';
  const created = new Date(sale.createdAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(current)) return 'unknown age';

  const minutes = Math.max(Math.floor((current - created) / 60000), 0);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m ago` : `${hours}h ago`;
}
