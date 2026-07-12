function roundQuantity(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function consolidateCheckoutItems(items) {
  const quantities = new Map();

  for (const item of items || []) {
    const productId = String(item?.productId || '').trim();
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Each checkout item requires a product and positive quantity'), { status: 400 });
    }

    const rounded = roundQuantity(quantity);
    if (Math.abs(rounded - quantity) > Number.EPSILON || rounded <= 0) {
      throw Object.assign(new Error('Item quantities support at most 3 decimal places'), { status: 400 });
    }
    quantities.set(productId, roundQuantity((quantities.get(productId) || 0) + rounded));
  }

  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}

function validatePromotionForTotal(promotion, orderTotal, now = new Date()) {
  if (!promotion) {
    throw Object.assign(new Error('Invalid or inactive promotion code'), { status: 400 });
  }
  if (promotion.startsAt && now < new Date(promotion.startsAt)) {
    throw Object.assign(new Error('Promotion has not started'), { status: 400 });
  }
  if (promotion.expiresAt && now > new Date(promotion.expiresAt)) {
    throw Object.assign(new Error('Promotion has expired'), { status: 400 });
  }
  if (Number(promotion.maxUses) > 0 && Number(promotion.usedCount) >= Number(promotion.maxUses)) {
    throw Object.assign(new Error('Promotion has reached max uses'), { status: 400 });
  }
  if (Number(promotion.minOrderTotal || 0) > Number(orderTotal)) {
    throw Object.assign(
      new Error(`Promotion requires a minimum order of KES ${Number(promotion.minOrderTotal).toFixed(2)}`),
      { status: 400 }
    );
  }
  if (promotion.type === 'percent' && Number(promotion.value) > 100) {
    throw Object.assign(new Error('Percentage promotion cannot exceed 100%'), { status: 400 });
  }
}

function validateOfflineSale({
  offlineContext,
  customerId,
  discountTotal,
  promotionCode,
  redeemPoints,
  payments,
  cashierId,
  tenantId
}) {
  if (!offlineContext) return;
  if (
    Number(offlineContext.schemaVersion) !== 1 ||
    !String(offlineContext.deviceId || '').trim() ||
    !Number.isInteger(Number(offlineContext.sequence)) ||
    Number(offlineContext.sequence) <= 0 ||
    !Array.isArray(offlineContext.items)
  ) {
    throw Object.assign(new Error('Offline sale metadata is invalid or unsupported'), { status: 409 });
  }
  if (customerId || Number(discountTotal || 0) > 0 || promotionCode || Number(redeemPoints || 0) > 0) {
    throw Object.assign(
      new Error('Offline sales cannot include customers, credit, loyalty, promotions, or discounts'),
      { status: 409 }
    );
  }
  if ((payments || []).some((payment) => String(payment.method).toLowerCase() !== 'cash')) {
    throw Object.assign(new Error('Offline sales currently support cash tender only'), { status: 409 });
  }
  if (offlineContext.cashierId && offlineContext.cashierId !== cashierId) {
    throw Object.assign(new Error('Offline sale cashier does not match the authenticated cashier'), { status: 409 });
  }
  if ((offlineContext.tenantId || null) !== (tenantId || null)) {
    throw Object.assign(new Error('Offline sale tenant does not match the authenticated store'), { status: 409 });
  }
}

function validateOfflineCatalogSnapshot(offlineContext, consolidatedItems, productMap, resolveTaxCategory) {
  if (!offlineContext) return;
  const snapshots = new Map(offlineContext.items.map((item) => [item.productId, item]));
  for (const line of consolidatedItems) {
    const snapshot = snapshots.get(line.productId);
    const product = productMap.get(line.productId);
    if (!snapshot || !product || Number(snapshot.quantity) !== Number(line.quantity)) {
      throw Object.assign(new Error('Offline sale item snapshot does not match the queued cart'), { status: 409 });
    }
    if (Number(snapshot.unitPrice) !== Number(product.sellingPrice)) {
      throw Object.assign(
        new Error(`Price changed for "${product.name}" while this sale was offline. Manager review is required.`),
        { status: 409 }
      );
    }
    if (snapshot.taxCategory !== resolveTaxCategory(product)) {
      throw Object.assign(
        new Error(`Tax classification changed for "${product.name}" while this sale was offline. Manager review is required.`),
        { status: 409 }
      );
    }
  }
}

module.exports = {
  consolidateCheckoutItems,
  validateOfflineCatalogSnapshot,
  validateOfflineSale,
  validatePromotionForTotal
};
