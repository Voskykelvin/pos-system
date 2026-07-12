const { StoreCreditTransaction } = require('../models');

async function issueStoreCredit({ customer, orderId, refundId, amount, note, userId, transaction }) {
  const balanceAfter = Math.round((Number(customer.storeCreditBalance || 0) + Number(amount)) * 100) / 100;
  await customer.update({ storeCreditBalance: balanceAfter }, { transaction });
  await StoreCreditTransaction.create({
    customerId: customer.id,
    tenantId: customer.tenantId || null,
    orderId,
    refundId,
    type: 'issued',
    amount,
    balanceAfter,
    note,
    createdByUserId: userId || null
  }, { transaction });
  return balanceAfter;
}

module.exports = { issueStoreCredit };
