const { Op } = require('sequelize');
const {
  Product,
  Category,
  Order,
  OrderItem,
  Payment,
  EtimsInvoice
} = require('../models');
const { getBusinessDayRange } = require('../utils/businessTime');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function number(value) {
  return Number(value || 0);
}

function percent(value) {
  return Number(Number(value || 0).toFixed(1));
}

function parseAnalyticsRange(query) {
  const days = Math.min(Math.max(Number(query.days || 30), 1), 365);
  const end = query.end ? new Date(query.end) : new Date();
  const start = query.start ? new Date(query.start) : new Date(end);

  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
    throw new Error('Invalid start or end date');
  }

  if (!query.start) {
    start.setDate(start.getDate() - days + 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end, days };
}

async function today(req, res) {
  try {
    const { start, end, businessDate, timeZone } = getBusinessDayRange();

    const orders = await Order.findAll({
      where: {
        createdAt: {
          [Op.gte]: start,
          [Op.lt]: end
        }
      },
      include: [{ model: Payment }, { model: EtimsInvoice }],
      order: [['createdAt', 'DESC']]
    });

    const confirmedPayments = orders.flatMap((order) =>
      order.Payments
        .filter((payment) => payment.status === 'confirmed')
        .map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount)
        }))
    );

    const paymentBreakdown = confirmedPayments.reduce((acc, payment) => {
      acc[payment.method] = money((acc[payment.method] || 0) + payment.amount);
      return acc;
    }, {});

    const lowStockProducts = await Product.findAll({
      where: { isActive: true },
      include: [{ model: Category }],
      order: [['name', 'ASC']]
    });

    const lowStock = lowStockProducts
      .filter((product) => Number(product.stockQuantity) <= Number(product.reorderLevel))
      .slice(0, 8)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockQuantity: Number(product.stockQuantity),
        reorderLevel: Number(product.reorderLevel),
        unit: product.unit,
        category: product.Category?.name || null
      }));

    const pendingEtimsCount = await EtimsInvoice.count({
      where: { status: 'queued' }
    });

    const activeProductCount = await Product.count({
      where: { isActive: true }
    });

    const completedOrders = orders.filter((order) => order.status === 'completed');
    const voidedOrders = orders.filter((order) => order.status === 'voided');

    res.json({
      date: businessDate,
      timeZone,
      revenue: money(confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0)),
      orderCount: completedOrders.length,
      voidedCount: voidedOrders.length,
      averageOrderValue: completedOrders.length
        ? money(
          completedOrders.reduce((sum, order) => sum + Number(order.total), 0) /
            completedOrders.length
        )
        : 0,
      paymentBreakdown,
      pendingEtimsCount,
      activeProductCount,
      lowStock,
      recentOrders: orders.slice(0, 6).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function analytics(req, res) {
  try {
    const { start, end, days } = parseAnalyticsRange(req.query);

    const [orders, products, pendingEtimsCount, failedEtimsCount] = await Promise.all([
      Order.findAll({
        where: {
          createdAt: {
            [Op.gte]: start,
            [Op.lte]: end
          }
        },
        include: [
          {
            model: OrderItem,
            include: [{ model: Product, include: [{ model: Category }] }]
          },
          { model: Payment }
        ],
        order: [['createdAt', 'DESC']]
      }),
      Product.findAll({
        where: { isActive: true },
        include: [{ model: Category }],
        order: [['name', 'ASC']]
      }),
      EtimsInvoice.count({ where: { status: 'queued' } }),
      EtimsInvoice.count({ where: { status: 'failed' } })
    ]);

    const paidOrders = orders.filter(
      (order) => order.status === 'completed' && order.paymentStatus === 'paid'
    );
    const voidedOrders = orders.filter((order) => order.status === 'voided');

    const productSales = new Map();
    const categorySales = new Map();
    const paymentMix = {};
    let unitsSold = 0;
    let grossSales = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    let estimatedCost = 0;

    for (const order of paidOrders) {
      grossSales += number(order.total);
      taxTotal += number(order.taxTotal);
      discountTotal += number(order.discountTotal);

      for (const payment of order.Payments || []) {
        if (payment.status !== 'confirmed') continue;
        paymentMix[payment.method] = money((paymentMix[payment.method] || 0) + number(payment.amount));
      }

      for (const item of order.OrderItems || []) {
        const product = item.Product;
        const categoryName = product?.Category?.name || 'Uncategorized';
        const quantity = number(item.quantity);
        const revenue = number(item.lineTotal);
        const cost = number(product?.costPrice) * quantity;

        unitsSold += quantity;
        estimatedCost += cost;

        const productId = product?.id || item.productId;
        const currentProduct = productSales.get(productId) || {
          id: productId,
          name: product?.name || 'Unknown product',
          sku: product?.sku || '',
          category: categoryName,
          unit: product?.unit || 'each',
          unitsSold: 0,
          revenue: 0,
          estimatedGrossProfit: 0,
          stockQuantity: number(product?.stockQuantity),
          reorderLevel: number(product?.reorderLevel)
        };

        currentProduct.unitsSold += quantity;
        currentProduct.revenue += revenue;
        currentProduct.estimatedGrossProfit += revenue - cost;
        productSales.set(productId, currentProduct);

        const category = categorySales.get(categoryName) || {
          category: categoryName,
          unitsSold: 0,
          revenue: 0
        };
        category.unitsSold += quantity;
        category.revenue += revenue;
        categorySales.set(categoryName, category);
      }
    }

    const activeProductCount = products.length;
    const outOfStock = products.filter((product) => number(product.stockQuantity) <= 0);
    const lowStock = products.filter(
      (product) =>
        number(product.stockQuantity) > 0 &&
        number(product.stockQuantity) <= number(product.reorderLevel)
    );

    const inventoryValueAtCost = products.reduce(
      (sum, product) => sum + number(product.stockQuantity) * number(product.costPrice),
      0
    );
    const inventoryRetailValue = products.reduce(
      (sum, product) => sum + number(product.stockQuantity) * number(product.sellingPrice),
      0
    );

    const bestSellers = Array.from(productSales.values())
      .map((product) => {
        const stockPlusSold = product.stockQuantity + product.unitsSold;
        return {
          ...product,
          unitsSold: number(product.unitsSold),
          revenue: money(product.revenue),
          estimatedGrossProfit: money(product.estimatedGrossProfit),
          sellThroughRate: stockPlusSold > 0
            ? percent((product.unitsSold / stockPlusSold) * 100)
            : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const soldProductIds = new Set(productSales.keys());
    const slowMovers = products
      .filter((product) => !soldProductIds.has(product.id) && number(product.stockQuantity) > 0)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.Category?.name || 'Uncategorized',
        stockQuantity: number(product.stockQuantity),
        unit: product.unit,
        inventoryValueAtCost: money(number(product.stockQuantity) * number(product.costPrice)),
        inventoryRetailValue: money(number(product.stockQuantity) * number(product.sellingPrice))
      }))
      .sort((a, b) => b.inventoryRetailValue - a.inventoryRetailValue)
      .slice(0, 10);

    res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
        days
      },
      summary: {
        grossSales: money(grossSales),
        netSalesBeforeTax: money(grossSales - taxTotal),
        estimatedGrossProfit: money(grossSales - estimatedCost),
        taxTotal: money(taxTotal),
        discountTotal: money(discountTotal),
        orderCount: paidOrders.length,
        voidedCount: voidedOrders.length,
        averageOrderValue: paidOrders.length ? money(grossSales / paidOrders.length) : 0,
        unitsSold: number(unitsSold),
        activeProductCount,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        inventoryValueAtCost: money(inventoryValueAtCost),
        inventoryRetailValue: money(inventoryRetailValue),
        pendingEtimsCount,
        failedEtimsCount
      },
      paymentMix,
      bestSellers,
      categorySales: Array.from(categorySales.values())
        .map((category) => ({
          ...category,
          unitsSold: number(category.unitsSold),
          revenue: money(category.revenue)
        }))
        .sort((a, b) => b.revenue - a.revenue),
      stockAlerts: {
        lowStock: lowStock.slice(0, 12).map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.Category?.name || 'Uncategorized',
          stockQuantity: number(product.stockQuantity),
          reorderLevel: number(product.reorderLevel),
          unit: product.unit
        })),
        outOfStock: outOfStock.slice(0, 12).map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.Category?.name || 'Uncategorized',
          reorderLevel: number(product.reorderLevel),
          unit: product.unit
        }))
      },
      slowMovers,
      notes: [
        'Estimated gross profit uses the current product cost price because order items do not yet store cost snapshots.',
        'Sell-through rate is estimated from period units sold divided by period units sold plus current on-hand stock.'
      ]
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { analytics, today };
