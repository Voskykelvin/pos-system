import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { chooseCategory, skuStem } = require('./productCatalogLookup');

describe('scan-first product drafts', () => {
  it('matches catalogue taxonomy to the closest store category', () => {
    const categories = [
      { id: 'general', name: 'General' },
      { id: 'dairy', name: 'Dairy' },
      { id: 'drinks', name: 'Beverages' }
    ];
    expect(chooseCategory(categories, 'Fermented dairy products, Yogurts').id).toBe('dairy');
    expect(chooseCategory(categories, 'Fruit juices and drinks').id).toBe('drinks');
  });

  it('creates a readable bounded SKU stem', () => {
    expect(skuStem('  Kenyan Whole Milk 500ml ')).toBe('KENYAN-WHOLE');
    expect(skuStem('***')).toBe('ITEM');
  });
});
