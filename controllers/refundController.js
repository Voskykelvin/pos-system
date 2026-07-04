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

    await reverseOrder(
      order,
      { reason: reason || 'Order refunded', userId, status: 'refunded' },
      t
    );

    await logAudit({
      req,
      action: 'order.refund',
      entityType: 'order',
      entityId: order.id,
      approvedByUserId: approval.approvedByUserId,
      metadata: {
        orderNumber: order.orderNumber,
        reason: reason || 'Order refunded'
      },
      transaction: t
    });

    await t.commit();

    return res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'refunded'
    });
  } catch (err) {
    await t.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { refundOrder };
