const {
  sequelize,
  Order,
  OrderItem,
  Payment,
  EtimsInvoice
} = require('../models');
const { reverseOrder } = require('../services/orderReversal');

/**
 * POST /api/orders/:id/void
 * Body: { userId, reason }
 *
 * Reverses a completed order: restores stock, marks payments as reversed,
 * flags the order voided. Blocks the void if the eTIMS invoice has already
 * been transmitted to KRA, since reversing a filed tax invoice requires a
 * proper credit note through eTIMS, not a silent delete, and that flow is
 * not built here.
 *
 * NOTE: this endpoint should sit behind role-check middleware (manager/
 * admin only) once auth is wired up. Not enforced here.
 */
async function voidOrder(req, res) {
  const { id } = req.params;
  const { userId, reason } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const t = await sequelize.transaction();

  try {
    const order = await Order.findByPk(id, {
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
        error: `Order is already ${order.status}, cannot void again`
      });
    }

    if (order.EtimsInvoice?.status === 'transmitted') {
      await t.rollback();
      return res.status(409).json({
        error:
          'This order has already been reported to KRA eTIMS. It must be reversed with a credit note, not voided directly.'
      });
    }

    await reverseOrder(order, { reason: reason || 'Order voided', userId }, t);

    await t.commit();

    return res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'voided'
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { voidOrder };

