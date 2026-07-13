const { Op } = require('sequelize');
const { sequelize, StockCount, StockCountItem, Product, InventoryLot, InventoryTransaction, Branch, BranchInventory } = require('../models');
const { tenantWhere } = require('../utils/tenantScope');
const { logAudit } = require('../services/auditLogger');
const { resolveOperationalBranch } = require('../services/branchInventory');
const { transactionalFindOrCreate } = require('../services/transactionalFindOrCreate');

const includeItems = [{
  model: StockCountItem,
  include: [
    { model: Product, attributes: ['id', 'sku', 'name', 'unit', 'tracksLots'] },
    { model: InventoryLot, attributes: ['id', 'lotNumber', 'expiryDate', 'availableQuantity'] }
  ]
}];

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
    let branchId = req.body.branchId || await resolveOperationalBranch(req, transaction);
    if (req.body.branchId) {
      const branch = await Branch.findOne({
        where: { id: req.body.branchId, tenantId: req.tenantId, isActive: true },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!branch) throw Object.assign(new Error('Count branch is not active or does not belong to this store'), { status: 400 });
      branchId = branch.id;
    }
    const lotTracked = products.filter((product) => product.tracksLots);
    if (lotTracked.length && !branchId) {
      throw Object.assign(new Error('A branch is required to count lot-tracked stock'), { status: 409 });
    }
    const branchRows = branchId
      ? await BranchInventory.findAll({ where: { branchId, productId: productIds }, transaction, lock: transaction.LOCK.UPDATE })
      : [];
    const branchMap = new Map(branchRows.map((row) => [row.productId, row]));
    const trackedIds = lotTracked.map((product) => product.id);
    const lots = trackedIds.length
      ? await InventoryLot.findAll({
        where: tenantWhere(req, {
          branchId,
          productId: trackedIds,
          availableQuantity: { [Op.gt]: 0 }
        }),
        order: [['productId', 'ASC'], ['expiryDate', 'ASC'], ['receivedAt', 'ASC'], ['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE
      })
      : [];
    for (const product of lotTracked) {
      if (!lots.some((lot) => lot.productId === product.id)) {
        throw Object.assign(new Error(`No available lot records were found for ${product.name} at this branch`), { status: 409 });
      }
    }
    const count = await StockCount.create({
      tenantId: req.tenantId || null,
      branchId,
      note: req.body.note || null,
      createdByUserId: req.user.id
    }, { transaction });
    const countItems = [];
    for (const product of products) {
      if (product.tracksLots) {
        for (const lot of lots.filter((row) => row.productId === product.id)) {
          countItems.push({
            stockCountId: count.id,
            productId: product.id,
            inventoryLotId: lot.id,
            expectedQuantity: Number(lot.availableQuantity)
          });
        }
      } else {
        countItems.push({
          stockCountId: count.id,
          productId: product.id,
          expectedQuantity: branchId ? Number(branchMap.get(product.id)?.quantity || 0) : Number(product.stockQuantity)
        });
      }
    }
    await StockCountItem.bulkCreate(countItems, { transaction });
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
      const candidates = await StockCountItem.findAll({
        where: { stockCountId: count.id, productId: line.productId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const item = line.inventoryLotId
        ? candidates.find((candidate) => candidate.inventoryLotId === line.inventoryLotId)
        : candidates.length === 1 ? candidates[0] : null;
      if (!item) {
        const message = candidates.length > 1 && !line.inventoryLotId
          ? `inventoryLotId is required when ${line.productId} has multiple count lines`
          : `Product or lot ${line.productId}/${line.inventoryLotId || '-'} is not in this count`;
        throw Object.assign(new Error(message), { status: 400 });
      }
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
      if (item.inventoryLotId) {
        const lot = await InventoryLot.findOne({
          where: tenantWhere(req, {
            id: item.inventoryLotId,
            productId: product.id,
            branchId: count.branchId
          }),
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (!lot) throw Object.assign(new Error(`Inventory lot ${item.inventoryLotId} is no longer available for this count`), { status: 409 });
        const [branchStock] = await transactionalFindOrCreate(BranchInventory, {
          where: { branchId: count.branchId, productId: product.id },
          defaults: { quantity: 0 },
          transaction
        });
        liveVariance = counted - Number(lot.availableQuantity);
        balanceAfter = Number(branchStock.quantity) + liveVariance;
        if (balanceAfter < 0) throw Object.assign(new Error(`Lot count would make branch stock negative for ${product.name}`), { status: 409 });
        await lot.update({ availableQuantity: counted }, { transaction });
        await branchStock.update({ quantity: balanceAfter }, { transaction });
        await product.update({ stockQuantity: Number(product.stockQuantity) + liveVariance }, { transaction });
      } else if (count.branchId) {
        const [branchStock] = await transactionalFindOrCreate(BranchInventory, {
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
          branchId: count.branchId || null,
          inventoryLotId: item.inventoryLotId || null
        }, { transaction });
      }
      await item.update({ variance: liveVariance }, { transaction });
    }
    await count.update({ status: 'completed', completedByUserId: req.user.id, completedAt: new Date() }, { transaction });
    await logAudit({
      req,
      action: 'inventory.stock_count_completed',
      entityType: 'stock_count',
      entityId: count.id,
      metadata: {
        itemCount: count.StockCountItems.length,
        lotItemCount: count.StockCountItems.filter((item) => item.inventoryLotId).length
      },
      transaction
    });
    await transaction.commit();
    return res.json({ id: count.id, status: 'completed' });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, create, record, complete };
