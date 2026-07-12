const {
  sequelize,
  Branch,
  Product,
  BranchInventory,
  StockTransfer,
  StockTransferItem,
  InventoryTransaction
} = require('../models');
const { tenantWhere } = require('../utils/tenantScope');
const { logAudit } = require('../services/auditLogger');

async function list(req, res) {
  const transfers = await StockTransfer.findAll({
    where: tenantWhere(req),
    include: [
      { model: Branch, as: 'sourceBranch', attributes: ['id', 'name', 'code'] },
      { model: Branch, as: 'destinationBranch', attributes: ['id', 'name', 'code'] },
      { model: StockTransferItem, include: [{ model: Product, attributes: ['id', 'sku', 'name', 'unit'] }] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50
  });
  return res.json(transfers);
}

async function create(req, res) {
  const { sourceBranchId, destinationBranchId, note } = req.body;
  if (sourceBranchId === destinationBranchId) return res.status(400).json({ error: 'Source and destination branches must differ' });
  const quantities = new Map();
  for (const item of req.body.items) {
    const quantity = Number(item.quantity);
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + quantity);
  }
  const transaction = await sequelize.transaction();
  try {
    const branches = await Branch.findAll({
      where: { id: [sourceBranchId, destinationBranchId], tenantId: req.tenantId, isActive: true },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (branches.length !== 2) throw Object.assign(new Error('Both branches must be active and belong to this store'), { status: 400 });
    const productIds = [...quantities.keys()].sort();
    const products = await Product.findAll({ where: tenantWhere(req, { id: productIds, isActive: true }), transaction, lock: transaction.LOCK.UPDATE });
    if (products.length !== productIds.length) throw Object.assign(new Error('One or more transfer products were not found'), { status: 400 });
    const lotTracked = products.filter((product) => product.tracksLots);
    if (lotTracked.length) {
      throw Object.assign(new Error(`Lot-tracked products require a lot-specific transfer: ${lotTracked.map((product) => product.name).join(', ')}`), { status: 409 });
    }

    const transfer = await StockTransfer.create({
      tenantId: req.tenantId,
      sourceBranchId,
      destinationBranchId,
      note: note || null,
      createdByUserId: req.user.id
    }, { transaction });

    for (const productId of productIds) {
      const quantity = Math.round(quantities.get(productId) * 1000) / 1000;
      const source = await BranchInventory.findOne({ where: { branchId: sourceBranchId, productId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!source || Number(source.quantity) < quantity) {
        const product = products.find((row) => row.id === productId);
        throw Object.assign(new Error(`Insufficient source-branch stock for ${product?.name || productId}`), { status: 409 });
      }
      const [destination] = await BranchInventory.findOrCreate({
        where: { branchId: destinationBranchId, productId },
        defaults: { quantity: 0 },
        transaction
      });
      const sourceBalance = Number(source.quantity) - quantity;
      const destinationBalance = Number(destination.quantity) + quantity;
      await source.update({ quantity: sourceBalance }, { transaction });
      await destination.update({ quantity: destinationBalance }, { transaction });
      await StockTransferItem.create({ stockTransferId: transfer.id, productId, quantity }, { transaction });
      await InventoryTransaction.bulkCreate([
        { productId, branchId: sourceBranchId, type: 'transfer_out', quantity: -quantity, balanceAfter: sourceBalance, referenceType: 'stock_transfer', referenceId: transfer.id, userId: req.user.id, note },
        { productId, branchId: destinationBranchId, type: 'transfer_in', quantity, balanceAfter: destinationBalance, referenceType: 'stock_transfer', referenceId: transfer.id, userId: req.user.id, note }
      ], { transaction });
    }
    await logAudit({
      req,
      action: 'inventory.stock_transfer_completed',
      entityType: 'stock_transfer',
      entityId: transfer.id,
      metadata: { sourceBranchId, destinationBranchId, itemCount: productIds.length },
      transaction
    });
    await transaction.commit();
    return res.status(201).json({ id: transfer.id, status: 'completed' });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function balances(req, res) {
  const rows = await BranchInventory.findAll({
    where: { branchId: req.params.branchId },
    include: [
      { model: Branch, required: true, where: { tenantId: req.tenantId, isActive: true }, attributes: ['id', 'name', 'code'] },
      { model: Product, required: true, where: tenantWhere(req, { isActive: true }), attributes: ['id', 'sku', 'name', 'unit'] }
    ],
    order: [[Product, 'name', 'ASC']]
  });
  return res.json(rows);
}

module.exports = { balances, create, list };
