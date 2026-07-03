const { sequelize, Product, Category, InventoryTransaction } = require('../models');

// GET /api/admin/products?includeInactive=true
async function list(req, res) {
  try {
    const where = req.query.includeInactive === 'true' ? {} : { isActive: true };
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
    costPrice, sellingPrice, reorderLevel,
    stockQuantity, categoryId
  } = req.body;

  if (!sku || !name || !sellingPrice || !categoryId) {
    return res.status(400).json({
      error: 'sku, name, sellingPrice, and categoryId are required'
    });
  }

  const t = await sequelize.transaction();
  try {
    const product = await Product.create({
      sku,
      barcode: barcode || null,
      name,
      unit: unit || 'each',
      isWeighted: !!isWeighted,
      costPrice: costPrice || 0,
      sellingPrice,
      reorderLevel: reorderLevel ?? 5,
      stockQuantity: stockQuantity || 0,
      categoryId
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

    await t.commit();
    res.status(201).json(product);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
}

// PUT /api/admin/products/:id
async function update(req, res) {
  const { id } = req.params;
  const {
    sku, barcode, name, unit, isWeighted,
    costPrice, sellingPrice, reorderLevel, categoryId, isActive
  } = req.body;

  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Note: stockQuantity is deliberately NOT editable here. Stock changes
    // must go through /adjust-stock so every change leaves an audit trail.
    await product.update({
      sku, barcode, name, unit, isWeighted,
      costPrice, sellingPrice, reorderLevel, categoryId, isActive
    });

    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// DELETE /api/admin/products/:id  (soft delete, keeps sales history intact)
async function deactivate(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await product.update({ isActive: false });
    res.json({ id: product.id, isActive: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/products/:id/adjust-stock
// Body: { type: 'purchase' | 'adjustment' | 'wastage', quantity, note, userId }
// quantity should be positive for purchase/adjustment-in, negative for wastage/adjustment-out
async function adjustStock(req, res) {
  const { id } = req.params;
  const { type, quantity, note, userId } = req.body;

  if (!type || quantity === undefined) {
    return res.status(400).json({ error: 'type and quantity are required' });
  }
  if (!['purchase', 'adjustment', 'wastage'].includes(type)) {
    return res.status(400).json({ error: 'Invalid adjustment type' });
  }

  const t = await sequelize.transaction();
  try {
    const product = await Product.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }

    const newBalance = Number(product.stockQuantity) + Number(quantity);
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
      userId: userId || null
    }, { transaction: t });

    await t.commit();
    res.json({ productId: product.id, stockQuantity: newBalance });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/products/low-stock
async function lowStock(req, res) {
  try {
    const products = await Product.findAll({
      where: { isActive: true },
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
