const {
  Category,
  Product,
  InventoryTransaction,
  User
} = require('../models');

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

  await createProduct({
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

  await createProduct({
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

  await createProduct({
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

  await createProduct({
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
}

module.exports = { DEMO_IDS, seedDemoData };
