const { Category } = require('../models');
const { tenantWhere, withTenant } = require('../utils/tenantScope');
const { normalizeTaxCategory } = require('../utils/taxCategories');

// GET /api/admin/categories
async function list(req, res) {
  try {
    const categories = await Category.findAll({
      where: tenantWhere(req),
      order: [['name', 'ASC']]
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/categories
// Body: { name, taxCategory: 'standard' | 'zero_rated' | 'exempt' }
async function create(req, res) {
  const { name, taxCategory } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const category = await Category.create({
      name,
      taxCategory: normalizeTaxCategory(taxCategory),
      ...withTenant(req)
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, create };
