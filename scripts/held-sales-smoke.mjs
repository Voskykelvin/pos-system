import assert from 'node:assert/strict';
import {
  createHeldSaleSnapshot,
  formatHeldSaleAge,
  insertHeldSale,
  isHeldSaleStale,
  MAX_HELD_SALES
} from '../src/utils/heldSaleState.mjs';

const baseCart = [{ productId: 'milk', name: 'Fresh Milk 500ml', quantity: 2, unitPrice: 65 }];
const snapshot = createHeldSaleSnapshot({
  cashierId: 'cashier-1',
  cashierName: 'Cashier One',
  cart: baseCart,
  payments: [{ method: 'cash', amount: '150.80', mpesaPhone: '' }],
  customer: { name: 'Jane Buyer', phone: '0712345678' },
  note: 'Customer waiting for M-Pesa',
  total: 150.8,
  createdAt: '2026-07-05T10:00:00.000Z',
  id: 'held-1'
});

assert.equal(snapshot.label, 'Jane Buyer');
assert.equal(snapshot.cashierName, 'Cashier One');
assert.equal(snapshot.note, 'Customer waiting for M-Pesa');
assert.equal(snapshot.itemCount, 2);
assert.equal(snapshot.total, 150.8);

const held = insertHeldSale(
  Array.from({ length: MAX_HELD_SALES }, (_, index) => createHeldSaleSnapshot({
    cashierId: 'cashier-1',
    cart: baseCart,
    payments: [],
    total: index + 1,
    id: `existing-${index}`
  })),
  snapshot
);

assert.equal(held.length, MAX_HELD_SALES);
assert.equal(held[0].id, 'held-1');
assert.ok(isHeldSaleStale(snapshot, '2026-07-05T10:31:00.000Z'));
assert.equal(isHeldSaleStale(snapshot, '2026-07-05T10:10:00.000Z'), false);
assert.equal(formatHeldSaleAge(snapshot, '2026-07-05T11:05:00.000Z'), '1h 5m ago');

console.log('Held sales smoke passed');
