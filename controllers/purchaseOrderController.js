'use strict';

const {
  sequelize,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Product,
  InventoryTransaction,
  User,
  InventoryLot,
  BranchInventory,
  PurchaseReturn,
  PurchaseReturnItem
} = require('../models');
const { logAudit } = require('../services/auditLogger');
const { addBranchStock, resolveOperationalBranch } = require('../services/branchInventory');
const { transactionalFindOrCreate } = require('../services/transactionalFindOrCreate');
const { tenantWhere, withTenant } = require('../utils/tenantScope');

async function list(req, res) {
  try {
    const pos = await PurchaseOrder.findAll({
      where: tenantWhere(req),
      include: [
        { model: Supplier, attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: PurchaseOrderItem, as: 'items', include: [{ model: Product, attributes: ['id', 'name', 'sku', 'tracksLots'] }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    return res.json(pos);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  const { supplierId, expectedDelivery, notes, items } = req.body;
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'supplierId and at least one item are required' });
  }

  const t = await sequelize.transaction();
  try {
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    let totalCost = 0;

    const po = await PurchaseOrder.create({
      poNumber,
      supplierId,
      status: 'ordered',
      expectedDelivery: expectedDelivery || null,
      notes: notes || null,
      createdById: req.user?.id || null,
      ...withTenant(req)
    }, { transaction: t });

    for (const item of items) {
      const lineTotal = Number(item.orderedQuantity) * Number(item.unitCostPrice);
      totalCost += lineTotal;

      await PurchaseOrderItem.create({
        purchaseOrderId: po.id,
        productId: item.productId,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: 0,
        unitCostPrice: item.unitCostPrice,
        lineTotal
      }, { transaction: t });
    }

    await po.update({ totalCost }, { transaction: t });

    await logAudit({
      req,
      action: 'purchase_order.create',
      entityType: 'purchase_order',
      entityId: po.id,
      metadata: { poNumber, totalCost },
      transaction: t
    });

    await t.commit();
    return res.status(201).json(po);
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ error: err.message });
  }
}

async function receive(req, res) {
  const { id } = req.params;
  const { items } = req.body; // array of { itemId, receivedQuantity, unitCostPrice }

  const t = await sequelize.transaction();
  try {
    const po = await PurchaseOrder.findOne({
      where: tenantWhere(req, { id }),
      include: [{ model: PurchaseOrderItem, as: 'items' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!po) {
      await t.rollback();
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    if (po.status === 'received') {
      await t.rollback();
      return res.status(400).json({ error: 'Purchase Order already received' });
    }

    const poItemMap = new Map(po.items.map((i) => [i.id, i]));
    const branchId = await resolveOperationalBranch(req, t);

    for (const line of items) {
      const poItem = poItemMap.get(line.itemId);
      if (!poItem) continue;

      const recQty = Number(line.receivedQuantity);
      const newCost = Number(line.unitCostPrice || poItem.unitCostPrice);

      if (recQty > 0) {
        await poItem.update({
          receivedQuantity: recQty,
          unitCostPrice: newCost,
          lineTotal: recQty * newCost
        }, { transaction: t });

        // Update product stock and cost price
        const product = await Product.findOne({
          where: tenantWhere(req, { id: poItem.productId }),
          transaction: t
        });
        if (product) {
          let inventoryLotId = null;
          if (product.tracksLots && !line.lotNumber) {
            throw Object.assign(new Error(`Lot number is required for ${product.name}`), { status: 400 });
          }
          if (line.expiryDate && Number.isNaN(Date.parse(line.expiryDate))) {
            throw Object.assign(new Error(`Invalid expiry date for ${product.name}`), { status: 400 });
          }
          const newStock = Number(product.stockQuantity) + recQty;
          await product.update({
            stockQuantity: newStock,
            costPrice: newCost // Update running cost price
          }, { transaction: t });
          await addBranchStock({ branchId, productId: product.id, quantity: recQty, transaction: t });
          if (product.tracksLots) {
            const [lot, created] = await transactionalFindOrCreate(InventoryLot, {
              where: { branchId, productId: product.id, lotNumber: String(line.lotNumber).trim().toUpperCase() },
              defaults: {
                tenantId: req.tenantId || null,
                supplierId: po.supplierId,
                purchaseOrderId: po.id,
                expiryDate: line.expiryDate || null,
                receivedQuantity: recQty,
                availableQuantity: recQty,
                unitCost: newCost
              },
              transaction: t
            });
            if (!created) {
              await lot.update({
                receivedQuantity: Number(lot.receivedQuantity) + recQty,
                availableQuantity: Number(lot.availableQuantity) + recQty,
                expiryDate: line.expiryDate || lot.expiryDate,
                unitCost: newCost
              }, { transaction: t });
            }
            inventoryLotId = lot.id;
          }

          // Create audit transaction
          await InventoryTransaction.create({
            productId: product.id,
            type: 'purchase',
            quantity: recQty,
            balanceAfter: newStock,
            referenceType: 'purchase_order',
            referenceId: po.id,
            userId: req.user?.id || null,
            note: `Received PO ${po.poNumber}`,
            branchId,
            inventoryLotId
          }, { transaction: t });
        }
      }
    }

    await po.update({
      status: 'received',
      receivedAt: new Date(),
      receivedBranchId: branchId
    }, { transaction: t });

    await logAudit({
      req,
      action: 'purchase_order.receive',
      entityType: 'purchase_order',
      entityId: po.id,
      metadata: { poNumber: po.poNumber },
      transaction: t
    });

    await t.commit();
    return res.json({ message: 'Purchase Order received into stock', poId: po.id });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ error: err.message });
  }
}

async function listReturns(req, res) {
  return res.json(await PurchaseReturn.findAll({
    where: tenantWhere(req),
    include: [
      { model: Supplier, attributes: ['id', 'name'] },
      { model: PurchaseReturnItem, include: [{ model: Product, attributes: ['id', 'sku', 'name'] }] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50
  }));
}

async function createReturn(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const po = await PurchaseOrder.findOne({
      where: tenantWhere(req, { id: req.params.id, status: 'received' }),
      include: [{ model: PurchaseOrderItem, as: 'items', include: [{ model: Product }] }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!po) throw Object.assign(new Error('Received purchase order not found'), { status: 404 });
    const itemMap = new Map(po.items.map((item) => [item.id, item]));
    const returned = await PurchaseReturn.create({
      tenantId: req.tenantId || null,
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
      branchId: po.receivedBranchId,
      reason: req.body.reason,
      createdByUserId: req.user.id
    }, { transaction });
    let totalCost = 0;
    for (const line of req.body.items) {
      const poItem = itemMap.get(line.itemId);
      if (!poItem) throw Object.assign(new Error(`Purchase-order item ${line.itemId} not found`), { status: 400 });
      const quantity = Math.round(Number(line.quantity) * 1000) / 1000;
      const remaining = Number(poItem.receivedQuantity) - Number(poItem.returnedQuantity || 0);
      if (quantity > remaining) throw Object.assign(new Error(`Return exceeds remaining received quantity for ${poItem.Product.name}`), { status: 409 });
      const product = await Product.findByPk(poItem.productId, { transaction, lock: transaction.LOCK.UPDATE });
      const branch = await BranchInventory.findOne({
        where: { branchId: po.receivedBranchId, productId: product.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!branch || Number(branch.quantity) < quantity || Number(product.stockQuantity) < quantity) {
        throw Object.assign(new Error(`Insufficient unsold stock to return ${product.name}`), { status: 409 });
      }
      let lot = null;
      if (product.tracksLots) {
        if (!line.inventoryLotId) throw Object.assign(new Error(`Select the supplier lot being returned for ${product.name}`), { status: 400 });
        lot = await InventoryLot.findOne({
          where: {
            id: line.inventoryLotId,
            purchaseOrderId: po.id,
            branchId: po.receivedBranchId,
            productId: product.id
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (!lot || Number(lot.availableQuantity) < quantity) {
          throw Object.assign(new Error(`Insufficient available quantity in the selected lot for ${product.name}`), { status: 409 });
        }
        await lot.update({ availableQuantity: Number(lot.availableQuantity) - quantity }, { transaction });
      }
      const branchBalance = Number(branch.quantity) - quantity;
      await branch.update({ quantity: branchBalance }, { transaction });
      await product.update({ stockQuantity: Number(product.stockQuantity) - quantity }, { transaction });
      await poItem.update({ returnedQuantity: Number(poItem.returnedQuantity || 0) + quantity }, { transaction });
      const lineTotal = Math.round(quantity * Number(poItem.unitCostPrice) * 100) / 100;
      totalCost += lineTotal;
      await PurchaseReturnItem.create({
        purchaseReturnId: returned.id,
        purchaseOrderItemId: poItem.id,
        productId: product.id,
        inventoryLotId: lot?.id || null,
        quantity,
        unitCost: poItem.unitCostPrice,
        lineTotal
      }, { transaction });
      await InventoryTransaction.create({
        productId: product.id,
        branchId: po.receivedBranchId,
        inventoryLotId: lot?.id || null,
        type: 'purchase_return',
        quantity: -quantity,
        balanceAfter: branchBalance,
        referenceType: 'purchase_return',
        referenceId: returned.id,
        userId: req.user.id,
        note: req.body.reason
      }, { transaction });
    }
    await returned.update({ totalCost: Math.round(totalCost * 100) / 100 }, { transaction });
    await logAudit({
      req,
      action: 'purchase.return_created',
      entityType: 'purchase_return',
      entityId: returned.id,
      metadata: { purchaseOrderId: po.id, totalCost, awaitingSupplierCredit: true },
      transaction
    });
    await transaction.commit();
    return res.status(201).json({ id: returned.id, status: returned.status, totalCost: returned.totalCost });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function confirmSupplierCredit(req, res) {
  const returned = await PurchaseReturn.findOne({ where: tenantWhere(req, { id: req.params.id, status: 'awaiting_supplier_credit' }) });
  if (!returned) return res.status(404).json({ error: 'Open supplier return not found' });
  await returned.update({ status: 'credited' });
  await logAudit({ req, action: 'purchase.return_credited', entityType: 'purchase_return', entityId: returned.id, metadata: { reference: req.body.reference, note: req.body.note } });
  return res.json({ id: returned.id, status: 'credited' });
}

module.exports = { create, list, receive, listReturns, createReturn, confirmSupplierCredit };
