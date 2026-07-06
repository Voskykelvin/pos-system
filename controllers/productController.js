const { Op } = require('sequelize');
const { Product, Category } = require('../models');
const { tenantWhere } = require('../utils/tenantScope');

// GET /api/products/search?q=milk  or  ?barcode=5901234123457
async function search(req, res) {
  const { q, barcode } = req.query;

  try {
    if (barcode) {
      const product = await Product.findOne({
        where: tenantWhere(req, { barcode, isActive: true }),
        include: [{ model: Category }]
      });
      return res.json(product ? [product] : []);
    }

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const products = await Product.findAll({
      where: tenantWhere(req, {
        isActive: true,
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { sku: { [Op.iLike]: `%${q}%` } },
          { barcode: { [Op.iLike]: `%${q}%` } }
        ]
      }),
      include: [{ model: Category }],
      limit: 20
    });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/products
async function list(req, res) {
  try {
    const products = await Product.findAll({
      where: tenantWhere(req, { isActive: true }),
      include: [{ model: Category, attributes: ['id', 'name', 'taxCategory'] }],
      order: [['name', 'ASC']]
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, search };
