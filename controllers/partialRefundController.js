'use strict';

const {
  sequelize,
  Order,
  OrderItem,
  Product,
  Payment,
  EtimsInvoice,
  InventoryTransaction
} = require('../models');
const { logAudit } = require('../services/auditLogger');
const { resolveManagerApproval } = require('../services/managerApproval');
const { tenantWhere } = require('../utils/tenantScope');
const { invalidateTenantCache } = require('./reportController');
const { allocateTender, calculatePartialRefund, persistRefund, roundMoney } = require('../services/refundLedger');

/**
 * POST /api/orders/:id/refund/partial
 *
 * Body: {
 *   items: [{ orderItemId: UUID, quantity: number }],
 *   reason: string (optional)
 * }
 *
 * Returns stock for the specified items/quantities only.
 * The order remains 'completed' if items remain, or transitions to 'partial_refund'.
 * Blocks if the eTIMS invoice is already transmitted (credit note required).
 */
async function partialRefund(req, res) {
  const { id } = req.params;
  const { items, reason } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required and must be a non-empty array' });
  }

  const t = await sequelize.transaction();

  try {
    const approval = await resolveManagerApproval(req, { reason: 'partial refund' });

    const order = await Order.findOne({
      where: tenantWhere(req, { id }),
      include: [
        { model: OrderItem, include: [{ model: Product }] },
        { model: Payment },
        { model: EtimsInvoice }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['completed', 'partial_refund'].includes(order.status)) {
      await t.rollback();
      return res.status(400).json({
        error: `Order is ${order.status} - cannot partially refund`
      });
    }

    if (order.EtimsInvoice?.status === 'transmitted') {
      await t.rollback();
      return res.status(409).json({
        error: 'This order has been reported to KRA eTIMS. A credit note is required before refunding.'
      });
    }

    if (order.Payments.some((payment) => payment.method === 'credit')) {
      await t.rollback();
      return res.status(409).json({
        error: 'Partial refunds for credit sales require a debt-adjustment and payout workflow. Use a full refund or settle the tender manually.'
      });
    }

    // Consolidate duplicate request lines before checking cumulative quantities.
    const requestedQuantities = new Map();
    for (const line of items) {
      const itemId = String(line.orderItemId || '');
      const quantity = Number(line.quantity);
      requestedQuantities.set(itemId, (requestedQuantities.get(itemId) || 0) + quantity);
    }

    // Build a map of existing order items for quick lookup
    const orderItemMap = new Map(order.OrderItems.map((oi) => [oi.id, oi]));

    const refundLines = [];

    for (const [orderItemId, refundQty] of requestedQuantities) {
      const orderItem = orderItemMap.get(orderItemId);
      if (!orderItem) {
        await t.rollback();
        return res.status(400).json({ error: `Order item ${orderItemId} not found on this order` });
      }

      const alreadyRefunded = Number(orderItem.refundedQuantity || 0);
      const remainingQuantity = Number(orderItem.quantity) - alreadyRefunded;
      const roundedRefundQty = Math.round(refundQty * 1000) / 1000;
      if (
        !Number.isFinite(refundQty) ||
        Math.abs(roundedRefundQty - refundQty) > Number.EPSILON ||
        refundQty <= 0 ||
        refundQty > remainingQuantity
      ) {
        await t.rollback();
        return res.status(400).json({
          error: `Invalid refund quantity ${refundQty} for item ${orderItem.id} (remaining refundable: ${remainingQuantity})`
        });
      }

      refundLines.push({ orderItem, refundQty, alreadyRefunded });
    }

    const fullyRefunded = order.OrderItems.every((item) => {
      const currentLine = refundLines.find((line) => line.orderItem.id === item.id);
      const returned = Number(item.refundedQuantity || 0) + Number(currentLine?.refundQty || 0);
      return Math.abs(returned - Number(item.quantity)) < 0.001;
    });
    const accounting = calculatePartialRefund(order, refundLines);
    if (fullyRefunded) {
      const target = {
        subtotal: roundMoney(Number(order.subtotal) - Number(order.refundedSubtotal || 0)),
        taxTotal: roundMoney(Number(order.taxTotal) - Number(order.refundedTaxTotal || 0)),
        discountTotal: roundMoney(Number(order.discountTotal) - Number(order.refundedDiscountTotal || 0)),
        total: roundMoney(Number(order.total) - Number(order.refundedTotal || 0))
      };
      const finalLine = accounting.lines[accounting.lines.length - 1];
      finalLine.total = roundMoney(finalLine.total + target.total - accounting.total);
      finalLine.taxTotal = roundMoney(finalLine.taxTotal + target.taxTotal - accounting.taxTotal);
      finalLine.discountTotal = roundMoney(finalLine.discountTotal + target.discountTotal - accounting.discountTotal);
      Object.assign(accounting, target, {
        tenderAllocations: allocateTender(order.Payments, target.total)
      });
    }
    const remainingOrderValue = roundMoney(Number(order.total) - Number(order.refundedTotal || 0));
    if (accounting.total > remainingOrderValue + 0.01) {
      throw Object.assign(new Error('Refund total exceeds the remaining order value'), { status: 409 });
    }

    // Restore stock for each returned line
    for (const { orderItem, refundQty, alreadyRefunded } of refundLines) {
      const product = await Product.findByPk(orderItem.productId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (product) {
        const newBalance = Number(product.stockQuantity) + refundQty;
        await product.update({ stockQuantity: newBalance }, { transaction: t });
        await InventoryTransaction.create({
          productId: product.id,
          type: 'return',
          quantity: refundQty,
          balanceAfter: newBalance,
          referenceType: 'order',
          referenceId: order.id,
          userId: req.user?.id || null,
          note: reason || 'Partial refund'
        }, { transaction: t });
      }
      await orderItem.update({
        refundedQuantity: alreadyRefunded + refundQty
      }, { transaction: t });
    }

    let refundedSubtotal = roundMoney(Number(order.refundedSubtotal || 0) + accounting.subtotal);
    let refundedTaxTotal = roundMoney(Number(order.refundedTaxTotal || 0) + accounting.taxTotal);
    let refundedDiscountTotal = roundMoney(Number(order.refundedDiscountTotal || 0) + accounting.discountTotal);
    let refundedTotal = roundMoney(Number(order.refundedTotal || 0) + accounting.total);
    if (fullyRefunded) {
      refundedSubtotal = Number(order.subtotal);
      refundedTaxTotal = Number(order.taxTotal);
      refundedDiscountTotal = Number(order.discountTotal);
      refundedTotal = Number(order.total);
    }

    const refund = await persistRefund({
      order,
      userId: req.user?.id,
      type: 'partial',
      reason: reason || 'Partial refund',
      accounting,
      transaction: t
    });

    await order.update({
      status: fullyRefunded ? 'refunded' : 'partial_refund',
      paymentStatus: fullyRefunded ? 'reversed' : 'partial',
      refundedSubtotal,
      refundedTaxTotal,
      refundedDiscountTotal,
      refundedTotal
    }, { transaction: t });

    if (fullyRefunded && order.EtimsInvoice && order.EtimsInvoice.status !== 'transmitted') {
      await order.EtimsInvoice.update({ status: 'cancelled' }, { transaction: t });
    }

    await logAudit({
      req,
      action: 'order.partial_refund',
      entityType: 'order',
      entityId: order.id,
      approvedByUserId: approval.approvedByUserId,
      metadata: {
        orderNumber: order.orderNumber,
        reason: reason || 'Partial refund',
        refundedItems: refundLines.map((l) => ({
          orderItemId: l.orderItem.id,
          quantity: l.refundQty
        })),
        refundId: refund.id,
        refundSubtotal: accounting.subtotal,
        refundTaxTotal: accounting.taxTotal,
        refundDiscountTotal: accounting.discountTotal,
        refundTotal: accounting.total
      },
      transaction: t
    });

    await t.commit();

    invalidateTenantCache(req.tenantId);

    return res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      refundId: refund.id,
      status: fullyRefunded ? 'refunded' : 'partial_refund',
      refundedItems: refundLines.map((l) => ({
        orderItemId: l.orderItem.id,
        productName: l.orderItem.Product?.name || 'Unknown',
        quantity: l.refundQty,
        refundableQuantity: Number(l.orderItem.quantity) - (l.alreadyRefunded + l.refundQty)
      })),
      refundSubtotal: accounting.subtotal,
      refundTaxTotal: accounting.taxTotal,
      refundDiscountTotal: accounting.discountTotal,
      refundTotal: accounting.total,
      tenderAllocations: accounting.tenderAllocations
    });
  } catch (err) {
    await t.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { partialRefund };
