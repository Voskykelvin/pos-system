process.env.PORT = '0';
process.env.ENABLE_ETIMS_SCHEDULER = 'false';

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
    const health = await request(baseUrl, '/api/health');
    if (!health.ok) throw new Error('Health check did not return ok');

    const bootstrap = await request(baseUrl, '/api/bootstrap');
    if (!bootstrap.cashierId) throw new Error('Missing cashierId from bootstrap');

    const products = await request(baseUrl, '/api/products/search?q=milk');
    if (!products.length) throw new Error('Seed product search returned no products');

    const product = products[0];
    const taxRate = product.Category?.taxCategory === 'standard' ? 0.16 : 0;
    const total = Number(product.sellingPrice) * (1 + taxRate);

    const checkout = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashierId: bootstrap.cashierId,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: total.toFixed(2) }]
      })
    });

    if (checkout.paymentStatus !== 'paid') {
      throw new Error(`Expected paid checkout, got ${checkout.paymentStatus}`);
    }

    const report = await request(baseUrl, '/api/reports/today');
    if (report.orderCount < 1) throw new Error('Report did not include smoke order');

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
