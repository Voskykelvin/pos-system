import { describe, expect, it } from 'vitest';
import { getCheckoutQuickStatus } from './checkoutUi';

describe('checkout quick status', () => {
  it('shows a clear empty state when the scanner has not started searching yet', () => {
    expect(getCheckoutQuickStatus('', 0, 0)).toBe('Ready to scan or search');
  });

  it('shows the product count and cart size during busy checkout work', () => {
    expect(getCheckoutQuickStatus('milk', 14, 3)).toBe('14 products found · 3 items in cart');
  });

  it('shows the no-results state when the query is not matched', () => {
    expect(getCheckoutQuickStatus('zzzzz', 0, 2)).toBe('No products found · 2 items in cart');
  });
});
