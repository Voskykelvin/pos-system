process.env.PORT = '0';
process.env.ENABLE_ETIMS_SCHEDULER = 'false';
process.env.BUSINESS_KRA_PIN = 'P051234567X';
process.env.PRODUCT_CATALOG_LOOKUP_ENABLED = 'false';

try {
  require('moment').suppressDeprecationWarnings = true;
} catch {
  // pg-mem pulls in moment; suppress its timestamp parsing warning in smoke only.
}

const { start } = require('../server');

async function request(baseUrl, path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${data.error || response.statusText}`);
  }
  return data;
}

async function expectFailure(baseUrl, path, options, status) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  if (response.ok) {
    throw new Error(`${path} unexpectedly succeeded`);
  }
  if (response.status !== status) {
    throw new Error(`${path} returned ${response.status}, expected ${status}: ${data.error}`);
  }
  return data;
}

async function main() {
  const server = await start({ port: 0 });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await request(baseUrl, '/api/health');
    if (!health.ok) throw new Error('Health check did not return ok');
    const ready = await request(baseUrl, '/api/ready');
    if (!ready.ready) throw new Error('Readiness check did not return ready');
    const metricsResponse = await fetch(`${baseUrl}/api/metrics`);
    const metrics = await metricsResponse.text();
    if (!metricsResponse.ok || !metrics.includes('jijenge_http_requests_total')) {
      throw new Error('Prometheus metrics endpoint was unavailable');
    }

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@example.local',
        password: 'admin12345'
      })
    });
    const authHeaders = { Authorization: `Bearer ${login.token}` };

    const superAdminLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.local',
        password: process.env.SUPER_ADMIN_PASSWORD || 'superadmin12345'
      })
    });
    const superAdminHeaders = { Authorization: `Bearer ${superAdminLogin.token}` };
    const platformDashboard = await request(baseUrl, '/api/super-admin/dashboard', {
      headers: superAdminHeaders
    });
    if (!platformDashboard.metrics) {
      throw new Error('Super admin dashboard did not return platform metrics');
    }

    const unusedSignup = await request(baseUrl, '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Unused Smoke Tenant',
        email: `unused-smoke-${Date.now()}@example.local`,
        password: 'owner12345'
      })
    });
    await request(baseUrl, '/api/billing/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${unusedSignup.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'mpesa_manual',
        reference: `UNUSED${Date.now()}`,
        payerPhone: '0700000999',
        payerName: 'Unused Tenant'
      })
    });
    await request(baseUrl, `/api/super-admin/tenants/${unusedSignup.tenant.id}`, {
      method: 'DELETE',
      headers: superAdminHeaders
    });
    const afterDeleteDashboard = await request(baseUrl, '/api/super-admin/dashboard', {
      headers: superAdminHeaders
    });
    if (afterDeleteDashboard.tenants.some((tenant) => tenant.id === unusedSignup.tenant.id)) {
      throw new Error('Unused tenant profile was not deleted');
    }

    const bootstrap = await request(baseUrl, '/api/bootstrap', {
      headers: authHeaders
    });
    if (!bootstrap.cashierId) throw new Error('Missing cashierId from bootstrap');

    const shift = await request(baseUrl, '/api/shifts/open', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingFloat: 1000 })
    });
    if (shift.status !== 'open') throw new Error('Shift did not open');

    await request(baseUrl, '/api/shifts/expenses', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10, category: 'supplies', description: 'Smoke test petty cash' })
    });

    const promotion = await request(baseUrl, '/api/admin/promotions', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SMOKE10', type: 'fixed', value: 10, minOrderTotal: 0 })
    });
    if (promotion.code !== 'SMOKE10') throw new Error('Promotion admin route did not create the code');

    const validatedPromotion = await request(baseUrl, '/api/promotions/validate?code=SMOKE10&orderTotal=100', {
      headers: authHeaders
    });
    if (validatedPromotion.discountAmount !== 10) throw new Error('Promotion validation returned the wrong discount');

    const products = await request(baseUrl, '/api/products/search?q=milk', {
      headers: authHeaders
    });
    if (!products.length) throw new Error('Seed product search returned no products');

    const scannedDraft = await request(baseUrl, '/api/admin/products/scan-lookup', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: '9876543210123' })
    });
    if (scannedDraft.existing || scannedDraft.catalogMatch || !scannedDraft.draft?.sku || scannedDraft.draft.barcode !== '9876543210123') {
      throw new Error('Scan-first product lookup did not return a safe manual draft');
    }

    const product = products[0];
    const total = Number(product.sellingPrice);
    const tenderedTotal = total + 50;

    const checkout = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'smoke-cash-checkout'
      },
      body: JSON.stringify({
        cashierId: bootstrap.cashierId,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: tenderedTotal.toFixed(2) }]
      })
    });

    if (checkout.paymentStatus !== 'paid') {
      throw new Error(`Expected paid checkout, got ${checkout.paymentStatus}`);
    }
    if (Math.abs(Number(checkout.changeDue) - 50) > 0.01) {
      throw new Error(`Expected KES 50.00 change, got ${checkout.changeDue}`);
    }

    const receipt = await request(baseUrl, `/api/orders/${checkout.orderId}/receipt`, {
      headers: authHeaders
    });
    if (receipt.orderNumber !== checkout.orderNumber) {
      throw new Error('Receipt lookup returned the wrong order');
    }
    if (Math.abs(Number(receipt.tender?.amountTendered) - tenderedTotal) > 0.01) {
      throw new Error('Receipt did not keep the tendered cash amount');
    }
    if (!receipt.business?.name || !receipt.items[0]?.itemCode) {
      throw new Error('Receipt is missing fiscal display fields');
    }
    if (Number(receipt.itemCount) !== 1 || !receipt.items[0]?.taxCategory) {
      throw new Error('Receipt is missing retail item count or VAT marker data');
    }

    const etimsDashboard = await request(baseUrl, '/api/etims/dashboard', {
      headers: authHeaders
    });
    if (etimsDashboard.summary.queued < 1 || !Array.isArray(etimsDashboard.recent)) {
      throw new Error('eTIMS dashboard did not return queued invoice status');
    }
    const etimsStatus = await request(baseUrl, '/api/etims/status', {
      headers: authHeaders
    });
    if (etimsStatus.queued < 1 || etimsStatus.failed !== 0) {
      throw new Error('Cashier eTIMS status did not return the expected queue state');
    }

    const orderSearch = await request(
      baseUrl,
      `/api/orders/search?q=${encodeURIComponent(checkout.orderNumber)}`,
      { headers: authHeaders }
    );
    if (!orderSearch.some((order) => order.id === checkout.orderId)) {
      throw new Error('Order search did not include smoke order');
    }

    const report = await request(baseUrl, '/api/reports/today', {
      headers: authHeaders
    });
    if (report.orderCount < 1) throw new Error('Report did not include smoke order');

    const reorder = await request(baseUrl, '/api/reports/reorder-suggestions?days=30', {
      headers: authHeaders
    });
    if (!Array.isArray(reorder.suggestions)) throw new Error('Reorder suggestions did not return a list');

    const vatAudit = await request(baseUrl, '/api/reports/vat-products', {
      headers: authHeaders
    });
    if (!vatAudit.summary?.zero_rated || !Array.isArray(vatAudit.products)) {
      throw new Error('VAT product audit did not return classifications');
    }

    const customer = await request(baseUrl, '/api/customers', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Credit Customer', phone: '0700000001' })
    });

    const creditProducts = await request(baseUrl, '/api/products/search?q=bread', {
      headers: authHeaders
    });
    const creditProduct = creditProducts[0];
    const creditTotal = Number(creditProduct.sellingPrice);
    const creditCheckout = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'smoke-credit-checkout'
      },
      body: JSON.stringify({
        cashierId: bootstrap.cashierId,
        customerId: customer.id,
        items: [{ productId: creditProduct.id, quantity: 1 }],
        payments: [{ method: 'credit', amount: creditTotal.toFixed(2) }]
      })
    });
    if (creditCheckout.paymentStatus !== 'paid') {
      throw new Error(`Expected paid credit checkout, got ${creditCheckout.paymentStatus}`);
    }

    const ledger = await request(baseUrl, `/api/customers/${customer.id}/ledger`, {
      headers: authHeaders
    });
    if (!ledger.transactions.some((entry) => entry.type === 'charge')) {
      throw new Error('Credit checkout did not create a customer ledger charge');
    }

    const closedShift = await request(baseUrl, `/api/shifts/${shift.id}/close`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashCounted: (1000 + total - 10).toFixed(2) })
    });
    if (closedShift.status !== 'closed') throw new Error('Shift did not close');
    if (!closedShift.etimsWarning || closedShift.etimsWarning.queued < 1) {
      throw new Error('Shift close did not warn about queued eTIMS invoices');
    }
    if (Math.abs(Number(closedShift.cashVariance)) > 0.01) {
      throw new Error(`Expected zero shift variance, got ${closedShift.cashVariance}`);
    }

    await request(baseUrl, `/api/orders/${checkout.orderId}/refund`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Smoke test refund' })
    });
    const refundedReceipt = await request(baseUrl, `/api/orders/${checkout.orderId}/receipt`, {
      headers: authHeaders
    });
    if (refundedReceipt.status !== 'refunded' || refundedReceipt.paymentStatus !== 'reversed') {
      throw new Error('Refund did not reverse order and payment state');
    }

    const auditLogs = await request(baseUrl, '/api/audit-logs?limit=20', {
      headers: authHeaders
    });
    for (const action of ['order.checkout', 'shift.open', 'shift.close', 'order.refund']) {
      if (!auditLogs.some((entry) => entry.action === action)) {
        throw new Error(`Audit log missing ${action}`);
      }
    }

    const signup = await request(baseUrl, '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Smoke Tenant Store',
        email: 'owner-smoke@example.local',
        password: 'owner12345'
      })
    });
    if (!signup.token || !signup.user?.tenantId) {
      throw new Error('Signup did not return a tenant-aware owner session');
    }
    if (signup.tenant?.status !== 'pending_payment') {
      throw new Error(`Expected pending_payment tenant after signup, got ${signup.tenant?.status}`);
    }

    const ownerHeaders = { Authorization: `Bearer ${signup.token}` };
    await expectFailure(baseUrl, '/api/products/search?q=milk', {
      headers: ownerHeaders
    }, 402);

    const initialBilling = await request(baseUrl, '/api/billing', {
      headers: ownerHeaders
    });
    if (initialBilling.billing.status !== 'pending_payment') {
      throw new Error(`Expected pending billing status, got ${initialBilling.billing.status}`);
    }

    const rejectedReference = `SMOKEREJECT${Date.now()}`;
    await request(baseUrl, '/api/billing/payments', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'mpesa_manual',
        reference: rejectedReference,
        payerPhone: '0712345678',
        payerName: 'Smoke Owner'
      })
    });

    let reviewDashboard = await request(baseUrl, '/api/super-admin/dashboard', {
      headers: superAdminHeaders
    });
    const rejectedPayment = reviewDashboard.subscriptionPayments.pendingReview.find(
      (payment) => payment.reference === rejectedReference
    );
    if (!rejectedPayment) throw new Error('Submitted subscription payment did not enter review queue');

    await request(baseUrl, `/api/billing/payments/${rejectedPayment.id}/reject`, {
      method: 'POST',
      headers: { ...superAdminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: 'Smoke test rejection reason' })
    });

    const rejectedBilling = await request(baseUrl, '/api/billing', {
      headers: ownerHeaders
    });
    const visibleRejection = rejectedBilling.recentPayments.find((payment) => payment.reference === rejectedReference);
    if (visibleRejection?.status !== 'rejected' || visibleRejection.adminNotes !== 'Smoke test rejection reason') {
      throw new Error('Rejected subscription payment reason was not visible to the tenant');
    }

    const confirmedReference = `SMOKECONFIRM${Date.now()}`;
    await request(baseUrl, '/api/billing/payments', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'mpesa_manual',
        reference: confirmedReference,
        payerPhone: '0712345678',
        payerName: 'Smoke Owner'
      })
    });

    reviewDashboard = await request(baseUrl, '/api/super-admin/dashboard', {
      headers: superAdminHeaders
    });
    const confirmedPayment = reviewDashboard.subscriptionPayments.pendingReview.find(
      (payment) => payment.reference === confirmedReference
    );
    if (!confirmedPayment) throw new Error('Second subscription payment did not enter review queue');

    await request(baseUrl, `/api/billing/payments/${confirmedPayment.id}/confirm`, {
      method: 'POST',
      headers: { ...superAdminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const activatedTenant = await request(baseUrl, '/api/bootstrap', {
      headers: ownerHeaders
    });
    if (activatedTenant.tenant?.status !== 'active' || !activatedTenant.tenant?.subscriptionEndsAt) {
      throw new Error('Confirmed subscription payment did not activate tenant access');
    }

    const originalSubscriptionEnd = activatedTenant.tenant.subscriptionEndsAt;
    const upgradeBilling = await request(baseUrl, '/api/billing', { headers: ownerHeaders });
    const growthQuote = upgradeBilling.billing.availableUpgrades.find((quote) => quote.targetPlan === 'growth');
    if (!growthQuote || growthQuote.amount <= 0) throw new Error('Active Starter tenant did not receive a Growth upgrade quote');

    const upgradeReference = `SMOKEUPGRADE${Date.now()}`;
    await request(baseUrl, '/api/billing/payments', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'mpesa_manual',
        reference: upgradeReference,
        payerPhone: '0712345678',
        payerName: 'Smoke Owner',
        targetPlan: 'growth'
      })
    });
    reviewDashboard = await request(baseUrl, '/api/super-admin/dashboard', { headers: superAdminHeaders });
    const upgradePayment = reviewDashboard.subscriptionPayments.pendingReview.find(
      (payment) => payment.reference === upgradeReference
    );
    if (upgradePayment?.upgrade?.fromPlan !== 'starter' || upgradePayment.upgrade.targetPlan !== 'growth') {
      throw new Error('Mid-cycle upgrade did not enter review with its plan transition metadata');
    }
    await request(baseUrl, `/api/billing/payments/${upgradePayment.id}/confirm`, {
      method: 'POST',
      headers: { ...superAdminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const upgradedTenant = await request(baseUrl, '/api/bootstrap', { headers: ownerHeaders });
    if (upgradedTenant.tenant?.plan !== 'growth' || upgradedTenant.tenant.subscriptionEndsAt !== originalSubscriptionEnd) {
      throw new Error('Confirmed mid-cycle upgrade did not preserve the original renewal date');
    }

    const storeSetup = await request(baseUrl, '/api/admin/store/setup', { headers: ownerHeaders });
    const sourceBranch = storeSetup.branches[0];
    const destinationBranch = await request(baseUrl, '/api/admin/store/branches', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Destination', code: 'SMK-DST' })
    });
    const tenantCategories = await request(baseUrl, '/api/admin/categories', { headers: ownerHeaders });
    const lotProduct = await request(baseUrl, '/api/admin/products', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: `LOT-SMOKE-${Date.now()}`,
        name: 'Lot-aware Smoke Product',
        categoryId: tenantCategories[0].id,
        costPrice: 50,
        sellingPrice: 75,
        stockQuantity: 0,
        tracksLots: true
      })
    });
    const sourceLot = await request(baseUrl, '/api/inventory-lots', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: lotProduct.id,
        branchId: sourceBranch.id,
        lotNumber: 'SMOKE-LOT-01',
        expiryDate: '2027-12-31',
        quantity: 10,
        unitCost: 50
      })
    });
    await expectFailure(baseUrl, '/api/stock-transfers', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        items: [{ productId: lotProduct.id, quantity: 3 }]
      })
    }, 409);
    await request(baseUrl, '/api/stock-transfers', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        note: 'Lot-aware smoke transfer',
        items: [{ productId: lotProduct.id, inventoryLotId: sourceLot.id, quantity: 3 }]
      })
    });
    const destinationLots = await request(
      baseUrl,
      `/api/inventory-lots?productId=${lotProduct.id}&branchId=${destinationBranch.id}&availableOnly=true`,
      { headers: ownerHeaders }
    );
    if (destinationLots.length !== 1 || Number(destinationLots[0].availableQuantity) !== 3 || destinationLots[0].lotNumber !== sourceLot.lotNumber) {
      throw new Error('Lot transfer did not preserve the lot identity and destination quantity');
    }
    const destinationCount = await request(baseUrl, '/api/stock-counts', {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: destinationBranch.id,
        productIds: [lotProduct.id],
        note: 'Lot-aware smoke count'
      })
    });
    const destinationCountLine = destinationCount.StockCountItems?.[0];
    if (destinationCountLine?.inventoryLotId !== destinationLots[0].id || Number(destinationCountLine.expectedQuantity) !== 3) {
      throw new Error('Lot-aware stock count did not snapshot the destination lot');
    }
    await request(baseUrl, `/api/stock-counts/${destinationCount.id}/items`, {
      method: 'PUT',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          productId: lotProduct.id,
          inventoryLotId: destinationLots[0].id,
          countedQuantity: 2.5
        }]
      })
    });
    await request(baseUrl, `/api/stock-counts/${destinationCount.id}/complete`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const countedDestinationLots = await request(
      baseUrl,
      `/api/inventory-lots?productId=${lotProduct.id}&branchId=${destinationBranch.id}&availableOnly=true`,
      { headers: ownerHeaders }
    );
    const sourceLotsAfterCount = await request(
      baseUrl,
      `/api/inventory-lots?productId=${lotProduct.id}&branchId=${sourceBranch.id}&availableOnly=true`,
      { headers: ownerHeaders }
    );
    const lotProductsAfterCount = await request(baseUrl, '/api/admin/products', { headers: ownerHeaders });
    const lotProductAfterCount = lotProductsAfterCount.find((row) => row.id === lotProduct.id);
    if (Number(countedDestinationLots[0]?.availableQuantity) !== 2.5 || Number(sourceLotsAfterCount[0]?.availableQuantity) !== 7 || Number(lotProductAfterCount?.stockQuantity) !== 9.5) {
      throw new Error('Lot count variance did not reconcile lot, branch, and tenant stock balances');
    }

    const cashierLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'cashier@example.local',
        password: 'cashier12345'
      })
    });
    const cashierHeaders = { Authorization: `Bearer ${cashierLogin.token}` };
    const cashierProducts = await request(baseUrl, '/api/products/search?q=milk', {
      headers: cashierHeaders
    });
    const discountedProduct = cashierProducts[0];
    const discountedGross = Number(discountedProduct.sellingPrice);
    const discountTotal = Number((discountedGross > 1 ? 1 : discountedGross / 2).toFixed(2));
    const discountedTotal = discountedGross - discountTotal;

    await expectFailure(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...cashierHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: discountedProduct.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: discountedTotal.toFixed(2) }],
        discountTotal
      })
    }, 403);

    const discountedCheckout = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...cashierHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: discountedProduct.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: discountedTotal.toFixed(2) }],
        discountTotal,
        managerApproval: {
          identifier: 'admin@example.local',
          password: 'admin12345'
        }
      })
    });
    if (discountedCheckout.paymentStatus !== 'paid') {
      throw new Error('Discounted cashier checkout was not paid');
    }

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: cashierHeaders
    });
    if (logoutResponse.status !== 204) {
      throw new Error(`Logout returned ${logoutResponse.status}, expected 204`);
    }
    await expectFailure(baseUrl, '/api/bootstrap', { headers: cashierHeaders }, 401);

    console.log('Smoke test passed');
    console.log(`Order: ${checkout.orderNumber}`);
    console.log(`Revenue: KES ${Number(report.revenue).toFixed(2)}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
