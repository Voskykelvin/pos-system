const assert = require('node:assert/strict');

process.env.PORT = '0';
process.env.ENABLE_ETIMS_SCHEDULER = 'false';
process.env.BUSINESS_NAME = 'Receipt Snapshot Store';
process.env.BUSINESS_KRA_PIN = 'P051123223C';
process.env.ETIMS_DEVICE_SERIAL = 'TEST-CU-001';

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

    const [milk] = await request(baseUrl, '/api/products/search?q=milk', { headers });
    const [soap] = await request(baseUrl, '/api/products/search?q=soap', { headers });

    const checkout = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { productId: milk.id, quantity: 1 },
          { productId: soap.id, quantity: 1 }
        ],
        payments: [{ method: 'cash', amount: '300.00' }]
      })
    });

    const receipt = await request(baseUrl, `/api/orders/${checkout.orderId}/receipt`, { headers });
    const snapshot = {
      business: receipt.business,
      itemCount: receipt.itemCount,
      etims: {
        status: receipt.etims.status,
        cuInvoiceNumber: receipt.etims.cuInvoiceNumber,
        qrCodeUrl: receipt.etims.qrCodeUrl,
        fiscalReady: receipt.etims.fiscalReady,
        deviceSerial: receipt.etims.deviceSerial
      },
      items: receipt.items
        .map((item) => ({
          name: item.name,
          itemCode: item.itemCode,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          lineTotal: Number(item.lineTotal)
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      totals: {
        subtotal: Number(receipt.subtotal),
        taxTotal: Number(receipt.taxTotal),
        discountTotal: Number(receipt.discountTotal),
        total: Number(receipt.total),
        amountTendered: Number(receipt.tender.amountTendered),
        changeDue: Number(receipt.tender.changeDue)
      }
    };

    assert.deepEqual(snapshot, {
      business: {
        name: 'Receipt Snapshot Store',
        kraPin: 'P051123223C',
        receiptPolicy: '',
        receiptFooter: ''
      },
      itemCount: 2,
      etims: {
        status: 'queued',
        cuInvoiceNumber: null,
        qrCodeUrl: null,
        fiscalReady: false,
        deviceSerial: 'TEST-CU-001'
      },
      items: [
        {
          name: 'Fresh Milk 500ml',
          itemCode: '6160001000012',
          unit: 'each',
          quantity: 1,
          unitPrice: 65,
          taxRate: 0,
          lineTotal: 65
        },
        {
          name: 'Laundry Soap 800g',
          itemCode: '6160001000043',
          unit: 'each',
          quantity: 1,
          unitPrice: 165,
          taxRate: 0.16,
          lineTotal: 165
        }
      ],
      totals: {
        subtotal: 207.24,
        taxTotal: 22.76,
        discountTotal: 0,
        total: 230,
        amountTendered: 300,
        changeDue: 70
      }
    });

    console.log('Receipt snapshot passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
