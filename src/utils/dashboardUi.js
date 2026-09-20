export function formatCurrency(value) {
  return `KES ${Number(value || 0).toFixed(2)}`;
}

export function buildDashboardSummary(report = {}) {
  const revenue = Number(report.revenue || 0);
  const orderCount = Number(report.orderCount || 0);
  const pendingEtimsCount = Number(report.pendingEtimsCount || 0);
  const lowStockCount = Array.isArray(report.lowStock) ? report.lowStock.length : 0;
  const averageOrder = Number(report.averageOrderValue || 0);

  const status = revenue > 0
    ? 'Strong sales momentum'
    : orderCount > 0
      ? 'Orders are moving'
      : 'No sales yet';

  const focus = pendingEtimsCount > 0
    ? `${pendingEtimsCount} eTIMS item${pendingEtimsCount === 1 ? '' : 's'} need attention`
    : lowStockCount > 0
      ? `${lowStockCount} low-stock item${lowStockCount === 1 ? '' : 's'} to review`
      : 'Operations look steady';

  const highlight = averageOrder > 0
    ? `Average order ${formatCurrency(averageOrder)}`
    : 'Average order pending';

  return {
    status,
    focus,
    highlight,
    revenue,
    orderCount,
    pendingEtimsCount,
    lowStockCount
  };
}

export function buildDashboardActions(report = {}) {
  const pendingEtimsCount = Number(report.pendingEtimsCount || 0);
  const lowStockCount = Array.isArray(report.lowStock) ? report.lowStock.length : 0;
  const hasRecentOrders = Array.isArray(report.recentOrders) && report.recentOrders.length > 0;

  const actions = [];

  if (pendingEtimsCount > 0) {
    actions.push({
      id: 'operations',
      label: 'Review eTIMS queue',
      priority: 'high',
      detail: `${pendingEtimsCount} pending item${pendingEtimsCount === 1 ? '' : 's'} need action`
    });
  }

  if (lowStockCount > 0) {
    actions.push({
      id: 'inventory',
      label: 'Check low-stock items',
      priority: 'medium',
      detail: `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} below reorder level`
    });
  }

  if (hasRecentOrders) {
    actions.push({
      id: 'checkout',
      label: 'Review recent sales',
      priority: 'low',
      detail: 'Confirm patterns and customer flow'
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'dashboard',
      label: 'Operations check',
      priority: 'low',
      detail: 'No urgent actions flagged'
    });
  }

  return actions;
}

export function buildOperationalAlerts(report = {}) {
  const lowStock = Array.isArray(report.lowStock) ? report.lowStock : [];

  return lowStock
    .map((item) => {
      const stockQuantity = Number(item.stockQuantity || 0);
      const reorderLevel = Number(item.reorderLevel || 0);
      const urgency = stockQuantity <= reorderLevel ? 'high' : 'medium';

      if (!item.name) return null;

      return {
        id: item.id,
        label: item.name,
        severity: urgency,
        message: `${item.name} is below reorder level and needs replenishment soon.`
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
}
