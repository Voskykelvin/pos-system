process.env.PORT = '0';
process.env.ENABLE_ETIMS_SCHEDULER = 'false';

try {
  require('moment').suppressDeprecationWarnings = true;
} catch {
  // pg-mem owns this optional test-only dependency.
}

const { start } = require('../server');

async function jsonRequest(baseUrl, path, options = {}, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  if (expectedStatus && response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}: ${body.error || ''}`);
  }
  if (!expectedStatus && !response.ok) {
    throw new Error(`${path} failed: ${body.error || response.statusText}`);
  }
  return body;
}

async function main() {
  const server = await start({ port: 0 });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const login = await jsonRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@example.local', password: 'admin12345' })
    });
    const headers = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json'
    };
    const products = await jsonRequest(baseUrl, '/api/products/search?q=Fresh%20Milk', { headers });
    const milk = products[0];

    await jsonRequest(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'duplicate-stock-guard' },
      body: JSON.stringify({
        items: [
          { productId: milk.id, quantity: 20 },
          { productId: milk.id, quantity: 20 }
        ],
        payments: [{ method: 'cash', amount: 2600 }]
      })
    }, 400);

    const promotion = await jsonRequest(baseUrl, '/api/admin/promotions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: 'MINIMUM500',
        type: 'fixed',
        value: 10,
        minOrderTotal: 500,
        maxUses: 1
      })
    });
    await jsonRequest(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'promotion-minimum-guard' },
      body: JSON.stringify({
        items: [{ productId: milk.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 65 }],
        promotionCode: promotion.code
      })
    }, 400);

    const offlinePayload = {
      items: [{ productId: milk.id, quantity: 1 }],
      payments: [{ method: 'cash', amount: 65 }],
      offlineContext: {
        schemaVersion: 1,
        deviceId: 'financial-test-device',
        sequence: 1,
        capturedAt: new Date().toISOString(),
        items: [{
          productId: milk.id,
          name: milk.name,
          quantity: 1,
          unitPrice: 65,
          taxCategory: 'zero_rated'
        }]
      }
    };
    const offlineCheckout = await jsonRequest(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'offline-device-sequence-1' },
      body: JSON.stringify(offlinePayload)
    });
    const replayedOfflineCheckout = await jsonRequest(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'offline-device-sequence-1-retry' },
      body: JSON.stringify(offlinePayload)
    });
    if (
      replayedOfflineCheckout.orderId !== offlineCheckout.orderId ||
      replayedOfflineCheckout.offlineReplayed !== true
    ) {
      throw new Error('Persistent offline device sequence did not replay the original order');
    }
    await jsonRequest(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'offline-price-conflict' },
      body: JSON.stringify({
        ...offlinePayload,
        offlineContext: {
          ...offlinePayload.offlineContext,
          sequence: 2,
          items: [{ ...offlinePayload.offlineContext.items[0], unitPrice: 70 }]
        }
      })
    }, 409);

    const checkout = await jsonRequest(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'partial-refund-source' },
      body: JSON.stringify({
        items: [
          { productId: milk.id, quantity: 1 },
          { productId: milk.id, quantity: 2 }
        ],
        payments: [{ method: 'cash', amount: 195 }]
      })
    });
    let receipt = await jsonRequest(baseUrl, `/api/orders/${checkout.orderId}/receipt`, { headers });
    if (receipt.items.length !== 1 || receipt.items[0].quantity !== 3) {
      throw new Error('Duplicate checkout lines were not consolidated into one order item');
    }

    await jsonRequest(baseUrl, `/api/orders/${checkout.orderId}/refund/partial`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [{ orderItemId: receipt.items[0].id, quantity: 2 }],
        reason: 'Financial invariant test'
      })
    });
    await jsonRequest(baseUrl, `/api/orders/${checkout.orderId}/refund/partial`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [{ orderItemId: receipt.items[0].id, quantity: 2 }],
        reason: 'Must be rejected'
      })
    }, 400);

    receipt = await jsonRequest(baseUrl, `/api/orders/${checkout.orderId}/receipt`, { headers });
    if (receipt.items[0].refundedQuantity !== 2 || receipt.items[0].refundableQuantity !== 1) {
      throw new Error('Receipt did not preserve cumulative refunded and refundable quantities');
    }
    if (receipt.refunds.length !== 1 || receipt.refundedTotal !== 130 || receipt.netTotal !== 65) {
      throw new Error('Refund ledger did not preserve the partial refund and net order totals');
    }
    const today = await jsonRequest(baseUrl, '/api/reports/today', { headers });
    if (today.recentOrders.find((order) => order.id === checkout.orderId)?.netTotal !== 65) {
      throw new Error('Daily reporting did not expose the net partial-refund sale value');
    }

    // eslint-disable-next-line no-console
    console.log('Financial invariants passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
