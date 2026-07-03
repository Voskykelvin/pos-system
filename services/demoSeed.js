const {
  Category,
  Product,
  InventoryTransaction,
  User,
  Order,
  OrderItem,
  Payment,
  EtimsInvoice
} = require('../models');
const { getBusinessDate } = require('../utils/businessTime');

const DEMO_IDS = {
  admin: '00000000-0000-0000-0000-000000000001',
  cashier: '00000000-0000-0000-0000-000000000002',
  groceries: '10000000-0000-0000-0000-000000000001',
  produce: '10000000-0000-0000-0000-000000000002',
  household: '10000000-0000-0000-0000-000000000003'
};

async function createProduct(product) {
  const row = await Product.create(product);

  if (Number(product.stockQuantity) > 0) {
    await InventoryTransaction.create({
      productId: row.id,
      type: 'purchase',
      quantity: product.stockQuantity,
      balanceAfter: product.stockQuantity,
      referenceType: 'opening_stock',
      note: 'Demo opening stock'
    });
  }

  return row;
}

async function createDemoOrder({ sequence, cashierId, items, minutesAgo }) {
  const now = new Date(Date.now() - minutesAgo * 60 * 1000);
  const datePart = getBusinessDate(now).compact;
  let subtotal = 0;
  let taxTotal = 0;

  const lines = items.map(({ product, quantity }) => {
    const taxRate = product.Category?.taxCategory === 'standard' ? 0.16 : 0;
    const lineSubtotal = Number(product.sellingPrice) * quantity;
    const lineTax = lineSubtotal * taxRate;
    subtotal += lineSubtotal;
    taxTotal += lineTax;

    return {
      product,
      quantity,
      unitPrice: Number(product.sellingPrice),
      taxRate,
      lineTotal: lineSubtotal + lineTax
    };
  });

  const total = subtotal + taxTotal;
  const order = await Order.create({
    orderNumber: `SUP-${datePart}-${String(sequence).padStart(4, '0')}`,
    cashierId,
    subtotal,
    taxTotal,
    discountTotal: 0,
    total,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: now,
    updatedAt: now
  });

  for (const line of lines) {
    await OrderItem.create({
      orderId: order.id,
      productId: line.product.id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      lineTotal: line.lineTotal,
      createdAt: now
    });

    const newBalance = Number(line.product.stockQuantity) - line.quantity;
    await line.product.update({ stockQuantity: newBalance });

    await InventoryTransaction.create({
      productId: line.product.id,
      type: 'sale',
      quantity: -line.quantity,
      balanceAfter: newBalance,
      referenceType: 'order',
      referenceId: order.id,
      userId: cashierId,
      createdAt: now
    });
  }

  await Payment.create({
    orderId: order.id,
    method: sequence % 2 === 0 ? 'mpesa' : 'cash',
    amount: total,
    status: 'confirmed',
    mpesaReceiptNumber: sequence % 2 === 0 ? `DEMO${sequence}MPESA` : null,
    createdAt: now,
    updatedAt: now
  });

  await EtimsInvoice.create({
    orderId: order.id,
    status: 'queued',
    payload: {
      demo: true,
      orderNumber: order.orderNumber,
      total
    },
    createdAt: now,
    updatedAt: now
  });

  return order;
}

async function seedDemoData() {
  const existing = await User.count();
  if (existing > 0) return;

  await User.bulkCreate([
    {
      id: DEMO_IDS.admin,
      name: 'Store Admin',
      email: 'admin@example.local',
      passwordHash: 'demo-only',
      role: 'admin'
    },
    {
      id: DEMO_IDS.cashier,
      name: 'Cashier One',
      email: 'cashier@example.local',
      passwordHash: 'demo-only',
      role: 'cashier'
    }
  ]);

  await Category.bulkCreate([
    { id: DEMO_IDS.groceries, name: 'Groceries', taxCategory: 'standard' },
    { id: DEMO_IDS.produce, name: 'Fresh produce', taxCategory: 'zero_rated' },
    { id: DEMO_IDS.household, name: 'Household', taxCategory: 'standard' }
  ]);

  const milk = await createProduct({
    sku: 'MILK-500',
    barcode: '6160001000012',
    name: 'Fresh Milk 500ml',
    unit: 'each',
    costPrice: 48,
    sellingPrice: 65,
    reorderLevel: 8,
    stockQuantity: 30,
    categoryId: DEMO_IDS.groceries
  });

  const bread = await createProduct({
    sku: 'BREAD-400',
    barcode: '6160001000029',
    name: 'White Bread 400g',
    unit: 'each',
    costPrice: 55,
    sellingPrice: 70,
    reorderLevel: 10,
    stockQuantity: 7,
    categoryId: DEMO_IDS.groceries
  });

  const bananas = await createProduct({
    sku: 'BANANA-KG',
    barcode: '6160001000036',
    name: 'Bananas',
    unit: 'kg',
    isWeighted: true,
    costPrice: 80,
    sellingPrice: 120,
    reorderLevel: 5,
    stockQuantity: 12.5,
    categoryId: DEMO_IDS.produce
  });

  const soap = await createProduct({
    sku: 'SOAP-800',
    barcode: '6160001000043',
    name: 'Laundry Soap 800g',
    unit: 'each',
    costPrice: 120,
    sellingPrice: 165,
    reorderLevel: 6,
    stockQuantity: 4,
    categoryId: DEMO_IDS.household
  });

  const seededProducts = await Product.findAll({ include: [{ model: Category }] });
  const bySku = new Map(seededProducts.map((product) => [product.sku, product]));

  await createDemoOrder({
    sequence: 1,
    cashierId: DEMO_IDS.cashier,
    minutesAgo: 210,
    items: [
      { product: bySku.get(milk.sku), quantity: 2 },
      { product: bySku.get(bread.sku), quantity: 1 }
    ]
  });
  await createDemoOrder({
    sequence: 2,
    cashierId: DEMO_IDS.cashier,
    minutesAgo: 95,
    items: [
      { product: bySku.get(bananas.sku), quantity: 1.5 },
      { product: bySku.get(soap.sku), quantity: 1 }
    ]
  });
  await createDemoOrder({
    sequence: 3,
    cashierId: DEMO_IDS.cashier,
    minutesAgo: 25,
    items: [
      { product: bySku.get(milk.sku), quantity: 1 },
      { product: bySku.get(bananas.sku), quantity: 0.75 }
    ]
  });
}

module.exports = { DEMO_IDS, seedDemoData };
