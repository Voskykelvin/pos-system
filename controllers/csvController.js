'use strict';

const { Product, Category } = require('../models');
const { tenantWhere, withTenant } = require('../utils/tenantScope');

async function exportCatalogCsv(req, res) {
  try {
    const products = await Product.findAll({
      where: tenantWhere(req),
      include: [{ model: Category, attributes: ['name'] }],
      order: [['name', 'ASC']]
    });

    const rows = [
      ['sku', 'barcode', 'name', 'category', 'unit', 'isWeighted', 'costPrice', 'sellingPrice', 'reorderLevel', 'stockQuantity'].join(',')
    ];

    function esc(val) {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }

    for (const p of products) {
      rows.push([
        esc(p.sku),
        esc(p.barcode),
        esc(p.name),
        esc(p.Category?.name || ''),
        esc(p.unit),
        esc(p.isWeighted),
        esc(Number(p.costPrice).toFixed(2)),
        esc(Number(p.sellingPrice).toFixed(2)),
        esc(p.reorderLevel),
        esc(Number(p.stockQuantity))
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="product_catalog.csv"');
    return res.send('\uFEFF' + rows.join('\r\n'));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function importCatalogCsv(req, res) {
  const { csvData } = req.body; // text payload
  if (!csvData || typeof csvData !== 'string') {
    return res.status(400).json({ error: 'csvData is required as a plain string' });
  }

  try {
    const lines = csvData.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV file contains no data rows' });

    const header = lines[0].toLowerCase().split(',').map((h) => h.replace(/"/g, '').trim());
    let imported = 0;
    let updated = 0;

    for (let i = 1; i < lines.length; i++) {
      // Basic CSV splitter
      const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
      if (cols.length < 3) continue;

      const row = {};
      header.forEach((h, idx) => { row[h] = cols[idx]; });

      if (!row.sku || !row.name || !row.sellingprice) continue;

      // Find category or default
      let categoryId = row.categoryid;
      if (!categoryId && row.category) {
        const cat = await Category.findOne({ where: tenantWhere(req, { name: row.category }) });
        if (cat) categoryId = cat.id;
      }
      if (!categoryId) {
        const defaultCat = await Category.findOne({ where: tenantWhere(req) });
        categoryId = defaultCat?.id;
      }

      const existing = await Product.findOne({ where: tenantWhere(req, { sku: row.sku }) });

      const payload = {
        sku: row.sku,
        barcode: row.barcode || null,
        name: row.name,
        unit: row.unit || 'each',
        isWeighted: row.isweighted === 'true',
        costPrice: Number(row.costprice || 0),
        sellingPrice: Number(row.sellingprice || 0),
        reorderLevel: Number(row.reorderlevel || 5),
        stockQuantity: Number(row.stockquantity || 0),
        categoryId,
        ...withTenant(req)
      };

      if (existing) {
        await existing.update(payload);
        updated++;
      } else {
        await Product.create(payload);
        imported++;
      }
    }

    return res.json({ message: `CSV Import Complete. Added ${imported} new products, updated ${updated} existing products.` });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { exportCatalogCsv, importCatalogCsv };
