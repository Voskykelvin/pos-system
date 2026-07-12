const {
  sequelize,
  Order,
  OrderItem,
  Payment,
  EtimsInvoice
} = require('../models');
const { reverseOrder } = require('../services/orderReversal');
const { logAudit } = require('../services/auditLogger');
const { resolveManagerApproval } = require('../services/managerApproval');
const { tenantWhere } = require('../utils/tenantScope');
const { invalidateTenantCache } = require('./reportController');
const { fullRefundAccounting, persistRefund } = require('../services/refundLedger');

async function refundOrder(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user?.id;

  const t = await sequelize.transaction();

  try {
    const approval = await resolveManagerApproval(req, { reason: 'order refund' });
    const order = await Order.findOne({
      where: tenantWhere(req, { id }),
      include: [
        { model: OrderItem },
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

    if (order.status !== 'completed') {
      await t.rollback();
      return res.status(400).json({
        error: `Order is ${order.status}, cannot refund`
      });
    }

    if (order.EtimsInvoice?.status === 'transmitted') {
      await t.rollback();
      return res.status(409).json({
        error:
          'This order has already been reported to KRA eTIMS. A credit note flow is required before refunding.'
      });
    }

    const accounting = fullRefundAccounting(order);
    const refund = await persistRefund({
      order,
      userId,
      type: 'full',
      reason: reason || 'Order refunded',
      accounting,
      transaction: t
    });

    await reverseOrder(
      order,
      { reason: reason || 'Order refunded', userId, status: 'refunded' },
      t
    );
    await order.update({
      refundedSubtotal: accounting.subtotal,
      refundedTaxTotal: accounting.taxTotal,
      refundedDiscountTotal: accounting.discountTotal,
      refundedTotal: accounting.total
    }, { transaction: t });

    await logAudit({
      req,
      action: 'order.refund',
      entityType: 'order',
      entityId: order.id,
      approvedByUserId: approval.approvedByUserId,
      metadata: {
        orderNumber: order.orderNumber,
        refundId: refund.id,
        reason: reason || 'Order refunded'
      },
      transaction: t
    });

    await t.commit();

    invalidateTenantCache(req.tenantId);

    return res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      refundId: refund.id,
      refundTotal: accounting.total,
      status: 'refunded'
    });
  } catch (err) {
    await t.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { refundOrder };
