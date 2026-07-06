const { Op } = require('sequelize');
const { sequelize, Product, Category, InventoryTransaction } = require('../models');
const { logAudit } = require('../services/auditLogger');
const { resolveManagerApproval } = require('../services/managerApproval');
const { tenantWhere, withTenant } = require('../utils/tenantScope');
const { normalizeTaxCategory } = require('../utils/taxCategories');

async function assertUniqueProductIdentity(req, { sku, barcode, excludeId = null }) {
  const identityChecks = [];
  const normalizedSku = sku ? String(sku).trim() : '';
  const normalizedBarcode = barcode ? String(barcode).trim() : '';

  if (normalizedSku) identityChecks.push({ sku: { [Op.iLike]: normalizedSku } });
  if (normalizedBarcode) identityChecks.push({ barcode: { [Op.iLike]: normalizedBarcode } });
  if (identityChecks.length === 0) return;

  const where = tenantWhere(req, {
    [Op.or]: identityChecks,
    ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
  });

  const existing = await Product.findOne({ where });
  if (!existing) return;

  if (normalizedSku && String(existing.sku).toLowerCase() === normalizedSku.toLowerCase()) {
    throw Object.assign(new Error('A product with that SKU already exists in this store'), { status: 409 });
  }
  throw Object.assign(new Error('A product with that barcode already exists in this store'), { status: 409 });
}

