import { describe, expect, it } from 'vitest';
import invariantModule from './checkoutInvariants.js';

const {
  consolidateCheckoutItems,
  validateOfflineCatalogSnapshot,
  validateOfflineSale,
  validatePromotionForTotal
} = invariantModule;

describe('checkout financial invariants', () => {
  it('consolidates duplicate product lines before checking stock', () => {
    expect(consolidateCheckoutItems([
      { productId: 'milk', quantity: 1 },
      { productId: 'milk', quantity: 1.5 },
      { productId: 'bread', quantity: 2 }
    ])).toEqual([
      { productId: 'milk', quantity: 2.5 },
      { productId: 'bread', quantity: 2 }
    ]);
  });

  it('rejects invalid precision and quantities', () => {
    expect(() => consolidateCheckoutItems([{ productId: 'milk', quantity: 1.0001 }])).toThrow(/3 decimal/);
    expect(() => consolidateCheckoutItems([{ productId: 'milk', quantity: 0 }])).toThrow(/positive quantity/);
  });

  it('enforces promotion minimums, limits, dates, and percentages', () => {
    expect(() => validatePromotionForTotal({ minOrderTotal: 500, value: 10, type: 'percent' }, 100)).toThrow(/minimum order/);
    expect(() => validatePromotionForTotal({ maxUses: 1, usedCount: 1, value: 10, type: 'percent' }, 500)).toThrow(/max uses/);
    expect(() => validatePromotionForTotal({ value: 101, type: 'percent' }, 500)).toThrow(/cannot exceed 100/);
    expect(() => validatePromotionForTotal({ value: 10, type: 'percent', startsAt: '2030-01-01' }, 500, new Date('2026-01-01'))).toThrow(/not started/);
  });

  it('allows only structurally valid cash-only offline sales', () => {
    const offlineContext = {
      schemaVersion: 1,
      deviceId: 'device-1',
      sequence: 1,
      items: []
    };
    expect(() => validateOfflineSale({
      offlineContext,
      payments: [{ method: 'cash', amount: 100 }]
    })).not.toThrow();
    expect(() => validateOfflineSale({
      offlineContext,
      payments: [{ method: 'credit', amount: 100 }]
    })).toThrow(/cash tender only/);
    expect(() => validateOfflineSale({
      offlineContext,
      discountTotal: 1,
      payments: [{ method: 'cash', amount: 99 }]
    })).toThrow(/cannot include/);
  });

  it('detects price and tax changes before synchronizing an offline sale', () => {
    const product = { id: 'milk', name: 'Milk', sellingPrice: 65, taxCategory: 'zero_rated' };
    const context = {
      items: [{ productId: 'milk', quantity: 1, unitPrice: 65, taxCategory: 'zero_rated' }]
    };
    expect(() => validateOfflineCatalogSnapshot(
      context,
      [{ productId: 'milk', quantity: 1 }],
      new Map([['milk', product]]),
      (row) => row.taxCategory
    )).not.toThrow();
    context.items[0].unitPrice = 70;
    expect(() => validateOfflineCatalogSnapshot(
      context,
      [{ productId: 'milk', quantity: 1 }],
      new Map([['milk', product]]),
      (row) => row.taxCategory
    )).toThrow(/Price changed/);
  });
});
