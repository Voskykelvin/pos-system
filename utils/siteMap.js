module.exports = {
  screens: [
    {
      path: '/',
      name: 'Dashboard',
      purpose: 'Daily sales, payment mix, eTIMS queue, and low-stock watchlist'
    },
    {
      path: '/checkout',
      name: 'Checkout',
      purpose: 'Cashier product search, cart, VAT totals, cash change, and M-Pesa initiation'
    },
    {
      path: '/inventory',
      name: 'Inventory',
      purpose: 'Product catalog, categories, stock levels, and stock adjustments'
    },
    {
      path: '/analytics',
      name: 'Analytics',
      purpose: 'Best sellers, sales mix, stock health, slow movers, and inventory value'
    }
  ],
  api: [
    { method: 'GET', path: '/api/health', purpose: 'Runtime health check' },
    { method: 'POST', path: '/api/auth/login', purpose: 'Staff login and auth token issue' },
    { method: 'GET', path: '/api/auth/me', purpose: 'Current authenticated staff user' },
    { method: 'GET', path: '/api/bootstrap', purpose: 'Current demo/user identifiers for the UI' },
    { method: 'GET', path: '/api/site-map', purpose: 'Machine-readable site map' },
    { method: 'GET', path: '/api/reports/today', purpose: 'Daily operator dashboard metrics' },
    { method: 'GET', path: '/api/reports/analytics?days=30', purpose: 'Sales, inventory, and stock health analytics' },
    { method: 'GET', path: '/api/products/search?q=milk', purpose: 'Cashier product lookup' },
    { method: 'POST', path: '/api/orders/checkout', purpose: 'Create order, payments, stock movements, and queued eTIMS invoice' },
    { method: 'GET', path: '/api/orders/:id/status', purpose: 'Poll payment state after checkout' },
    { method: 'POST', path: '/api/orders/:id/void', purpose: 'Void completed orders before eTIMS transmission' },
    { method: 'POST', path: '/api/mpesa/stk-push', purpose: 'Start M-Pesa STK push for a pending payment' },
    { method: 'POST', path: '/api/mpesa/callback', purpose: 'Receive Safaricom Daraja payment callback' },
    { method: 'POST', path: '/api/etims/sync', purpose: 'Manually process queued eTIMS invoices' },
    { method: 'POST', path: '/api/etims/requeue-failed', purpose: 'Retry failed eTIMS invoices' },
    { method: 'GET', path: '/api/admin/products', purpose: 'List products for back office' },
    { method: 'GET', path: '/api/admin/products/low-stock', purpose: 'List products at or below reorder level' },
    { method: 'POST', path: '/api/admin/products', purpose: 'Create product with opening stock ledger' },
    { method: 'PUT', path: '/api/admin/products/:id', purpose: 'Update product metadata' },
    { method: 'DELETE', path: '/api/admin/products/:id', purpose: 'Soft-deactivate product' },
    { method: 'POST', path: '/api/admin/products/:id/adjust-stock', purpose: 'Post auditable stock movement' },
    { method: 'GET', path: '/api/admin/categories', purpose: 'List product categories' },
    { method: 'POST', path: '/api/admin/categories', purpose: 'Create product category' }
  ]
};
