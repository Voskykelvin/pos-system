const { Op } = require('sequelize');
const { Product, Category } = require('../models');

// GET /api/products/search?q=milk  or  ?barcode=5901234123457
async function search(req, res) {
  const { q, barcode } = req.query;

  try {
    if (barcode) {
      const product = await Product.findOne({
        where: { barcode, isActive: true },
        include: [{ model: Category }]
      });
      return res.json(product ? [product] : []);
    }

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const products = await Product.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { sku: { [Op.iLike]: `%${q}%` } }
        ]
      },
      include: [{ model: Category }],
      limit: 20
    });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { search };
