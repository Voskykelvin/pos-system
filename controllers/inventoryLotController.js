const { Op } = require('sequelize');
const { sequelize, InventoryLot, Product, Branch, BranchInventory, InventoryTransaction } = require('../models');
const { tenantWhere } = require('../utils/tenantScope');
const { resolveOperationalBranch } = require('../services/branchInventory');
const { logAudit } = require('../services/auditLogger');
const { transactionalFindOrCreate } = require('../services/transactionalFindOrCreate');

async function list(req, res) {
  const where = tenantWhere(req, {
    ...(req.query.productId ? { productId: req.query.productId } : {}),
    ...(req.query.branchId ? { branchId: req.query.branchId } : {}),
    ...(req.query.availableOnly === 'true' ? { availableQuantity: { [Op.gt]: 0 } } : {}),
    ...(req.query.expiringBefore ? { expiryDate: { [Op.lte]: req.query.expiringBefore } } : {})
  });
  return res.json(await InventoryLot.findAll({
    where,
    include: [{ model: Product, attributes: ['id', 'sku', 'name', 'unit'] }],
    order: [['expiryDate', 'ASC'], ['receivedAt', 'ASC']],
    limit: 200
  }));
}

async function receive(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const product = await Product.findOne({ where: tenantWhere(req, { id: req.body.productId, isActive: true }), transaction, lock: transaction.LOCK.UPDATE });
    if (!product?.tracksLots) throw Object.assign(new Error('Product is not configured for lot tracking'), { status: 400 });
    const branchId = req.body.branchId || await resolveOperationalBranch(req, transaction);
    if (!branchId) throw Object.assign(new Error('A branch is required for lot receiving'), { status: 400 });
    const branchOwner = await Branch.findOne({ where: { id: branchId, tenantId: req.tenantId, isActive: true }, transaction });
    if (!branchOwner) throw Object.assign(new Error('Branch is not active or does not belong to this store'), { status: 400 });
    const quantity = Math.round(Number(req.body.quantity) * 1000) / 1000;
    const lotNumber = String(req.body.lotNumber).trim().toUpperCase();
    const [lot, created] = await transactionalFindOrCreate(InventoryLot, {
      where: { branchId, productId: product.id, lotNumber },
      defaults: {
        tenantId: req.tenantId || null,
        expiryDate: req.body.expiryDate || null,
        receivedQuantity: quantity,
        availableQuantity: quantity,
        unitCost: Number(req.body.unitCost || product.costPrice || 0)
      },
      transaction
    });
    if (!created) {
      await lot.update({
        receivedQuantity: Number(lot.receivedQuantity) + quantity,
        availableQuantity: Number(lot.availableQuantity) + quantity,
        expiryDate: req.body.expiryDate || lot.expiryDate
      }, { transaction });
    }
    const aggregate = Number(product.stockQuantity) + quantity;
    await product.update({ stockQuantity: aggregate }, { transaction });
    const [branch] = await transactionalFindOrCreate(BranchInventory, { where: { branchId, productId: product.id }, defaults: { quantity: 0 }, transaction });
    const branchBalance = Number(branch.quantity) + quantity;
    await branch.update({ quantity: branchBalance }, { transaction });
    await InventoryTransaction.create({
      productId: product.id, branchId, inventoryLotId: lot.id, type: 'purchase', quantity, balanceAfter: branchBalance,
      referenceType: 'inventory_lot', referenceId: lot.id, userId: req.user.id, note: `Lot ${lotNumber} received`
    }, { transaction });
    await logAudit({ req, action: 'inventory.lot_received', entityType: 'inventory_lot', entityId: lot.id, metadata: { productId: product.id, branchId, quantity, lotNumber }, transaction });
    await transaction.commit();
    return res.status(201).json(lot);
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function writeOff(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const lot = await InventoryLot.findOne({ where: tenantWhere(req, { id: req.params.id }), transaction, lock: transaction.LOCK.UPDATE });
    if (!lot) throw Object.assign(new Error('Inventory lot not found'), { status: 404 });
    const quantity = Math.round(Number(req.body.quantity) * 1000) / 1000;
    if (quantity > Number(lot.availableQuantity)) throw Object.assign(new Error('Write-off exceeds available lot quantity'), { status: 409 });
    const product = await Product.findByPk(lot.productId, { transaction, lock: transaction.LOCK.UPDATE });
    const branch = await BranchInventory.findOne({ where: { branchId: lot.branchId, productId: lot.productId }, transaction, lock: transaction.LOCK.UPDATE });
    const branchBalance = Number(branch.quantity) - quantity;
    await lot.update({ availableQuantity: Number(lot.availableQuantity) - quantity }, { transaction });
    await branch.update({ quantity: branchBalance }, { transaction });
    await product.update({ stockQuantity: Number(product.stockQuantity) - quantity }, { transaction });
    await InventoryTransaction.create({
      productId: product.id, branchId: lot.branchId, inventoryLotId: lot.id, type: 'wastage', quantity: -quantity, balanceAfter: branchBalance,
      referenceType: 'inventory_lot', referenceId: lot.id, userId: req.user.id, note: req.body.note || `Lot ${lot.lotNumber} write-off`
    }, { transaction });
    await logAudit({ req, action: 'inventory.lot_written_off', entityType: 'inventory_lot', entityId: lot.id, metadata: { quantity, note: req.body.note }, transaction });
    await transaction.commit();
    return res.json({ id: lot.id, availableQuantity: Number(lot.availableQuantity) });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, receive, writeOff };
