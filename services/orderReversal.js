const {
  Product,
  InventoryTransaction
} = require('../models');

/**
 * Restores stock, marks payments reversed, cancels the eTIMS invoice if it
 * hasn't been transmitted yet, and flags the order voided. Shared between
 * the manual /void endpoint and automatic reversal when an mpesa payment
 * fails after checkout.
 *
 * Caller is responsible for the transaction and for checking order.status
 * and EtimsInvoice.status === 'transmitted' before calling this.
 */
async function reverseOrder(order, { reason, userId, status = 'voided' }, t) {
  for (const item of order.OrderItems) {
    const product = await Product.findByPk(item.productId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!product) continue;

    const newBalance = Number(product.stockQuantity) + Number(item.quantity);
    await product.update({ stockQuantity: newBalance }, { transaction: t });

    await InventoryTransaction.create({
      productId: product.id,
      type: 'return',
      quantity: item.quantity,
      balanceAfter: newBalance,
      referenceType: status === 'refunded' ? 'order_refund' : 'order_void',
      referenceId: order.id,
      note: reason,
      userId: userId || null
    }, { transaction: t });
  }

  for (const payment of order.Payments) {
    if (payment.status === 'confirmed' || payment.status === 'pending') {
      await payment.update({ status: 'reversed' }, { transaction: t });
    }
  }

  if (order.EtimsInvoice && order.EtimsInvoice.status !== 'transmitted') {
    await order.EtimsInvoice.update({ status: 'cancelled' }, { transaction: t });
  }

  await order.update({ status, paymentStatus: 'reversed' }, { transaction: t });
}

module.exports = { reverseOrder };
