'use strict';

/* eslint-disable no-console */

require('dotenv').config();

const { Op } = require('sequelize');
const {
  sequelize,
  isUsingMemoryDatabase,
  Category,
  Product,
  InventoryTransaction,
  Order,
  OrderItem,
  Payment,
  EtimsInvoice,
  Customer,
  CustomerLedger,
  LoyaltyTransaction,
  PurchaseOrder,
  PurchaseOrderItem
} = require('../models');

const CATALOG = [
  {
    category: { name: 'Groceries', taxCategory: 'standard' },
    products: [
      {
        sku: 'MILK-500',
        barcode: '6160001000012',
        name: 'Fresh Milk 500ml',
        unit: 'each',
        costPrice: 48,
        sellingPrice: 65,
        taxCategory: 'zero_rated',
        reorderLevel: 8,
        stockQuantity: 30
      },
      {
        sku: 'BREAD-400',
        barcode: '6160001000029',
        name: 'White Bread 400g',
        unit: 'each',
        costPrice: 55,
        sellingPrice: 70,
        taxCategory: 'zero_rated',
        reorderLevel: 10,
        stockQuantity: 24
      }
    ]
  },
  {
    category: { name: 'Fresh produce', taxCategory: 'exempt' },
    products: [
      {
        sku: 'BANANA-KG',
        barcode: '6160001000036',
        name: 'Bananas',
        unit: 'kg',
        isWeighted: true,
        costPrice: 80,
        sellingPrice: 120,
        taxCategory: 'exempt',
        reorderLevel: 5,
        stockQuantity: 12.5
      }
    ]
  },
  {
    category: { name: 'Household', taxCategory: 'standard' },
    products: [
      {
        sku: 'SOAP-800',
        barcode: '6160001000043',
        name: 'Laundry Soap 800g',
        unit: 'each',
        costPrice: 120,
        sellingPrice: 165,
        taxCategory: 'standard',
        reorderLevel: 6,
        stockQuantity: 18
      }
    ]
  }
];

