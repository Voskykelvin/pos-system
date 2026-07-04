'use strict';

const {
  sequelize,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Product,
  InventoryTransaction,
  User
} = require('../models');
const { logAudit } = require('../services/auditLogger');
const { tenantWhere, withTenant } = require('../utils/tenantScope');

async function list(req, res) {
  try {
    const pos = await PurchaseOrder.findAll({
      where: tenantWhere(req),
      include: [
        { model: Supplier, attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: PurchaseOrderItem, as: 'items', include: [{ model: Product, attributes: ['id', 'name', 'sku'] }] }
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
          const newStock = Number(product.stockQuantity) + recQty;
          await product.update({
            stockQuantity: newStock,
            costPrice: newCost // Update running cost price
          }, { transaction: t });

          // Create audit transaction
          await InventoryTransaction.create({
            productId: product.id,
            type: 'purchase',
            quantity: recQty,
            balanceAfter: newStock,
            referenceType: 'purchase_order',
            referenceId: po.id,
            userId: req.user?.id || null,
            note: `Received PO ${po.poNumber}`
          }, { transaction: t });
        }
      }
    }

    await po.update({
      status: 'received',
      receivedAt: new Date()
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

module.exports = { create, list, receive };
