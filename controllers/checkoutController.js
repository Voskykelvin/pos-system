const {
  sequelize,
  Product,
  Category,
  Order,
  OrderItem,
  Payment,
  InventoryTransaction,
  EtimsInvoice,
  Customer,
  LoyaltyTransaction,
  Promotion,
  CustomerLedger
} = require('../models');
const { generateOrderNumber } = require('../utils/orderNumber');
const { buildEtimsPayload } = require('../utils/etimsPayload');
const { logAudit } = require('../services/auditLogger');
const { resolveManagerApproval } = require('../services/managerApproval');
const { sendReceipt } = require('../services/smsService');
const { tenantWhere } = require('../utils/tenantScope');
const { resolveTenantConfig } = require('../utils/tenantConfig');
const { assertPlanFeature } = require('../middleware/planEnforcement');
const {
  resolveProductTaxCategory,
  taxRateForCategory
} = require('../utils/taxCategories');

// Loyalty: 1 point earned per KES 100 spent (configurable)
const LOYALTY_POINTS_PER_100 = Number(process.env.LOYALTY_POINTS_PER_100 || 1);

/**
 * POST /api/orders/checkout
 * Body: {
 *   cashierId, customerId (optional),
 *   items: [{ productId, quantity }],
 *   payments: [{ method, amount, mpesaPhone (optional) }],
 *   discountTotal (optional)
 * }
 */