function parseArgs(argv) {
  const args = {
    yes: false,
    tenantId: process.env.RESET_TENANT_ID || 'global'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--tenant-id') {
      args.tenantId = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--tenant-id=')) {
      args.tenantId = arg.split('=')[1];
    } else if (arg === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Reset sales/order queues and the product catalog, then reseed demo products.

Usage:
  npm run db:reset-demo-catalog -- --yes [--tenant-id <uuid|global>]

Options:
  --yes                 Required confirmation for destructive changes.
  --tenant-id global    Reset rows with tenantId = NULL. This is the default.
  --tenant-id <uuid>    Reset one tenant's sales/catalog rows.

This does not clear browser-local held sales or offline checkout queues.
Clear those from the browser profile used for testing.
`);
}

function scopedWhere(tenantId) {
  return tenantId === 'global' ? { tenantId: null } : { tenantId };
}

function idsFrom(rows) {
  return rows.map((row) => row.id);
}

function inWhere(field, ids) {
  return { [field]: { [Op.in]: ids } };
}

async function destroyByIds(model, field, ids, options = {}) {
  if (!ids.length) return 0;
  return model.destroy({
    where: inWhere(field, ids),
    ...options
  });
}

async function getIds(model, where, transaction) {
  const rows = await model.findAll({
    where,
    attributes: ['id'],
    raw: true,
    transaction
  });
  return idsFrom(rows);
}

async function getAffectedCustomerIds(orderIds, transaction) {
  if (!orderIds.length) return [];

  const [ledgerRows, loyaltyRows] = await Promise.all([
    CustomerLedger.findAll({
      where: inWhere('orderId', orderIds),
      attributes: ['customerId'],
      raw: true,
      transaction
    }),
    LoyaltyTransaction.findAll({
      where: inWhere('orderId', orderIds),
      attributes: ['customerId'],
      raw: true,
      transaction
    })
  ]);

  return Array.from(new Set(
    [...ledgerRows, ...loyaltyRows]
      .map((row) => row.customerId)
      .filter(Boolean)
  ));
}

async function recalculateCustomers(customerIds, transaction) {
  for (const customerId of customerIds) {
    const [ledgerRows, loyaltyRows] = await Promise.all([
      CustomerLedger.findAll({
        where: { customerId },
        attributes: ['type', 'amount'],
        raw: true,
        transaction
      }),
      LoyaltyTransaction.findAll({
        where: { customerId },
        attributes: ['points'],
        raw: true,
        transaction
      })
    ]);

    const creditBalance = ledgerRows.reduce((balance, row) => {
      const amount = Number(row.amount || 0);
      return row.type === 'charge' ? balance + amount : balance - amount;
    }, 0);
    const loyaltyPoints = loyaltyRows.reduce((points, row) => points + Number(row.points || 0), 0);

    await Customer.update(
      {
        creditBalance: Number(Math.max(creditBalance, 0).toFixed(2)),
        loyaltyPoints: Math.max(loyaltyPoints, 0)
      },
      { where: { id: customerId }, transaction }
    );
  }
}

async function seedCatalog(tenantId, transaction) {
  const tenantValue = tenantId === 'global' ? null : tenantId;
  const created = { categories: 0, products: 0 };

  for (const group of CATALOG) {
    const category = await Category.create(
      { ...group.category, tenantId: tenantValue },
      { transaction }
    );
    created.categories += 1;

    for (const product of group.products) {
      const row = await Product.create(
        {
          ...product,
          categoryId: category.id,
          tenantId: tenantValue
        },
        { transaction }
      );
      created.products += 1;

      if (Number(product.stockQuantity) > 0) {
        await InventoryTransaction.create(
          {
            productId: row.id,
            type: 'purchase',
            quantity: product.stockQuantity,
            balanceAfter: product.stockQuantity,
            referenceType: 'opening_stock',
            note: 'Reset demo opening stock'
          },
          { transaction }
        );
      }
    }
  }

  return created;
}

async function resetDemoCatalog(tenantId) {
  const scope = scopedWhere(tenantId);

  if (isUsingMemoryDatabase()) {
    await sequelize.sync();
    console.warn('DATABASE_URL is not set. Resetting only a temporary in-memory database for this process.');
  }

  return sequelize.transaction(async (transaction) => {
    const [orderIds, productIds, purchaseOrderIds] = await Promise.all([
      getIds(Order, scope, transaction),
      getIds(Product, scope, transaction),
      getIds(PurchaseOrder, scope, transaction)
    ]);
    const affectedCustomerIds = await getAffectedCustomerIds(orderIds, transaction);

    const counts = {
      etimsInvoices: await destroyByIds(EtimsInvoice, 'orderId', orderIds, { transaction }),
      payments: await destroyByIds(Payment, 'orderId', orderIds, { transaction }),
      orderItems: await destroyByIds(OrderItem, 'orderId', orderIds, { transaction }),
      customerLedgerRows: await destroyByIds(CustomerLedger, 'orderId', orderIds, { transaction }),
      loyaltyTransactions: await destroyByIds(LoyaltyTransaction, 'orderId', orderIds, { transaction }),
      inventoryTransactions: 0,
      purchaseOrderItems: 0,
      purchaseOrders: 0,
      orders: 0,
      products: 0,
      categories: 0
    };

    if (orderIds.length || productIds.length) {
      counts.inventoryTransactions += await InventoryTransaction.destroy({
        where: {
          [Op.or]: [
            ...(productIds.length ? [inWhere('productId', productIds)] : []),
            ...(orderIds.length ? [{ referenceType: 'order', referenceId: { [Op.in]: orderIds } }] : [])
          ]
        },
        transaction
      });
    }

    if (purchaseOrderIds.length || productIds.length) {
      counts.purchaseOrderItems = await PurchaseOrderItem.destroy({
        where: {
          [Op.or]: [
            ...(purchaseOrderIds.length ? [inWhere('purchaseOrderId', purchaseOrderIds)] : []),
            ...(productIds.length ? [inWhere('productId', productIds)] : [])
          ]
        },
        transaction
      });
    }

    counts.purchaseOrders = await PurchaseOrder.destroy({ where: scope, transaction });
    counts.orders = await Order.destroy({ where: scope, transaction });
    counts.products = await Product.destroy({ where: scope, force: true, transaction });
    counts.categories = await Category.destroy({ where: scope, force: true, transaction });

    await recalculateCustomers(affectedCustomerIds, transaction);
    counts.reseeded = await seedCatalog(tenantId, transaction);

    return counts;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.yes) {
    printHelp();
    throw new Error('Refusing to reset data without --yes.');
  }

  if (!args.tenantId) {
    throw new Error('Missing --tenant-id value. Use "global" or a tenant UUID.');
  }

  const counts = await resetDemoCatalog(args.tenantId);

  console.log('Reset complete.');
  console.log(JSON.stringify({ tenantId: args.tenantId, counts }, null, 2));
}

main()
  .catch((err) => {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
