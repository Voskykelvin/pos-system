'use strict';

const { Op } = require('sequelize');
const { Product, Category } = require('../models');
const { tenantWhere } = require('../utils/tenantScope');

const CATEGORY_GROUPS = [
  ['beverages', ['beverage', 'drink', 'water', 'juice', 'soda', 'coffee', 'tea']],
  ['dairy', ['dairy', 'milk', 'cheese', 'yogurt', 'butter']],
  ['bakery', ['bread', 'bakery', 'cake', 'biscuit', 'cookie']],
  ['snacks', ['snack', 'crisps', 'chips', 'chocolate', 'candy', 'sweet']],
  ['groceries', ['grocery', 'cereal', 'grain', 'rice', 'pasta', 'flour', 'oil', 'sauce']],
  ['household', ['household', 'cleaner', 'detergent', 'soap', 'tissue']],
  ['personal care', ['beauty', 'personal care', 'shampoo', 'toothpaste', 'cosmetic']]
];

function words(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function hasWord(tokens, candidate) {
  return tokens.some((token) => token === candidate || token === `${candidate}s` || token === `${candidate}es`);
}

function chooseCategory(categories, externalCategories) {
  if (!categories.length) return null;
  const source = words(externalCategories);
  let best = null;
  let bestScore = 0;
  for (const category of categories) {
    const categoryWords = words(category.name);
    let score = categoryWords.reduce((sum, word) => sum + (hasWord(source, word) ? 4 : 0), 0);
    for (const [group, aliases] of CATEGORY_GROUPS) {
      const categoryInGroup = words(group).some((word) => categoryWords.includes(word));
      if (categoryInGroup && aliases.some((alias) => hasWord(source, alias))) score += 3;
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best || categories.find((category) => /uncategorized|general|other/i.test(category.name)) || categories[0];
}

function skuStem(name) {
  return String(name || 'ITEM').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'ITEM';
}

async function uniqueSku(req, name, barcode) {
  const suffix = String(barcode).replace(/\D/g, '').slice(-5) || String(barcode).slice(-5).toUpperCase();
  const base = `${skuStem(name)}-${suffix}`.slice(0, 24);
  for (let counter = 0; counter < 100; counter += 1) {
    const candidate = counter ? `${base}-${counter}` : base;
    const exists = await Product.findOne({ where: tenantWhere(req, { sku: { [Op.iLike]: candidate } }), attributes: ['id'] });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

async function fetchOpenFoodFacts(barcode) {
  if (String(process.env.PRODUCT_CATALOG_LOOKUP_ENABLED || 'true').toLowerCase() === 'false') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const fields = 'code,product_name,brands,categories,categories_tags,image_front_url,quantity';
    const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=${fields}`, {
      headers: { 'User-Agent': process.env.PRODUCT_CATALOG_USER_AGENT || 'JijengePOS/1.0 (catalog lookup)' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.status === 'success' || data.product ? data.product : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildScannedProductDraft(req, rawBarcode) {
  const barcode = String(rawBarcode || '').trim();
  if (!/^[A-Za-z0-9-]{6,64}$/.test(barcode)) {
    throw Object.assign(new Error('Scan a valid barcode containing 6 to 64 letters or digits'), { status: 400 });
  }
  const existing = await Product.findOne({
    where: tenantWhere(req, { barcode: { [Op.iLike]: barcode } }),
    include: [{ model: Category, attributes: ['id', 'name', 'taxCategory'] }]
  });
  if (existing) return { existing: true, product: existing };

  const [catalogProduct, categories] = await Promise.all([
    fetchOpenFoodFacts(barcode),
    Category.findAll({ where: tenantWhere(req), order: [['name', 'ASC']] })
  ]);
  const name = String(catalogProduct?.product_name || catalogProduct?.brands || '').trim();
  const externalCategories = catalogProduct?.categories || (catalogProduct?.categories_tags || []).join(' ');
  const category = chooseCategory(categories, externalCategories);

  return {
    existing: false,
    catalogMatch: Boolean(catalogProduct),
    source: catalogProduct ? 'Open Food Facts' : 'manual',
    draft: {
      barcode,
      sku: await uniqueSku(req, name, barcode),
      name,
      imageUrl: catalogProduct?.image_front_url || '',
      categoryId: category?.id || '',
      categoryName: category?.name || '',
      taxCategory: category?.taxCategory || 'standard',
      unit: 'each',
      quantityLabel: catalogProduct?.quantity || ''
    }
  };
}

module.exports = { buildScannedProductDraft, chooseCategory, skuStem };
