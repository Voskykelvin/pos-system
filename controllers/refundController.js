const {
  sequelize,
  Order,
  OrderItem,
  Payment,
  EtimsInvoice,
  Customer
} = require('../models');
const { reverseOrder } = require('../services/orderReversal');
const { logAudit } = require('../services/auditLogger');
const { resolveManagerApproval } = require('../services/managerApproval');
const { tenantWhere } = require('../utils/tenantScope');
const { invalidateTenantCache } = require('./reportController');
const { fullRefundAccounting, persistRefund } = require('../services/refundLedger');
const { queueCreditNote } = require('../services/etimsCreditNotes');
const { issueStoreCredit } = require('../services/storeCredit');

async function refundOrder(req, res) {
  const { id } = req.params;
  const { reason, refundMethod = 'original' } = req.body;
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

    const accounting = fullRefundAccounting(order);
    if (refundMethod === 'store_credit') {
      accounting.tenderAllocations = [{ method: 'store_credit', amount: accounting.total }];
    }
    const refund = await persistRefund({
      order,
      userId,
      type: 'full',
      reason: reason || 'Order refunded',
      accounting,
      transaction: t
    });
    const creditNote = await queueCreditNote({ order, refund, accounting, transaction: t });
    let storeCreditIssued = 0;
    if (refundMethod === 'store_credit') {
      if (!order.customerId) throw Object.assign(new Error('Store-credit refunds require a customer on the sale'), { status: 409 });
      const customer = await Customer.findByPk(order.customerId, { transaction: t, lock: t.LOCK.UPDATE });
      const restoredTender = order.Payments
        .filter((payment) => payment.method === 'store_credit' && payment.status === 'confirmed')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      storeCreditIssued = Math.max(0, accounting.total - restoredTender);
      if (storeCreditIssued > 0) {
        await issueStoreCredit({ customer, orderId: order.id, refundId: refund.id, amount: storeCreditIssued, note: reason || 'Refund to store credit', userId, transaction: t });
      }
    }

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
      fiscalCreditNoteQueued: Boolean(creditNote),
      storeCreditIssued,
      status: 'refunded'
    });
  } catch (err) {
    await t.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { refundOrder };
