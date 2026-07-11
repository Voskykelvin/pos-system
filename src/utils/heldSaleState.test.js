import { describe, expect, it } from 'vitest';
import {
  buildHeldSaleLabel,
  createHeldSaleSnapshot,
  formatHeldSaleAge,
  insertHeldSale,
  isHeldSaleStale
} from './heldSaleState.mjs';

describe('held sale state', () => {
  it('creates a stable financial snapshot without mutating totals', () => {
    const snapshot = createHeldSaleSnapshot({
      id: 'held-1',
      createdAt: '2026-07-12T08:00:00.000Z',
      cashierId: 'cashier-1',
      cashierName: 'Amina',
      cart: [
        { productId: 'milk', name: 'Fresh Milk', quantity: 2, unitPrice: 65 },
        { productId: 'bread', name: 'Bread', quantity: 1, unitPrice: 70 }
      ],
      payments: [{ method: 'cash', amount: '200.00' }],
      customer: null,
      discountTotal: '',
      total: 200.005,
      note: ' customer returning '
    });

    expect(snapshot).toMatchObject({
      id: 'held-1',
      label: 'Fresh Milk',
      itemCount: 3,
      total: 200.01,
      note: 'customer returning'
    });
  });

  it('prefers a customer label and caps the queue', () => {
    expect(buildHeldSaleLabel({ customer: { phone: '0700000000' }, cart: [] })).toBe('0700000000');
    expect(insertHeldSale([{ id: 'old' }], { id: 'new' }, 1)).toEqual([{ id: 'new' }]);
  });

  it('reports stale and human-readable ages at the boundary', () => {
    const sale = { createdAt: '2026-07-12T08:00:00.000Z' };
    const now = new Date('2026-07-12T08:30:00.000Z');

    expect(isHeldSaleStale(sale, now, 30)).toBe(true);
    expect(formatHeldSaleAge(sale, new Date('2026-07-12T09:05:00.000Z'))).toBe('1h 5m ago');
  });
});
