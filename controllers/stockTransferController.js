const {
  sequelize,
  Branch,
  Product,
  BranchInventory,
  InventoryLot,
  StockTransfer,
  StockTransferItem,
  InventoryTransaction
} = require('../models');
const { tenantWhere } = require('../utils/tenantScope');
const { logAudit } = require('../services/auditLogger');
const { transactionalFindOrCreate } = require('../services/transactionalFindOrCreate');

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).match(/\d{4}-\d{2}-\d{2}/)?.[0] || String(value);
}

async function list(req, res) {
  const transfers = await StockTransfer.findAll({
    where: tenantWhere(req),
    include: [
      { model: Branch, as: 'sourceBranch', attributes: ['id', 'name', 'code'] },
      { model: Branch, as: 'destinationBranch', attributes: ['id', 'name', 'code'] },
      {
        model: StockTransferItem,
        include: [
          { model: Product, attributes: ['id', 'sku', 'name', 'unit', 'tracksLots'] },
          { model: InventoryLot, as: 'sourceLot', attributes: ['id', 'lotNumber', 'expiryDate'] },
          { model: InventoryLot, as: 'destinationLot', attributes: ['id', 'lotNumber', 'expiryDate'] }
        ]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50
  });
  return res.json(transfers);
}

async function create(req, res) {
  const { sourceBranchId, destinationBranchId, note } = req.body;
  if (sourceBranchId === destinationBranchId) return res.status(400).json({ error: 'Source and destination branches must differ' });
  const requestedLines = [];
  for (const item of req.body.items) {
    requestedLines.push({
      productId: item.productId,
      inventoryLotId: item.inventoryLotId || null,
      quantity: Math.round(Number(item.quantity) * 1000) / 1000
    });
  }
  const transaction = await sequelize.transaction();
  try {
    const branches = await Branch.findAll({
      where: { id: [sourceBranchId, destinationBranchId], tenantId: req.tenantId, isActive: true },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (branches.length !== 2) throw Object.assign(new Error('Both branches must be active and belong to this store'), { status: 400 });
    const productIds = [...new Set(requestedLines.map((item) => item.productId))].sort();
    const products = await Product.findAll({ where: tenantWhere(req, { id: productIds, isActive: true }), transaction, lock: transaction.LOCK.UPDATE });
    if (products.length !== productIds.length) throw Object.assign(new Error('One or more transfer products were not found'), { status: 400 });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const consolidated = new Map();
    for (const line of requestedLines) {
      const product = productMap.get(line.productId);
      if (product.tracksLots && !line.inventoryLotId) {
        throw Object.assign(new Error(`inventoryLotId is required to transfer lot-tracked product ${product.name}`), { status: 409 });
      }
      if (!product.tracksLots && line.inventoryLotId) {
        throw Object.assign(new Error(`${product.name} is not configured for lot-specific transfers`), { status: 400 });
      }
      const key = `${line.productId}:${line.inventoryLotId || '-'}`;
      const existing = consolidated.get(key);
      consolidated.set(key, existing ? { ...existing, quantity: existing.quantity + line.quantity } : line);
    }
    const transferLines = [...consolidated.values()].sort((left, right) => (
      `${left.productId}:${left.inventoryLotId || ''}`.localeCompare(`${right.productId}:${right.inventoryLotId || ''}`)
    ));

    const transfer = await StockTransfer.create({
      tenantId: req.tenantId,
      sourceBranchId,
      destinationBranchId,
      note: note || null,
      createdByUserId: req.user.id
    }, { transaction });

    let lotLineCount = 0;
    for (const line of transferLines) {
      const { productId, inventoryLotId, quantity } = line;
      const product = productMap.get(productId);
      const source = await BranchInventory.findOne({ where: { branchId: sourceBranchId, productId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!source || Number(source.quantity) < quantity) {
        throw Object.assign(new Error(`Insufficient source-branch stock for ${product?.name || productId}`), { status: 409 });
      }
      const [destination] = await transactionalFindOrCreate(BranchInventory, {
        where: { branchId: destinationBranchId, productId },
        defaults: { quantity: 0 },
        transaction
      });
      const sourceBalance = Number(source.quantity) - quantity;
      const destinationBalance = Number(destination.quantity) + quantity;
      let sourceLot = null;
      let destinationLot = null;
      let destinationLotCreated = false;
      if (inventoryLotId) {
        sourceLot = await InventoryLot.findOne({
          where: tenantWhere(req, { id: inventoryLotId, branchId: sourceBranchId, productId }),
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (!sourceLot) throw Object.assign(new Error(`Source lot ${inventoryLotId} was not found for ${product.name}`), { status: 400 });
        if (Number(sourceLot.availableQuantity) < quantity) {
          throw Object.assign(new Error(`Insufficient quantity in lot ${sourceLot.lotNumber} for ${product.name}`), { status: 409 });
        }
        [destinationLot, destinationLotCreated] = await transactionalFindOrCreate(InventoryLot, {
          where: { branchId: destinationBranchId, productId, lotNumber: sourceLot.lotNumber },
          defaults: {
            tenantId: req.tenantId,
            supplierId: sourceLot.supplierId,
            purchaseOrderId: sourceLot.purchaseOrderId,
            expiryDate: sourceLot.expiryDate,
            receivedQuantity: quantity,
            availableQuantity: quantity,
            unitCost: sourceLot.unitCost,
            receivedAt: sourceLot.receivedAt
          },
          transaction
        });
        if (dateOnly(destinationLot.expiryDate) && dateOnly(sourceLot.expiryDate)
          && dateOnly(destinationLot.expiryDate) !== dateOnly(sourceLot.expiryDate)) {
          throw Object.assign(new Error(`Lot ${sourceLot.lotNumber} has conflicting expiry dates between branches`), { status: 409 });
        }
        await sourceLot.update({ availableQuantity: Number(sourceLot.availableQuantity) - quantity }, { transaction });
        if (!destinationLotCreated) {
          await destinationLot.update({
            receivedQuantity: Number(destinationLot.receivedQuantity) + quantity,
            availableQuantity: Number(destinationLot.availableQuantity) + quantity,
            expiryDate: destinationLot.expiryDate || sourceLot.expiryDate
          }, { transaction });
        }
        lotLineCount += 1;
      }
      await source.update({ quantity: sourceBalance }, { transaction });
      await destination.update({ quantity: destinationBalance }, { transaction });
      await StockTransferItem.create({
        stockTransferId: transfer.id,
        productId,
        sourceInventoryLotId: sourceLot?.id || null,
        destinationInventoryLotId: destinationLot?.id || null,
        quantity
      }, { transaction });
      await InventoryTransaction.bulkCreate([
        { productId, branchId: sourceBranchId, inventoryLotId: sourceLot?.id || null, type: 'transfer_out', quantity: -quantity, balanceAfter: sourceBalance, referenceType: 'stock_transfer', referenceId: transfer.id, userId: req.user.id, note },
        { productId, branchId: destinationBranchId, inventoryLotId: destinationLot?.id || null, type: 'transfer_in', quantity, balanceAfter: destinationBalance, referenceType: 'stock_transfer', referenceId: transfer.id, userId: req.user.id, note }
      ], { transaction });
    }
    await logAudit({
      req,
      action: 'inventory.stock_transfer_completed',
      entityType: 'stock_transfer',
      entityId: transfer.id,
      metadata: { sourceBranchId, destinationBranchId, itemCount: transferLines.length, lotLineCount },
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
      { model: Product, required: true, where: tenantWhere(req, { isActive: true }), attributes: ['id', 'sku', 'name', 'unit', 'tracksLots'] }
    ],
    order: [[Product, 'name', 'ASC']]
  });
  return res.json(rows);
}

module.exports = { balances, create, list };
