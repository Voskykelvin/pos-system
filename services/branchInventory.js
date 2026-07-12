const { Branch, BranchInventory } = require('../models');

async function resolveOperationalBranch(req, transaction) {
  if (!req.tenantId) return null;
  if (req.user?.branchId) return req.user.branchId;
  const branch = await Branch.findOne({
    where: { tenantId: req.tenantId, isActive: true },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: transaction?.LOCK?.UPDATE
  });
  return branch?.id || null;
}

async function addBranchStock({ branchId, productId, quantity, transaction }) {
  if (!branchId) return null;
  const [balance] = await BranchInventory.findOrCreate({
    where: { branchId, productId },
    defaults: { quantity: 0 },
    transaction
  });
  const next = Number(balance.quantity) + Number(quantity);
  if (next < 0) throw Object.assign(new Error('Branch adjustment would result in negative stock'), { status: 409 });
  await balance.update({ quantity: next }, { transaction });
  return next;
}

module.exports = { addBranchStock, resolveOperationalBranch };
