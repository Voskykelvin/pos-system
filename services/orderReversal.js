const {
  Product,
  InventoryTransaction,
  Customer,
  CustomerLedger,
  LoyaltyTransaction,
  BranchInventory,
  StoreCreditTransaction
} = require('../models');
const { restoreLotsForOrderItem } = require('./lotInventory');

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
  if (order.customerId) {
    const customer = await Customer.findByPk(order.customerId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (customer) {
      const creditTotal = order.Payments
        .filter((payment) => payment.method === 'credit' && payment.status === 'confirmed')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      if (creditTotal > 0) {
        const balanceBefore = Number(customer.creditBalance || 0);
        if (balanceBefore + 0.01 < creditTotal) {
          throw Object.assign(
            new Error('This credit sale has already been repaid. Use a payout refund workflow instead of reducing customer debt.'),
            { status: 409 }
          );
        }
        const balanceAfter = Math.max(balanceBefore - creditTotal, 0);
        await customer.update({ creditBalance: balanceAfter }, { transaction: t });
        await CustomerLedger.create({
          customerId: customer.id,
          tenantId: order.tenantId || null,
          orderId: order.id,
          type: 'reversal',
          amount: creditTotal,
          balanceAfter,
          notes: reason
        }, { transaction: t });
      }

      const storeCreditTotal = order.Payments
        .filter((payment) => payment.method === 'store_credit' && payment.status === 'confirmed')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      if (storeCreditTotal > 0) {
        const balanceAfter = Number(customer.storeCreditBalance || 0) + storeCreditTotal;
        await customer.update({ storeCreditBalance: balanceAfter }, { transaction: t });
        await StoreCreditTransaction.create({
          customerId: customer.id,
          tenantId: order.tenantId || null,
          orderId: order.id,
          type: 'issued',
          amount: storeCreditTotal,
          balanceAfter,
          note: `Store credit restored by reversal: ${reason}`,
          createdByUserId: userId || null
        }, { transaction: t });
      }

      const loyaltyRows = await LoyaltyTransaction.findAll({
        where: { orderId: order.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      const pointsToReverse = loyaltyRows.reduce((sum, row) => sum + Number(row.points || 0), 0);
      if (pointsToReverse !== 0) {
        const balanceBefore = Number(customer.loyaltyPoints || 0);
        const balanceAfter = balanceBefore - pointsToReverse;
        if (balanceAfter < 0) {
          throw Object.assign(
            new Error('Loyalty points earned on this sale have already been spent. Adjust the loyalty balance before reversing the order.'),
            { status: 409 }
          );
        }
        await customer.update({ loyaltyPoints: balanceAfter }, { transaction: t });
        await LoyaltyTransaction.create({
          customerId: customer.id,
          orderId: order.id,
          type: 'adjust',
          points: -pointsToReverse,
          balanceBefore,
          balanceAfter,
          note: `Reversal: ${reason}`
        }, { transaction: t });
      }
    }
  }

  for (const item of order.OrderItems) {
    const product = await Product.findByPk(item.productId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!product) continue;

    await restoreLotsForOrderItem(item.id, Number(item.quantity), t);

    const newBalance = Number(product.stockQuantity) + Number(item.quantity);
    await product.update({ stockQuantity: newBalance }, { transaction: t });
    if (order.branchId) {
      const [branchStock] = await BranchInventory.findOrCreate({
        where: { branchId: order.branchId, productId: product.id },
        defaults: { quantity: 0 },
        transaction: t
      });
      await branchStock.increment('quantity', { by: Number(item.quantity), transaction: t });
    }

    await InventoryTransaction.create({
      productId: product.id,
      type: 'return',
      quantity: item.quantity,
      balanceAfter: newBalance,
      referenceType: status === 'refunded' ? 'order_refund' : 'order_void',
      referenceId: order.id,
      note: reason,
      userId: userId || null,
      branchId: order.branchId || null
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
