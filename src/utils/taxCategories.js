export const STANDARD_VAT_RATE = 0.16;

export const TAX_CATEGORY_OPTIONS = [
  {
    value: 'standard',
    label: 'Standard VAT (16%)',
    shortLabel: 'VAT 16%'
  },
  {
    value: 'zero_rated',
    label: 'Zero-rated (0%)',
    shortLabel: 'Zero-rated'
  },
  {
    value: 'exempt',
    label: 'Exempt (0%)',
    shortLabel: 'Exempt'
  }
];

export const VAT_RATES = {
  standard: STANDARD_VAT_RATE,
  zero_rated: 0,
  exempt: 0
};

const TAX_CATEGORY_VALUES = TAX_CATEGORY_OPTIONS.map((option) => option.value);

export function normalizeTaxCategory(value, fallback = 'standard') {
  const normalized = String(value || '').trim();
  if (TAX_CATEGORY_VALUES.includes(normalized)) return normalized;
  return TAX_CATEGORY_VALUES.includes(fallback) ? fallback : 'standard';
}

export function taxRateForCategory(category) {
  return VAT_RATES[normalizeTaxCategory(category)] ?? STANDARD_VAT_RATE;
}

export function taxLabel(category) {
  const normalized = normalizeTaxCategory(category);
  return TAX_CATEGORY_OPTIONS.find((option) => option.value === normalized)?.shortLabel || normalized;
}

export function productTaxCategory(product) {
  return normalizeTaxCategory(product?.taxCategory || product?.Category?.taxCategory);
}
