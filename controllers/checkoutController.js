const {
  sequelize,
  Product,
  Category,
  Order,
  OrderItem,
  Payment,
  InventoryTransaction,
  EtimsInvoice,
  Customer
} = require('../models');
const { generateOrderNumber } = require('../utils/orderNumber');
const { buildEtimsPayload } = require('../utils/etimsPayload');
const { logAudit } = require('../services/auditLogger');
const { resolveManagerApproval } = require('../services/managerApproval');

// Set from your own business record / env config
const BUSINESS = {
  name: process.env.BUSINESS_NAME || 'My Mini Supermarket',
  kraPin: process.env.BUSINESS_KRA_PIN
};

// Maps a Category's taxCategory to the actual VAT rate applied at checkout.
// Adjust STANDARD_VAT_RATE if the statutory rate changes.
const STANDARD_VAT_RATE = 0.16;
const TAX_RATES = {
  standard: STANDARD_VAT_RATE,
  zero_rated: 0,
  exempt: 0
};

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
    discountTotal = 0
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

  const t = await sequelize.transaction();

  try {
    const normalizedDiscount = Number(discountTotal || 0);
    if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0) {
      throw new Error('discountTotal must be a non-negative number');
    }

    let approval = null;
    if (normalizedDiscount > 0) {
      approval = await resolveManagerApproval(req, { reason: 'discount' });
    }

    // 1. Load products and lock the rows to prevent two cashiers
    //    selling the last unit of the same item at the same time
    const productIds = items.map((i) => i.productId);
    const products = await Product.findAll({
      where: { id: productIds },
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
      const taxCategory = product.Category ? product.Category.taxCategory : 'standard';
      const taxRate = TAX_RATES[taxCategory] ?? STANDARD_VAT_RATE;
      const lineSubtotal = unitPrice * Number(line.quantity);
      const lineTax = lineSubtotal * taxRate;

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      orderItemRows.push({
        productId: product.id,
        quantity: line.quantity,
        unitPrice,
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

    const total = subtotal + taxTotal - normalizedDiscount;

    const paymentSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    if (Math.abs(paymentSum - total) > 0.01) {
      throw new Error(
        `Payment total (${paymentSum}) does not match order total (${total})`
      );
    }

    // 3. Create the order. Cash is confirmed instantly; mpesa/card stay
    // pending until their callback/confirmation arrives, so the order's
    // paymentStatus reflects whichever payment method needs the longest.
    const anyPending = payments.some((p) => p.method !== 'cash');
    const orderNumber = await generateOrderNumber();
    const order = await Order.create({
      orderNumber,
      cashierId,
      customerId: customerId || null,
      subtotal,
      taxTotal,
      discountTotal: normalizedDiscount,
      total,
      status: 'completed',
      paymentStatus: anyPending ? 'pending' : 'paid'
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

    // 5. Create payment records
    const createdPayments = [];
    for (const p of payments) {
      const paymentRow = await Payment.create({
        orderId: order.id,
        method: p.method,
        amount: p.amount,
        status: p.method === 'cash' ? 'confirmed' : 'pending',
        mpesaPhone: p.mpesaPhone || null
      }, { transaction: t });
      createdPayments.push(paymentRow);
    }

    // 6. Queue the eTIMS invoice for later transmission (offline-first)
    let customerKraPin = null;
    if (customerId) {
      const customer = await Customer.findByPk(customerId, { transaction: t });
      customerKraPin = customer ? customer.kraPin : null;
    }

    const payload = buildEtimsPayload({
      order: { ...order.toJSON(), customerKraPin },
      orderItems: etimsLineItems,
      business: BUSINESS
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
        discountTotal: normalizedDiscount,
        paymentMethods: payments.map((p) => p.method)
      },
      transaction: t
    });

    await t.commit();

    return res.status(201).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentStatus: order.paymentStatus,
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
