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

    // Build a map of existing order items for quick lookup
    const orderItemMap = new Map(order.OrderItems.map((oi) => [oi.id, oi]));

    let refundSubtotal = 0;
    const refundLines = [];

    for (const line of items) {
      const orderItem = orderItemMap.get(line.orderItemId);
      if (!orderItem) {
        await t.rollback();
        return res.status(400).json({ error: `Order item ${line.orderItemId} not found on this order` });
      }

      const refundQty = Number(line.quantity);
      if (refundQty <= 0 || refundQty > Number(orderItem.quantity)) {
        await t.rollback();
        return res.status(400).json({
          error: `Invalid refund quantity ${refundQty} for item ${orderItem.id} (sold: ${orderItem.quantity})`
        });
      }

      refundLines.push({ orderItem, refundQty });
      refundSubtotal += Number(orderItem.unitPrice) * refundQty * (1 + Number(orderItem.taxRate));
    }

    // Restore stock for each returned line
    for (const { orderItem, refundQty } of refundLines) {
      const product = orderItem.Product;
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
    }

    // Mark the order as partial_refund
    await order.update({ status: 'partial_refund' }, { transaction: t });

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
        refundSubtotal: Number(refundSubtotal.toFixed(2))
      },
      transaction: t
    });

    await t.commit();

    return res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'partial_refund',
      refundedItems: refundLines.map((l) => ({
        orderItemId: l.orderItem.id,
        productName: l.orderItem.Product?.name || 'Unknown',
        quantity: l.refundQty
      })),
      refundSubtotal: Number(refundSubtotal.toFixed(2))
    });
  } catch (err) {
    await t.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { partialRefund };
