'use strict';

const STANDARD_VAT_RATE = 0.16;
const TAX_CATEGORIES = ['standard', 'zero_rated', 'exempt'];
const TAX_RATES = {
  standard: STANDARD_VAT_RATE,
  zero_rated: 0,
  exempt: 0
};

function normalizeTaxCategory(value, fallback = 'standard') {
  const normalized = String(value || '').trim();
  if (TAX_CATEGORIES.includes(normalized)) return normalized;
  return TAX_CATEGORIES.includes(fallback) ? fallback : 'standard';
}

function resolveProductTaxCategory(product) {
  return normalizeTaxCategory(
    product?.taxCategory || product?.Category?.taxCategory,
    'standard'
  );
}

function taxRateForCategory(category) {
  return TAX_RATES[normalizeTaxCategory(category)] ?? STANDARD_VAT_RATE;
}

function taxRateForProduct(product) {
  return taxRateForCategory(resolveProductTaxCategory(product));
}

module.exports = {
  STANDARD_VAT_RATE,
  TAX_CATEGORIES,
  TAX_RATES,
  normalizeTaxCategory,
  resolveProductTaxCategory,
  taxRateForCategory,
  taxRateForProduct
};
