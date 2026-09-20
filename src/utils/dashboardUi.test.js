import { describe, expect, it } from 'vitest';
import { buildDashboardActions, buildDashboardSummary, buildOperationalAlerts } from './dashboardUi';

describe('dashboard summary', () => {
  it('returns a strong-sales status when revenue is active', () => {
    expect(buildDashboardSummary({
      revenue: 4500,
      orderCount: 19,
      pendingEtimsCount: 2,
      lowStock: [{ id: 1 }, { id: 2 }],
      averageOrderValue: 236.84
    })).toMatchObject({
      status: 'Strong sales momentum',
      focus: '2 eTIMS items need attention',
      highlight: 'Average order KES 236.84'
    });
  });

  it('falls back to low-stock guidance when there are no eTIMS issues', () => {
    expect(buildDashboardSummary({
      revenue: 0,
      orderCount: 0,
      pendingEtimsCount: 0,
      lowStock: [{ id: 1 }],
      averageOrderValue: 0
    })).toMatchObject({
      status: 'No sales yet',
      focus: '1 low-stock item to review',
      highlight: 'Average order pending'
    });
  });

  it('recommends a quick action based on the highest-priority issue', () => {
    const actions = buildDashboardActions({
      pendingEtimsCount: 3,
      lowStock: [{ id: 1 }],
      recentOrders: [{ id: 1 }]
    });

    expect(actions[0]).toMatchObject({
      id: 'operations',
      label: 'Review eTIMS queue',
      priority: 'high'
    });
  });

  it('turns low-stock items into a reorder recommendation', () => {
    const alerts = buildOperationalAlerts({
      lowStock: [
        { id: 10, name: 'Milk 1L', stockQuantity: 4, reorderLevel: 12, unit: 'bottles' },
        { id: 11, name: 'Bread', stockQuantity: 11, reorderLevel: 10, unit: 'loaves' }
      ]
    });

    expect(alerts[0]).toMatchObject({
      id: 10,
      label: 'Milk 1L',
      severity: 'high',
      message: 'Milk 1L is below reorder level and needs replenishment soon.'
    });
  });
});
