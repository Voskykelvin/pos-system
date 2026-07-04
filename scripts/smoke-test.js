process.env.PORT = '0';
process.env.ENABLE_ETIMS_SCHEDULER = 'false';

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

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@example.local',
        password: 'admin12345'
      })
    });
    const authHeaders = { Authorization: `Bearer ${login.token}` };

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

    const product = products[0];
    const taxRate = product.Category?.taxCategory === 'standard' ? 0.16 : 0;
    const total = Number(product.sellingPrice) * (1 + taxRate);

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
        payments: [{ method: 'cash', amount: total.toFixed(2) }]
      })
    });

    if (checkout.paymentStatus !== 'paid') {
      throw new Error(`Expected paid checkout, got ${checkout.paymentStatus}`);
    }

    const receipt = await request(baseUrl, `/api/orders/${checkout.orderId}/receipt`, {
      headers: authHeaders
    });
    if (receipt.orderNumber !== checkout.orderNumber) {
      throw new Error('Receipt lookup returned the wrong order');
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

    const customer = await request(baseUrl, '/api/customers', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Credit Customer', phone: '0700000001' })
    });

    const creditProducts = await request(baseUrl, '/api/products/search?q=bread', {
      headers: authHeaders
    });
    const creditProduct = creditProducts[0];
    const creditTaxRate = creditProduct.Category?.taxCategory === 'standard' ? 0.16 : 0;
    const creditTotal = Number(creditProduct.sellingPrice) * (1 + creditTaxRate);
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
    const discountedTaxRate = discountedProduct.Category?.taxCategory === 'standard' ? 0.16 : 0;
    const discountedGross = Number(discountedProduct.sellingPrice) * (1 + discountedTaxRate);
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
