const { sequelize, StockCount, StockCountItem, Product, InventoryTransaction, BranchInventory } = require('../models');
const { tenantWhere } = require('../utils/tenantScope');
const { logAudit } = require('../services/auditLogger');
const { resolveOperationalBranch } = require('../services/branchInventory');

const includeItems = [{ model: StockCountItem, include: [{ model: Product, attributes: ['id', 'sku', 'name', 'unit'] }] }];

async function list(req, res) {
  const rows = await StockCount.findAll({
    where: tenantWhere(req),
    include: includeItems,
    order: [['createdAt', 'DESC']],
    limit: 30
  });
  return res.json(rows);
}

async function create(req, res) {
  const productIds = [...new Set(req.body.productIds || [])];
  const transaction = await sequelize.transaction();
  try {
    const products = await Product.findAll({
      where: tenantWhere(req, { id: productIds, isActive: true }),
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (products.length !== productIds.length) throw Object.assign(new Error('One or more products were not found'), { status: 400 });
    const lotTracked = products.filter((product) => product.tracksLots);
    if (lotTracked.length) {
      throw Object.assign(new Error(`Count lot-tracked stock by lot to preserve expiry balances: ${lotTracked.map((product) => product.name).join(', ')}`), { status: 409 });
    }
    const branchId = await resolveOperationalBranch(req, transaction);
    const branchRows = branchId
      ? await BranchInventory.findAll({ where: { branchId, productId: productIds }, transaction, lock: transaction.LOCK.UPDATE })
      : [];
    const branchMap = new Map(branchRows.map((row) => [row.productId, row]));
    const count = await StockCount.create({
      tenantId: req.tenantId || null,
      branchId,
      note: req.body.note || null,
      createdByUserId: req.user.id
    }, { transaction });
    await StockCountItem.bulkCreate(products.map((product) => ({
      stockCountId: count.id,
      productId: product.id,
      expectedQuantity: branchId ? Number(branchMap.get(product.id)?.quantity || 0) : product.stockQuantity
    })), { transaction });
    await transaction.commit();
    return res.status(201).json(await StockCount.findByPk(count.id, { include: includeItems }));
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function record(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const count = await StockCount.findOne({ where: tenantWhere(req, { id: req.params.id, status: 'draft' }), transaction, lock: transaction.LOCK.UPDATE });
    if (!count) throw Object.assign(new Error('Draft stock count not found'), { status: 404 });
    for (const line of req.body.items) {
      const item = await StockCountItem.findOne({ where: { stockCountId: count.id, productId: line.productId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!item) throw Object.assign(new Error(`Product ${line.productId} is not in this count`), { status: 400 });
      const counted = Math.round(Number(line.countedQuantity) * 1000) / 1000;
      await item.update({ countedQuantity: counted, variance: counted - Number(item.expectedQuantity) }, { transaction });
    }
    await transaction.commit();
    return res.json(await StockCount.findByPk(count.id, { include: includeItems }));
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function complete(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const count = await StockCount.findOne({
      where: tenantWhere(req, { id: req.params.id, status: 'draft' }),
      include: [{ model: StockCountItem }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!count) throw Object.assign(new Error('Draft stock count not found'), { status: 404 });
    if (count.StockCountItems.some((item) => item.countedQuantity === null)) {
      throw Object.assign(new Error('Every product must be counted before completion'), { status: 409 });
    }
    for (const item of count.StockCountItems) {
      const product = await Product.findByPk(item.productId, { transaction, lock: transaction.LOCK.UPDATE });
      const counted = Number(item.countedQuantity);
      let liveVariance;
      let balanceAfter;
      if (count.branchId) {
        const [branchStock] = await BranchInventory.findOrCreate({
          where: { branchId: count.branchId, productId: product.id },
          defaults: { quantity: 0 },
          transaction
        });
        liveVariance = counted - Number(branchStock.quantity);
        balanceAfter = counted;
        await branchStock.update({ quantity: counted }, { transaction });
        await product.update({ stockQuantity: Number(product.stockQuantity) + liveVariance }, { transaction });
      } else {
        liveVariance = counted - Number(product.stockQuantity);
        balanceAfter = counted;
        await product.update({ stockQuantity: counted }, { transaction });
      }
      if (Math.abs(liveVariance) >= 0.001) {
        await InventoryTransaction.create({
          productId: product.id,
          type: 'adjustment',
          quantity: liveVariance,
          balanceAfter,
          referenceType: 'stock_count',
          referenceId: count.id,
          userId: req.user.id,
          note: count.note || 'Stock count variance',
          branchId: count.branchId || null
        }, { transaction });
      }
    }
    await count.update({ status: 'completed', completedByUserId: req.user.id, completedAt: new Date() }, { transaction });
    await logAudit({ req, action: 'inventory.stock_count_completed', entityType: 'stock_count', entityId: count.id, metadata: { itemCount: count.StockCountItems.length }, transaction });
    await transaction.commit();
    return res.json({ id: count.id, status: 'completed' });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, create, record, complete };