// GET /api/admin/products?includeInactive=true
async function list(req, res) {
  try {
    const where = tenantWhere(req, req.query.includeInactive === 'true' ? {} : { isActive: true });
    const products = await Product.findAll({
      where,
      include: [{ model: Category }],
      order: [['name', 'ASC']]
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/products
async function create(req, res) {
  const {
    sku, barcode, name, unit, isWeighted,
    costPrice, sellingPrice, taxCategory, reorderLevel,
    stockQuantity, categoryId, imageUrl
  } = req.body;

  if (!sku || !name || !sellingPrice || !categoryId) {
    return res.status(400).json({
      error: 'sku, name, sellingPrice, and categoryId are required'
    });
  }

  const t = await sequelize.transaction();
  try {
    await assertUniqueProductIdentity(req, { sku, barcode });
    const category = await Category.findOne({
      where: tenantWhere(req, { id: categoryId }),
      transaction: t
    });
    if (!category) {
      throw Object.assign(new Error('Category not found'), { status: 404 });
    }

    const product = await Product.create({
      sku,
      barcode: barcode || null,
      name,
      unit: unit || 'each',
      isWeighted: !!isWeighted,
      costPrice: costPrice || 0,
      sellingPrice,
      taxCategory: normalizeTaxCategory(taxCategory, category.taxCategory),
      reorderLevel: reorderLevel ?? 5,
      stockQuantity: stockQuantity || 0,
      categoryId,
      imageUrl: imageUrl || null,
      ...withTenant(req)
    }, { transaction: t });

    // Log the opening stock as a purchase transaction so the ledger is complete
    if (Number(stockQuantity) > 0) {
      await InventoryTransaction.create({
        productId: product.id,
        type: 'purchase',
        quantity: stockQuantity,
        balanceAfter: stockQuantity,
        referenceType: 'opening_stock',
        note: 'Initial stock on product creation'
      }, { transaction: t });
    }

    await logAudit({
      req,
      action: 'product.create',
      entityType: 'product',
      entityId: product.id,
      metadata: { sku, name, openingStock: Number(stockQuantity || 0) },
      transaction: t
    });

    await t.commit();
    res.status(201).json(product);
  } catch (err) {
    await t.rollback();
    res.status(err.status || 400).json({ error: err.message });
  }
}

// PUT /api/admin/products/:id
async function update(req, res) {
  const { id } = req.params;
  const {
    sku, barcode, name, unit, isWeighted,
    costPrice, sellingPrice, taxCategory, reorderLevel, categoryId, imageUrl, isActive
  } = req.body;

  try {
    const product = await Product.findOne({ where: tenantWhere(req, { id }) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await assertUniqueProductIdentity(req, {
      sku: sku || product.sku,
      barcode: barcode === undefined ? product.barcode : barcode,
      excludeId: product.id
    });
    let category = null;
    if (categoryId || taxCategory) {
      category = await Category.findOne({
        where: tenantWhere(req, { id: categoryId || product.categoryId })
      });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
    }

    // Note: stockQuantity is deliberately NOT editable here. Stock changes
    // must go through /adjust-stock so every change leaves an audit trail.
    await product.update({
      sku,
      barcode: barcode || null,
      name,
      unit,
      isWeighted,
      costPrice,
      sellingPrice,
      taxCategory: taxCategory === undefined
        ? product.taxCategory
        : normalizeTaxCategory(taxCategory, category?.taxCategory || product.taxCategory),
      reorderLevel,
      categoryId,
      imageUrl: imageUrl || null,
      isActive
    });

    await logAudit({
      req,
      action: 'product.update',
      entityType: 'product',
      entityId: product.id,
      metadata: { sku, name }
    });

    res.json(product);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}

// DELETE /api/admin/products/:id  (soft delete, keeps sales history intact)
async function deactivate(req, res) {
  try {
    const product = await Product.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await product.update({ isActive: false });
    await logAudit({
      req,
      action: 'product.deactivate',
      entityType: 'product',
      entityId: product.id,
      metadata: { sku: product.sku, name: product.name }
    });
    res.json({ id: product.id, isActive: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/products/:id/adjust-stock
// Body: { type: 'purchase' | 'adjustment' | 'wastage' | 'return', quantity, note }
// Quantity should be positive for stock in and negative for stock out.
async function adjustStock(req, res) {
  const { id } = req.params;
  const { type, quantity, note } = req.body;

  if (!type || quantity === undefined) {
    return res.status(400).json({ error: 'type and quantity are required' });
  }
  if (!['purchase', 'adjustment', 'wastage', 'return'].includes(type)) {
    return res.status(400).json({ error: 'Invalid adjustment type' });
  }

  const t = await sequelize.transaction();
  try {
    const approval = await resolveManagerApproval(req, { reason: 'stock adjustment' });
    const product = await Product.findOne({
      where: tenantWhere(req, { id }),
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }

    const balanceBefore = Number(product.stockQuantity);
    const newBalance = balanceBefore + Number(quantity);
    if (newBalance < 0) {
      await t.rollback();
      return res.status(400).json({
        error: `Adjustment would result in negative stock (current: ${product.stockQuantity})`
      });
    }

    await product.update({ stockQuantity: newBalance }, { transaction: t });

    await InventoryTransaction.create({
      productId: product.id,
      type,
      quantity,
      balanceAfter: newBalance,
      referenceType: 'manual',
      note,
      userId: req.user?.id || null
    }, { transaction: t });

    await logAudit({
      req,
      action: 'inventory.adjust',
      entityType: 'product',
      entityId: product.id,
      approvedByUserId: approval.approvedByUserId,
      metadata: {
        type,
        quantity: Number(quantity),
        balanceBefore,
        balanceAfter: newBalance,
        note
      },
      transaction: t
    });

    await t.commit();
    res.json({ productId: product.id, stockQuantity: newBalance });
  } catch (err) {
    await t.rollback();
    res.status(err.status || 500).json({ error: err.message });
  }
}

// GET /api/admin/products/low-stock
async function lowStock(req, res) {
  try {
    const products = await Product.findAll({
      where: tenantWhere(req, { isActive: true }),
      include: [{ model: Category }]
    });
    const low = products.filter(
      (p) => Number(p.stockQuantity) <= Number(p.reorderLevel)
    );
    res.json(low);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, create, update, deactivate, adjustStock, lowStock };
