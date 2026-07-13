const assert = require('node:assert/strict');

process.env.PORT = '0';
process.env.ENABLE_ETIMS_SCHEDULER = 'false';
process.env.ETIMS_ENV = 'production';
process.env.BUSINESS_KRA_PIN = '';

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

async function main() {
  const server = await start({ port: 0 });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@example.local',
        password: 'admin12345'
      })
    });
    const headers = { Authorization: `Bearer ${login.token}` };
    const [product] = await request(baseUrl, '/api/products/search?q=milk', { headers });
    const statusBefore = await request(baseUrl, '/api/etims/status', { headers });

    const order = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: '65.00' }]
      })
    });

    assert.ok(order.orderId, 'Non-fiscal checkout should complete normally');
    const fiscalStatus = await request(baseUrl, '/api/etims/status', { headers });
    assert.equal(fiscalStatus.queued, statusBefore.queued, 'A store without a seller PIN must not queue an eTIMS invoice');
    assert.equal(fiscalStatus.readiness.enabled, false);
    console.log('Non-fiscal receipt guard passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