async function checkout(req, res) {
  const {
    cashierId: bodyCashierId,
    customerId,
    items,
    payments,
    discountTotal = 0,
    promotionCode,    // optional promo code string
    redeemPoints = 0  // optional loyalty points to redeem
  } = req.body;
  const cashierId = req.user?.id || bodyCashierId;

  if (!cashierId) {
    return res.status(400).json({ error: 'cashierId is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'At least one payment is required' });
  }
  if (payments.some((p) => p.method === 'credit') && !customerId) {
    return res.status(400).json({ error: 'Credit payments require a selected customer' });
  }

  try {
    if (payments.some((p) => p.method === 'credit')) {
      await assertPlanFeature(req, 'customer_credit');
    }
    if (Number(redeemPoints || 0) > 0) {
      await assertPlanFeature(req, 'loyalty');
    }
    if (promotionCode) {
      await assertPlanFeature(req, 'promotions');
    }
  } catch (err) {
    return res.status(err.status || 403).json({ error: err.message });
  }

  const runtimeConfig = await resolveTenantConfig(req.tenantId);
  const t = await sequelize.transaction();

  try {
    const normalizedDiscount = Number(discountTotal || 0);
    if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0) {
      throw new Error('discountTotal must be a non-negative number');
    }

    // Resolve promotion code if supplied
    let appliedPromotion = null;
    let promoDiscount = 0;
    if (promotionCode) {
      const promo = await Promotion.findOne({
        where: tenantWhere(req, { code: String(promotionCode).trim().toUpperCase(), isActive: true })
      });
      if (!promo) throw Object.assign(new Error('Invalid or inactive promotion code'), { status: 400 });
      const now = new Date();
      if (promo.startsAt && now < new Date(promo.startsAt)) throw Object.assign(new Error('Promotion has not started'), { status: 400 });
      if (promo.expiresAt && now > new Date(promo.expiresAt)) throw Object.assign(new Error('Promotion has expired'), { status: 400 });
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) throw Object.assign(new Error('Promotion has reached max uses'), { status: 400 });
      appliedPromotion = promo;
    }

    let approval = null;
    if (normalizedDiscount > 0) {
      approval = await resolveManagerApproval(req, { reason: 'discount' });
    }

    // 1. Load products and lock the rows to prevent two cashiers
    //    selling the last unit of the same item at the same time
    const productIds = items.map((i) => i.productId);
    const products = await Product.findAll({
      where: tenantWhere(req, { id: productIds }),
      include: [{ model: Category }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Validate stock and compute totals
    let subtotal = 0;
    let taxTotal = 0;
    const orderItemRows = [];
    const etimsLineItems = [];

    for (const line of items) {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new Error(`Product ${line.productId} not found`);
      }
      if (!product.isActive) {
        throw new Error(`Product "${product.name}" is not active`);
      }
      if (Number(product.stockQuantity) < Number(line.quantity)) {
        throw new Error(`Insufficient stock for "${product.name}"`);
      }

      const unitPrice = Number(product.sellingPrice);
      const taxCategory = resolveProductTaxCategory(product);
      const taxRate = taxRateForCategory(taxCategory);
      const lineSubtotal = unitPrice * Number(line.quantity);
      const lineTax = lineSubtotal * taxRate;

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      orderItemRows.push({
        productId: product.id,
        quantity: line.quantity,
        unitPrice,
        costPrice: product.costPrice || 0,
        taxRate,
        lineTotal: lineSubtotal + lineTax
      });

      etimsLineItems.push({
        productName: product.name,
        quantity: line.quantity,
        unitPrice,
        taxRate,
        taxCategory,
        lineTotal: lineSubtotal + lineTax
      });
    }

    if (normalizedDiscount >= subtotal + taxTotal) {
      throw new Error('discountTotal cannot be equal to or greater than the sale total');
    }

    // Apply promotion on top of any manual discount
    if (appliedPromotion) {
      const base = subtotal + taxTotal - normalizedDiscount;
      promoDiscount = appliedPromotion.type === 'percent'
        ? base * (Number(appliedPromotion.value) / 100)
        : Math.min(Number(appliedPromotion.value), base);
    }

    // Calculate loyalty redemption discount
    let loyaltyDiscount = 0;
    const numRedeemPoints = Math.max(Number(redeemPoints || 0), 0);
    const ptsPerKes = Number(process.env.LOYALTY_POINTS_PER_KES) || 100;
    if (numRedeemPoints > 0 && customerId) {
      const cust = await Customer.findOne({ where: tenantWhere(req, { id: customerId }), transaction: t });
      if (!cust || (cust.loyaltyPoints || 0) < numRedeemPoints) {
        throw Object.assign(new Error('Insufficient customer loyalty points'), { status: 400 });
      }
      loyaltyDiscount = Math.floor(numRedeemPoints / ptsPerKes);
    }

    const combinedDiscount = normalizedDiscount + promoDiscount + loyaltyDiscount;
    const total = Math.max(subtotal + taxTotal - combinedDiscount, 0);

    const paymentSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    if (Math.abs(paymentSum - total) > 0.01) {
      throw new Error(
        `Payment total (${paymentSum.toFixed(2)}) does not match order total (${total.toFixed(2)})`
      );
    }

    // 3. Create the order
    const anyPending = payments.some((p) => !['cash', 'credit'].includes(p.method));
    const orderNumber = await generateOrderNumber();
    const order = await Order.create({
      orderNumber,
      cashierId,
      customerId: customerId || null,
      subtotal,
      taxTotal,
      discountTotal: combinedDiscount,
      total,
      status: 'completed',
      paymentStatus: anyPending ? 'pending' : 'paid',
      tenantId: req.tenantId || null,
      branchId: req.user?.branchId || null
    }, { transaction: t });

    // 4. Create order items, deduct stock, log inventory transactions
    for (const row of orderItemRows) {
      await OrderItem.create({ ...row, orderId: order.id }, { transaction: t });

      const product = productMap.get(row.productId);
      const newBalance = Number(product.stockQuantity) - Number(row.quantity);

      await product.update({ stockQuantity: newBalance }, { transaction: t });

      await InventoryTransaction.create({
        productId: product.id,
        type: 'sale',
        quantity: -row.quantity,
        balanceAfter: newBalance,
        referenceType: 'order',
        referenceId: order.id,
        userId: cashierId
      }, { transaction: t });
    }

    // 5. Create payment records and customer ledgers for credit
    const createdPayments = [];
    for (const p of payments) {
      const isCredit = p.method === 'credit';
      const paymentRow = await Payment.create({
        orderId: order.id,
        method: p.method,
        amount: p.amount,
        status: (p.method === 'cash' || isCredit) ? 'confirmed' : 'pending',
        mpesaPhone: p.mpesaPhone || null
      }, { transaction: t });
      createdPayments.push(paymentRow);

      if (isCredit && customerId) {
        const customer = await Customer.findOne({ where: tenantWhere(req, { id: customerId }), transaction: t });
        if (!customer) throw new Error('Customer not found for credit sale');

        const newBalance = Number(customer.creditBalance) + Number(p.amount);
        if (Number(customer.creditLimit) > 0 && newBalance > Number(customer.creditLimit)) {
          throw Object.assign(
            new Error(`Credit limit of ${customer.creditLimit} would be exceeded for this customer`),
            { status: 400 }
          );
        }
        await customer.update({ creditBalance: newBalance }, { transaction: t });

        await CustomerLedger.create({
          customerId: customer.id,
          tenantId: req.tenantId || null,
          orderId: order.id,
          type: 'charge',
          amount: p.amount,
          balanceAfter: newBalance,
          notes: `Credit sale for order ${order.orderNumber}`
        }, { transaction: t });
      }
    }

    // 6. Queue the eTIMS invoice for later transmission (offline-first)
    let customerKraPin = null;
    if (customerId) {
      const customer = await Customer.findOne({ where: tenantWhere(req, { id: customerId }), transaction: t });
      customerKraPin = customer ? customer.kraPin : null;
    }

    const payload = buildEtimsPayload({
      order: { ...order.toJSON(), customerKraPin },
      orderItems: etimsLineItems,
      business: runtimeConfig.business
    });

    await EtimsInvoice.create({
      orderId: order.id,
      status: 'queued',
      payload
    }, { transaction: t });

    await logAudit({
      req,
      action: 'order.checkout',
      entityType: 'order',
      entityId: order.id,
      approvedByUserId: approval?.approvedByUserId || null,
      metadata: {
        orderNumber: order.orderNumber,
        total,
        discountTotal: combinedDiscount,
        promoCode: appliedPromotion?.code || null,
        paymentMethods: payments.map((p) => p.method)
      },
      transaction: t
    });

    await t.commit();

    // -- Post-commit: award or redeem loyalty points (non-blocking) -----------------
    if (customerId) {
      try {
        const customer = await Customer.findOne({ where: tenantWhere(req, { id: customerId }) });
        if (customer) {
          let currentPoints = customer.loyaltyPoints || 0;

          // Process point redemption if requested
          if (numRedeemPoints > 0 && currentPoints >= numRedeemPoints) {
            const balanceBefore = currentPoints;
            const balanceAfter = balanceBefore - numRedeemPoints;
            await customer.update({ loyaltyPoints: balanceAfter });
            await LoyaltyTransaction.create({
              customerId: customer.id,
              orderId: order.id,
              type: 'redeem',
              points: -numRedeemPoints,
              balanceBefore,
              balanceAfter,
              note: `Redeemed on order ${order.orderNumber}`
            });
            currentPoints = balanceAfter;
          }

          // Process point earning on net total paid
          const pointsEarned = Math.floor(Number(total) / 100 * LOYALTY_POINTS_PER_100);
          if (pointsEarned > 0) {
            const balanceBefore = currentPoints;
            const balanceAfter = balanceBefore + pointsEarned;
            await customer.update({ loyaltyPoints: balanceAfter });
            await LoyaltyTransaction.create({
              customerId: customer.id,
              orderId: order.id,
              type: 'earn',
              points: pointsEarned,
              balanceBefore,
              balanceAfter,
              note: `Earned on order ${order.orderNumber}`
            });
          }

          // SMS receipt if customer has a phone and SMS is configured
          if (customer.phone) {
            sendReceipt(customer.phone, {
              orderNumber: order.orderNumber,
              total,
              businessName: runtimeConfig.business.name,
              smsConfig: runtimeConfig.sms
            }).catch(() => {}); // fire-and-forget
          }
        }
      } catch (loyaltyErr) {
        // Never fail the checkout response over loyalty/SMS errors
        console.warn('[checkout] loyalty/SMS error:', loyaltyErr.message);
      }
    }

    // Increment promotion use count (post-commit, non-blocking)
    if (appliedPromotion) {
      Promotion.increment('usedCount', { where: { id: appliedPromotion.id } }).catch(() => {});
    }

    return res.status(201).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentStatus: order.paymentStatus,
      promoApplied: appliedPromotion ? { code: appliedPromotion.code, discount: promoDiscount } : null,
      payments: createdPayments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        status: p.status
      }))
    });
  } catch (err) {
    await t.rollback();
    return res.status(err.status || 400).json({ error: err.message });
  }
}

module.exports = { checkout };
