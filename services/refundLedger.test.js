import { describe, expect, it } from 'vitest';
import refundLedger from './refundLedger';

const { allocateTender, calculatePartialRefund } = refundLedger;

describe('refund accounting', () => {
  it('allocates a refund across confirmed tenders without losing cents', () => {
    const allocations = allocateTender([
      { id: 'cash', method: 'cash', status: 'confirmed', amount: 60 },
      { id: 'mpesa', method: 'mpesa', status: 'confirmed', amount: 40 }
    ], 33.33);

    expect(allocations).toEqual([
      { paymentId: 'cash', method: 'cash', amount: 20 },
      { paymentId: 'mpesa', method: 'mpesa', amount: 13.33 }
    ]);
    expect(allocations.reduce((sum, row) => sum + row.amount, 0)).toBe(33.33);
  });

  it('allocates discounts and inclusive VAT proportionally to returned quantities', () => {
    const orderItem = {
      id: 'line-1',
      productId: 'product-1',
      quantity: 2,
      unitPrice: 58,
      lineTotal: 116,
      taxRate: 0.16
    };
    const accounting = calculatePartialRefund({
      total: 100,
      OrderItems: [orderItem],
      Payments: [{ id: 'cash', method: 'cash', status: 'confirmed', amount: 100 }]
    }, [{ orderItem, refundQty: 1 }]);

    expect(accounting).toMatchObject({
      subtotal: 43.1,
      taxTotal: 6.9,
      discountTotal: 8,
      total: 50,
      tenderAllocations: [{ paymentId: 'cash', method: 'cash', amount: 50 }]
    });
  });
});
