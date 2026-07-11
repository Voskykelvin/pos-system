import { describe, expect, it } from 'vitest';
import {
  normalizeTaxCategory,
  productTaxCategory,
  taxLabel,
  taxRateForCategory
} from './taxCategories';

describe('tax category helpers', () => {
  it('uses the standard category as the safe fallback', () => {
    expect(normalizeTaxCategory('unknown')).toBe('standard');
    expect(taxRateForCategory(undefined)).toBe(0.16);
    expect(taxLabel('standard')).toBe('VAT 16%');
  });

  it('preserves zero-rated and exempt treatment', () => {
    expect(taxRateForCategory('zero_rated')).toBe(0);
    expect(taxRateForCategory('exempt')).toBe(0);
    expect(productTaxCategory({ Category: { taxCategory: 'exempt' } })).toBe('exempt');
  });

  it('prefers a product override over its category default', () => {
    expect(productTaxCategory({
      taxCategory: 'zero_rated',
      Category: { taxCategory: 'standard' }
    })).toBe('zero_rated');
  });
});
