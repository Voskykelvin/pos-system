module.exports = {
  screens: [
    {
      path: '/home',
      name: 'Master Homepage',
      purpose: 'Public product homepage, signup entry, pricing, and feature map back into the app',
      public: true
    },
    {
      path: '/',
      name: 'Dashboard',
      purpose: 'Daily sales, payment mix, eTIMS queue, and low-stock watchlist'
    },
    {
      path: '/billing',
      name: 'Subscription Billing',
      purpose: 'Tenant subscription payment instructions, manual reference submission, status, and payment history'
    },
    {
      path: '/store',
      name: 'Store Setup',
      purpose: 'Branches, staff profiles, subscription payment method, shop details, M-Pesa, and KRA/eTIMS VAT readiness'
    },
    {
      path: '/checkout',
      name: 'Checkout',
      purpose: 'Cashier product search, cart, held-sale recall, VAT totals, split payments, and M-Pesa initiation'
    },
    {
      path: '/inventory',
      name: 'Inventory',
      purpose: 'Products, suppliers, purchase orders, reorder suggestions, promotions, CSV tools, and barcode labels'
    },
    {
      path: '/analytics',
      name: 'Analytics',
      purpose: 'Sales trends, conversion, staff performance, payment mix, stock health, and reorder recommendations'
    },
    {
      path: '/customers',
      name: 'Customers',
      purpose: 'Customer profiles, loyalty balances, credit ledgers, and repayments'
    },
    {
      path: '/operations',
      name: 'Operations',
      purpose: 'Shift control, expenses, cash reconciliation, receipt lookup, voids, refunds, printing, and audit review'
    },
    {
      path: '/super-admin',
      name: 'Platform SaaS',
      purpose: 'Platform owner overview for MRR, subscription review, and tenant health'
    },
    {
      path: '/super-admin/analytics',
      name: 'Platform Analytics',
      purpose: 'Signup trends, tenant POS sales signal, plan economics, and health charts'
    },
    {
      path: '/super-admin/plans',
      name: 'Platform Plans',
      purpose: 'Starter, Growth, and Enterprise plan packaging'
    },
    {
      path: '/super-admin/subscriptions',
      name: 'Platform Subscriptions',
      purpose: 'Subscription alerts and pending payment reference review'
    },
    {
      path: '/super-admin/tenants',
      name: 'Platform Users & Stores',
      purpose: 'Tenant owner profiles, store status, plan updates, suspension, and unused profile cleanup'
    }
  ],
  api: [
    { method: 'GET', path: '/api/health', purpose: 'Runtime health check' },
    { method: 'GET', path: '/api/bootstrap', purpose: 'Current authenticated user and cashier identifiers' },
    { method: 'GET', path: '/api/site-map', purpose: 'Machine-readable site map' },
    { method: 'GET', path: '/api/plans', purpose: 'Public plan and pricing catalog for homepage and signup' },
    { method: 'POST', path: '/api/signup', purpose: 'Self-serve tenant signup' },
    { method: 'GET', path: '/api/billing', purpose: 'Tenant subscription status, payment instructions, and recent payment references' },
    { method: 'POST', path: '/api/billing/payments', purpose: 'Submit a manual subscription payment reference for admin verification' },
    { method: 'POST', path: '/api/billing/payments/:id/confirm', purpose: 'Super-admin confirms a subscription payment and extends the billing period' },
    { method: 'POST', path: '/api/billing/payments/:id/reject', purpose: 'Super-admin rejects an unverified subscription payment reference' },
    { method: 'GET', path: '/api/super-admin/dashboard', purpose: 'Platform owner MRR, activation, tenant health, plan tiers, and activity metrics' },
    { method: 'PUT', path: '/api/super-admin/tenants/:id', purpose: 'Platform owner tenant update' },
    { method: 'DELETE', path: '/api/super-admin/tenants/:id', purpose: 'Delete an unused tenant profile that has no protected business activity' },
    { method: 'POST', path: '/api/auth/login', purpose: 'Staff login and auth token issue' },
    { method: 'GET', path: '/api/auth/me', purpose: 'Current authenticated staff user' },
    { method: 'GET', path: '/api/products/search', purpose: 'Cashier product lookup by text or barcode' },
    { method: 'POST', path: '/api/orders/checkout', purpose: 'Create order, payments, stock movements, ledgers, and queued eTIMS invoice' },
    { method: 'GET', path: '/api/orders/search', purpose: 'Find recent receipts/orders' },
    { method: 'GET', path: '/api/orders/:id/receipt', purpose: 'Detailed receipt payload' },
    { method: 'GET', path: '/api/orders/:id/status', purpose: 'Poll payment status after checkout' },
    { method: 'POST', path: '/api/orders/:id/void', purpose: 'Void completed order before eTIMS transmission' },
    { method: 'POST', path: '/api/orders/:id/refund', purpose: 'Refund completed order before eTIMS transmission' },
    { method: 'POST', path: '/api/orders/:id/refund/partial', purpose: 'Return selected line items and restore stock' },
    { method: 'POST', path: '/api/mpesa/stk-push', purpose: 'Start M-Pesa STK push for a pending payment' },
    { method: 'POST', path: '/api/mpesa/callback', purpose: 'Receive Safaricom Daraja callback' },
    { method: 'GET', path: '/api/customers/search', purpose: 'Search customers by name or phone' },
    { method: 'POST', path: '/api/customers', purpose: 'Create customer' },
    { method: 'GET', path: '/api/customers/:id/ledger', purpose: 'Customer credit ledger' },
    { method: 'POST', path: '/api/customers/:id/payment', purpose: 'Record debt repayment' },
    { method: 'GET', path: '/api/shifts/current', purpose: 'Current open shift for authenticated cashier' },
    { method: 'GET', path: '/api/shifts/summary', purpose: 'Manager/admin multi-till shift summary' },
    { method: 'POST', path: '/api/shifts/open', purpose: 'Open cashier shift' },
    { method: 'POST', path: '/api/shifts/:id/close', purpose: 'Close shift and record cash variance' },
    { method: 'POST', path: '/api/shifts/expenses', purpose: 'Log petty cash expense' },
    { method: 'GET', path: '/api/reports/today', purpose: 'Dashboard metrics' },
    { method: 'GET', path: '/api/reports/analytics', purpose: 'Sales trends, conversion, staff, inventory, and stock health analytics' },
    { method: 'GET', path: '/api/reports/export', purpose: 'CSV sales export' },
    { method: 'GET', path: '/api/reports/reorder-suggestions', purpose: 'Sales velocity reorder suggestions' },
    { method: 'GET', path: '/api/admin/store/setup', purpose: 'Admin setup dashboard for branches, staff, subscription billing, payment, and tax readiness' },
    { method: 'POST', path: '/api/admin/store/branches', purpose: 'Create a branch profile within the store subscription limits' },
    { method: 'PUT', path: '/api/admin/store/branches/:id', purpose: 'Update a branch profile' },
    { method: 'POST', path: '/api/admin/store/staff', purpose: 'Create staff login profiles for cashiers, managers, or admins' },
    { method: 'PUT', path: '/api/admin/store/staff/:id', purpose: 'Update staff profile, branch assignment, role, password, or active status' },
    { method: 'PUT', path: '/api/admin/store/settings', purpose: 'Update store subscription payment method, shop details, M-Pesa, and KRA/eTIMS readiness settings' },
    { method: 'GET', path: '/api/admin/products', purpose: 'List products for back office' },
    { method: 'POST', path: '/api/admin/products', purpose: 'Create product' },
    { method: 'PUT', path: '/api/admin/products/:id', purpose: 'Update product metadata' },
    { method: 'DELETE', path: '/api/admin/products/:id', purpose: 'Soft-deactivate product' },
    { method: 'POST', path: '/api/admin/products/:id/adjust-stock', purpose: 'Post auditable stock movement' },
    { method: 'GET', path: '/api/admin/products/export-csv', purpose: 'Export product catalog CSV' },
    { method: 'POST', path: '/api/admin/products/import-csv', purpose: 'Import product catalog CSV' },
    { method: 'GET', path: '/api/admin/categories', purpose: 'List product categories' },
    { method: 'POST', path: '/api/admin/categories', purpose: 'Create product category' },
    { method: 'GET', path: '/api/admin/promotions', purpose: 'List promotion codes' },
    { method: 'POST', path: '/api/admin/promotions', purpose: 'Create promotion code' },
    { method: 'PUT', path: '/api/admin/promotions/:id', purpose: 'Update promotion code' },
    { method: 'GET', path: '/api/promotions/validate', purpose: 'Validate checkout promotion code' },
    { method: 'GET', path: '/api/suppliers', purpose: 'List suppliers' },
    { method: 'POST', path: '/api/suppliers', purpose: 'Create supplier' },
    { method: 'PUT', path: '/api/suppliers/:id', purpose: 'Update supplier' },
    { method: 'GET', path: '/api/purchase-orders', purpose: 'List purchase orders' },
    { method: 'POST', path: '/api/purchase-orders', purpose: 'Create purchase order' },
    { method: 'POST', path: '/api/purchase-orders/:id/receive', purpose: 'Receive stock from purchase order' },
    { method: 'GET', path: '/api/audit-logs', purpose: 'Manager/admin audit trail' },
    { method: 'POST', path: '/api/etims/sync', purpose: 'Process queued eTIMS invoices' },
    { method: 'POST', path: '/api/etims/requeue-failed', purpose: 'Retry failed eTIMS invoices' }
  ]
};
