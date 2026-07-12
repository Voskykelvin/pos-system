'use strict';

const { Op } = require('sequelize');
const { sequelize, Product, Category } = require('../models');
const { tenantWhere, withTenant } = require('../utils/tenantScope');
const { normalizeTaxCategory } = require('../utils/taxCategories');
const { addBranchStock, resolveOperationalBranch } = require('../services/branchInventory');

function normalizeCsvTaxCategory(value, fallback) {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    vat: 'standard',
    vatable: 'standard',
    standard_rated: 'standard',
    '16': 'standard',
    '16%': 'standard',
    zero: 'zero_rated',
    zero_rate: 'zero_rated',
    zero_rated: 'zero_rated',
    '0': 'zero_rated',
    '0%': 'zero_rated',
    exempted: 'exempt',
    exempt: 'exempt',
    non_vat: 'exempt',
    non_vatable: 'exempt'
  };
  return normalizeTaxCategory(aliases[raw] || raw, fallback);
}

function csvEscape(val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCatalogCsv(req, res) {
  try {
    const products = await Product.findAll({
      where: tenantWhere(req),
      include: [{ model: Category, attributes: ['name'] }],
      order: [['name', 'ASC']]
    });

    const rows = [
      ['sku', 'barcode', 'name', 'category', 'taxCategory', 'unit', 'isWeighted', 'costPrice', 'sellingPrice', 'reorderLevel', 'stockQuantity'].join(',')
    ];

    for (const p of products) {
      rows.push([
        csvEscape(p.sku),
        csvEscape(p.barcode),
        csvEscape(p.name),
        csvEscape(p.Category?.name || ''),
        csvEscape(p.taxCategory),
        csvEscape(p.unit),
        csvEscape(p.isWeighted),
        csvEscape(Number(p.costPrice).toFixed(2)),
        csvEscape(Number(p.sellingPrice).toFixed(2)),
        csvEscape(p.reorderLevel),
        csvEscape(Number(p.stockQuantity))
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

  const transaction = await sequelize.transaction();
  try {
    const lines = csvData.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV file contains no data rows');

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
      let category = null;
      if (!categoryId && row.category) {
        category = await Category.findOne({ where: tenantWhere(req, { name: row.category }), transaction });
        if (category) categoryId = category.id;
      }
      if (!categoryId) {
        category = await Category.findOne({ where: tenantWhere(req), transaction });
        categoryId = category?.id;
      } else if (!category) {
        category = await Category.findOne({ where: tenantWhere(req, { id: categoryId }), transaction });
      }

      const existing = await Product.findOne({ where: tenantWhere(req, { sku: row.sku }), transaction, lock: transaction.LOCK.UPDATE });
      if (row.barcode) {
        const barcodeOwner = await Product.findOne({
          where: tenantWhere(req, {
            barcode: row.barcode,
            ...(existing ? { id: { [Op.ne]: existing.id } } : {})
          }),
          transaction
        });
        if (barcodeOwner) {
          throw Object.assign(new Error(`CSV row ${i + 1}: barcode ${row.barcode} already belongs to SKU ${barcodeOwner.sku}`), { status: 409 });
        }
      }

      const payload = {
        sku: row.sku,
        barcode: row.barcode || null,
        name: row.name,
        unit: row.unit || 'each',
        isWeighted: row.isweighted === 'true',
        costPrice: Number(row.costprice || 0),
        sellingPrice: Number(row.sellingprice || 0),
        taxCategory: normalizeCsvTaxCategory(
          row.taxcategory || row.tax_category || row.vatcategory || row.vat || row.tax,
          category?.taxCategory
        ),
        reorderLevel: Number(row.reorderlevel || 5),
        stockQuantity: Number(row.stockquantity || 0),
        categoryId,
        ...withTenant(req)
      };

      if (existing) {
        const stockDelta = payload.stockQuantity - Number(existing.stockQuantity);
        await existing.update(payload, { transaction });
        if (stockDelta) {
          const branchId = await resolveOperationalBranch(req, transaction);
          await addBranchStock({ branchId, productId: existing.id, quantity: stockDelta, transaction });
        }
        updated++;
      } else {
        const product = await Product.create(payload, { transaction });
        if (payload.stockQuantity > 0) {
          const branchId = await resolveOperationalBranch(req, transaction);
          await addBranchStock({ branchId, productId: product.id, quantity: payload.stockQuantity, transaction });
        }
        imported++;
      }
    }

    await transaction.commit();
    return res.json({ message: `CSV Import Complete. Added ${imported} new products, updated ${updated} existing products.` });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 400).json({ error: err.message });
  }
}

module.exports = { exportCatalogCsv, importCatalogCsv };
