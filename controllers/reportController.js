const { Op } = require('sequelize');

const ANALYTICS_CACHE = {};
const CACHE_TTL_MS = 60 * 1000;

function getCacheKey(req, endpointName) {
  const queryStr = JSON.stringify(req.query || {});
  return `${req.tenantId || 'global'}-${req.user?.id || 'public'}-${endpointName}-${queryStr}`;
}

function getCachedData(key) {
  const entry = ANALYTICS_CACHE[key];
  if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
    return entry.data;
  }
  return null;
}

function setCacheData(key, data) {
  ANALYTICS_CACHE[key] = {
    timestamp: Date.now(),
    data
  };
}

function invalidateTenantCache(tenantId) {
  const prefix = `${tenantId || 'global'}-`;
  for (const key of Object.keys(ANALYTICS_CACHE)) {
    if (key.startsWith(prefix)) {
      delete ANALYTICS_CACHE[key];
    }
  }
}

const {
  sequelize,
  Product,
  Category,
  Customer,
  Order,
  OrderItem,
  Payment,
  OrderRefund,
  OrderRefundItem,
  EtimsInvoice,
  User
} = require('../models');
const { getBusinessDayRange } = require('../utils/businessTime');
const { tenantWhere } = require('../utils/tenantScope');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function number(value) {
  return Number(value || 0);
}

function percent(value) {
  return Number(Number(value || 0).toFixed(1));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? percent((numerator / denominator) * 100) : 0;
}

function etimsOrderScope(req) {
  const scope = {
    model: Order,
    attributes: [],
    required: true
  };
  if (req.tenantId) scope.where = { tenantId: req.tenantId };
  return scope;
}

function countEtims(req, where) {
  return EtimsInvoice.count({
    where,
    include: [etimsOrderScope(req)]
  });
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildDailySeries(start, end) {
  const series = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    const date = dateKey(cursor);
    series.push({
      date,
      sales: 0,
      grossProfit: 0,
      orders: 0,
      attemptedOrders: 0,
      voidedOrders: 0,
      unitsSold: 0,
      averageOrderValue: 0
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
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
  const cacheKey = getCacheKey(req, 'today');
  const cached = getCachedData(cacheKey);
  if (cached) return res.json(cached);

  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 200) {
      setCacheData(cacheKey, data);
    }
    return originalJson.call(this, data);
  };

  try {
    const { start, end, businessDate, timeZone } = getBusinessDayRange();

    const orders = await Order.findAll({
      where: tenantWhere(req, {
        createdAt: {
          [Op.gte]: start,
          [Op.lt]: end
        }
      }),
      include: [{ model: Payment }, { model: OrderRefund }, { model: EtimsInvoice }],
      order: [['createdAt', 'DESC']]
    });

    const refunds = await OrderRefund.findAll({
      where: { createdAt: { [Op.gte]: start, [Op.lt]: end } },
      include: [{
        model: Order,
        attributes: ['id', 'tenantId'],
        required: true,
        ...(req.tenantId ? { where: { tenantId: req.tenantId } } : {})
      }]
    });

    const saleOrders = orders.filter((order) =>
      ['completed', 'partial_refund', 'refunded'].includes(order.status) &&
      ['paid', 'partial', 'reversed'].includes(order.paymentStatus)
    );
    const salePayments = saleOrders.flatMap((order) =>
      order.Payments
        .filter((payment) => payment.status === 'confirmed' || order.status === 'refunded')
        .map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount)
        }))
    );

    const refundAllocations = refunds.flatMap((refund) => refund.tenderAllocations || []);

    const paymentBreakdown = salePayments.reduce((acc, payment) => {
      acc[payment.method] = money((acc[payment.method] || 0) + payment.amount);
      return acc;
    }, {});
    for (const allocation of refundAllocations) {
      paymentBreakdown[allocation.method] = money(
        (paymentBreakdown[allocation.method] || 0) - Number(allocation.amount || 0)
      );
    }

    const lowStockProducts = await Product.findAll({
      where: tenantWhere(req, { isActive: true }),
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

    const pendingEtimsCount = await countEtims(req, { status: 'queued' });

    const activeProductCount = await Product.count({
      where: tenantWhere(req, { isActive: true })
    });

    const completedOrders = saleOrders.filter((order) => order.status !== 'refunded');
    const voidedOrders = orders.filter((order) => order.status === 'voided');

    res.json({
      date: businessDate,
      timeZone,
      revenue: money(
        saleOrders.reduce((sum, order) => sum + Number(order.total), 0) -
        refunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0)
      ),
      orderCount: completedOrders.length,
      voidedCount: voidedOrders.length,
      averageOrderValue: completedOrders.length
        ? money(
          completedOrders.reduce(
            (sum, order) => sum + Number(order.total) - Number(order.refundedTotal || 0),
            0
          ) /
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
        refundedTotal: Number(order.refundedTotal || 0),
        netTotal: Math.max(Number(order.total) - Number(order.refundedTotal || 0), 0),
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
  const cacheKey = getCacheKey(req, 'analytics');
  const cached = getCachedData(cacheKey);
  if (cached) return res.json(cached);

  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 200) {
      setCacheData(cacheKey, data);
    }
    return originalJson.call(this, data);
  };

  try {
    const { start, end, days } = parseAnalyticsRange(req.query);
    const leadTimeDays = Math.min(Math.max(Number(req.query.leadTimeDays || 7), 1), 90);

    const [orders, periodRefunds, products, customers, pendingEtimsCount, failedEtimsCount] = await Promise.all([
      Order.findAll({
        where: tenantWhere(req, {
          createdAt: {
            [Op.gte]: start,
            [Op.lte]: end
          }
        }),
        include: [
          {
            model: OrderItem,
            include: [{ model: Product, include: [{ model: Category }] }]
          },
          { model: Payment },
          { model: User, as: 'cashier', attributes: ['id', 'name', 'role'] }
        ],
        order: [['createdAt', 'DESC']]
      }),
      OrderRefund.findAll({
        where: { createdAt: { [Op.gte]: start, [Op.lte]: end } },
        include: [
          {
            model: Order,
            required: true,
            where: tenantWhere(req),
            include: [{ model: User, as: 'cashier', attributes: ['id', 'name', 'role'] }]
          },
          {
            model: OrderRefundItem,
            include: [{ model: OrderItem, include: [{ model: Product, include: [{ model: Category }] }] }]
          }
        ]
      }),
      Product.findAll({
        where: tenantWhere(req, { isActive: true }),
        include: [{ model: Category }],
        order: [['name', 'ASC']]
      }),
      Customer.findAll({
        where: tenantWhere(req),
        order: [['createdAt', 'DESC']]
      }),
      countEtims(req, { status: 'queued' }),
      countEtims(req, { status: 'failed' })
    ]);

    const paidOrders = orders.filter(
      (order) =>
        ['completed', 'partial_refund', 'refunded'].includes(order.status) &&
        ['paid', 'partial', 'reversed'].includes(order.paymentStatus)
    );
    const voidedOrders = orders.filter((order) => order.status === 'voided');

    const productSales = new Map();
    const categorySales = new Map();
    const customerOrderCounts = new Map();
    const staffPerformance = new Map();
    const dailySeries = buildDailySeries(start, end);
    const dailyMap = new Map(dailySeries.map((day) => [day.date, day]));
    const paymentMix = {};
    let unitsSold = 0;
    let grossSales = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    let estimatedCost = 0;
    let capturedCustomerOrders = 0;
    let customerSales = 0;

    for (const order of orders) {
      const day = dailyMap.get(dateKey(order.createdAt));
      if (day) {
        day.attemptedOrders += 1;
        if (order.status === 'voided') day.voidedOrders += 1;
      }

      const cashierId = order.cashierId || 'unknown';
      const staff = staffPerformance.get(cashierId) || {
        id: cashierId,
        name: order.cashier?.name || 'Unknown cashier',
        role: order.cashier?.role || 'cashier',
        attemptedOrders: 0,
        orders: 0,
        voidedOrders: 0,
        sales: 0,
        unitsSold: 0,
        averageOrderValue: 0,
        conversionRate: 0
      };
      staff.attemptedOrders += 1;
      if (order.status === 'voided') staff.voidedOrders += 1;
      staffPerformance.set(cashierId, staff);
    }

    for (const order of paidOrders) {
      const netOrderTotal = number(order.total);
      grossSales += netOrderTotal;
      taxTotal += number(order.taxTotal);
      discountTotal += number(order.discountTotal);

      const day = dailyMap.get(dateKey(order.createdAt));
      if (day) {
        day.sales += netOrderTotal;
        day.orders += 1;
      }

      if (order.customerId) {
        capturedCustomerOrders += 1;
        customerSales += netOrderTotal;
        customerOrderCounts.set(
          order.customerId,
          (customerOrderCounts.get(order.customerId) || 0) + 1
        );
      }

      const staff = staffPerformance.get(order.cashierId);
      if (staff) {
        staff.orders += 1;
        staff.sales += netOrderTotal;
      }

      for (const payment of order.Payments || []) {
        if (payment.status !== 'confirmed' && order.status !== 'refunded') continue;
        paymentMix[payment.method] = money((paymentMix[payment.method] || 0) + number(payment.amount));
      }
      for (const item of order.OrderItems || []) {
        const product = item.Product;
        const categoryName = product?.Category?.name || 'Uncategorized';
        const quantity = number(item.quantity);
        const orderGross = (order.OrderItems || []).reduce((sum, row) => sum + number(row.lineTotal), 0);
        const priceRatio = orderGross > 0 ? number(order.total) / orderGross : 0;
        const revenue = number(item.unitPrice) * quantity * priceRatio;
        const netRevenue = revenue;
        const cost = number(item.costPrice ?? product?.costPrice) * quantity;

        unitsSold += quantity;
        estimatedCost += cost;

        if (day) {
          day.unitsSold += quantity;
          day.grossProfit += netRevenue - cost;
        }

        const staff = staffPerformance.get(order.cashierId);
        if (staff) {
          staff.unitsSold += quantity;
        }

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
        currentProduct.estimatedGrossProfit += netRevenue - cost;
        productSales.set(productId, currentProduct);

        const category = categorySales.get(categoryName) || {
          category: categoryName,
          unitsSold: 0,
          revenue: 0,
          estimatedGrossProfit: 0
        };
        category.unitsSold += quantity;
        category.revenue += revenue;
        category.estimatedGrossProfit += netRevenue - cost;
        categorySales.set(categoryName, category);
      }
    }

    for (const refund of periodRefunds) {
      grossSales -= number(refund.total);
      taxTotal -= number(refund.taxTotal);
      discountTotal -= number(refund.discountTotal);

      const day = dailyMap.get(dateKey(refund.createdAt));
      if (day) day.sales -= number(refund.total);

      const refundOrder = refund.Order;
      if (refundOrder?.customerId) customerSales -= number(refund.total);
      const cashierId = refundOrder?.cashierId || 'unknown';
      const staff = staffPerformance.get(cashierId) || {
        id: cashierId,
        name: refundOrder?.cashier?.name || 'Unknown cashier',
        role: refundOrder?.cashier?.role || 'cashier',
        attemptedOrders: 0,
        orders: 0,
        voidedOrders: 0,
        sales: 0,
        unitsSold: 0,
        averageOrderValue: 0,
        conversionRate: 0
      };
      staff.sales -= number(refund.total);
      staffPerformance.set(cashierId, staff);

      for (const allocation of refund.tenderAllocations || []) {
        paymentMix[allocation.method] = money(
          (paymentMix[allocation.method] || 0) - number(allocation.amount)
        );
      }

      for (const refundItem of refund.OrderRefundItems || []) {
        const orderItem = refundItem.OrderItem;
        const product = orderItem?.Product;
        const categoryName = product?.Category?.name || 'Uncategorized';
        const quantity = number(refundItem.quantity);
        const revenue = number(refundItem.total);
        const cost = number(orderItem?.costPrice ?? product?.costPrice) * quantity;
        unitsSold -= quantity;
        estimatedCost -= cost;
        if (day) {
          day.unitsSold -= quantity;
          day.grossProfit -= revenue - cost;
        }
        staff.unitsSold -= quantity;

        const productId = refundItem.productId;
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
        currentProduct.unitsSold -= quantity;
        currentProduct.revenue -= revenue;
        currentProduct.estimatedGrossProfit -= revenue - cost;
        productSales.set(productId, currentProduct);

        const category = categorySales.get(categoryName) || {
          category: categoryName,
          unitsSold: 0,
          revenue: 0,
          estimatedGrossProfit: 0
        };
        category.unitsSold -= quantity;
        category.revenue -= revenue;
        category.estimatedGrossProfit -= revenue - cost;
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
    const stockOnHandUnits = products.reduce(
      (sum, product) => sum + number(product.stockQuantity),
      0
    );
    const stockoutRate = ratio(outOfStock.length, activeProductCount);
    const lowStockRate = ratio(lowStock.length, activeProductCount);
    const aggregateSellThroughRate = ratio(unitsSold, unitsSold + stockOnHandUnits);
    const newCustomers = customers.filter(
      (customer) => customer.createdAt >= start && customer.createdAt <= end
    );
    const creditCustomers = customers.filter((customer) => number(customer.creditBalance) > 0);
    const creditOutstanding = customers.reduce(
      (sum, customer) => sum + number(customer.creditBalance),
      0
    );
    const repeatCustomers = Array.from(customerOrderCounts.values()).filter((count) => count > 1).length;

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

    const categorySalesList = Array.from(categorySales.values())
      .map((category) => ({
        ...category,
        unitsSold: number(category.unitsSold),
        revenue: money(category.revenue),
        estimatedGrossProfit: money(category.estimatedGrossProfit),
        salesShare: ratio(category.revenue, grossSales)
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const paymentMixChart = Object.entries(paymentMix)
      .map(([method, amount]) => ({
        method,
        amount: money(amount),
        share: ratio(amount, grossSales)
      }))
      .sort((a, b) => b.amount - a.amount);

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

    const severityRank = {
      out_of_stock: 5,
      low_stock: 4,
      lead_time_risk: 3,
      watch: 2,
      healthy: 1
    };
    const stockRecommendations = products
      .map((product) => {
        const sales = productSales.get(product.id);
        const totalSold = number(sales?.unitsSold);
        const dailyVelocity = totalSold / days;
        const currentStock = number(product.stockQuantity);
        const reorderLevel = number(product.reorderLevel);
        const leadTimeDemand = dailyVelocity * leadTimeDays;
        const daysOfStockRemaining = dailyVelocity > 0 ? currentStock / dailyVelocity : null;
        const targetStock = Math.ceil(reorderLevel + leadTimeDemand);
        const minimumReorderQty = currentStock <= reorderLevel ? Math.max(reorderLevel, 1) : 0;
        const suggestedReorderQty = Math.max(targetStock - currentStock, minimumReorderQty, 0);

        let urgency = 'healthy';
        if (currentStock <= 0) urgency = 'out_of_stock';
        else if (currentStock <= reorderLevel) urgency = 'low_stock';
        else if (daysOfStockRemaining !== null && daysOfStockRemaining <= leadTimeDays) {
          urgency = 'lead_time_risk';
        } else if (daysOfStockRemaining !== null && daysOfStockRemaining <= leadTimeDays * 2) {
          urgency = 'watch';
        }

        let recommendation = 'Stock cover is healthy.';
        if (urgency === 'out_of_stock') {
          recommendation = 'Out of stock. Reorder immediately.';
        } else if (urgency === 'low_stock') {
          recommendation = 'Below reorder level. Replenish before checkout stalls.';
        } else if (urgency === 'lead_time_risk') {
          recommendation = `Only ${Math.ceil(daysOfStockRemaining)} days of stock remain against a ${leadTimeDays}-day lead time.`;
        } else if (urgency === 'watch') {
          recommendation = 'Stock cover is tightening. Prepare the next purchase order.';
        }

        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.Category?.name || 'Uncategorized',
          unit: product.unit,
          currentStock,
          reorderLevel,
          totalSoldInPeriod: number(totalSold.toFixed(2)),
          dailyVelocity: number(dailyVelocity.toFixed(2)),
          daysOfStockRemaining: daysOfStockRemaining === null
            ? null
            : number(daysOfStockRemaining.toFixed(1)),
          leadTimeDays,
          targetStock,
          suggestedReorderQty: Math.ceil(suggestedReorderQty),
          estimatedReorderCost: money(Math.ceil(suggestedReorderQty) * number(product.costPrice)),
          urgency,
          recommendation
        };
      })
      .filter((item) => item.urgency !== 'healthy' || item.suggestedReorderQty > 0)
      .sort((a, b) => {
        if (severityRank[b.urgency] !== severityRank[a.urgency]) {
          return severityRank[b.urgency] - severityRank[a.urgency];
        }
        return b.suggestedReorderQty - a.suggestedReorderQty;
      })
      .slice(0, 12);

    const salesTrend = dailySeries.map((day) => ({
      ...day,
      sales: money(day.sales),
      grossProfit: money(day.grossProfit),
      unitsSold: number(day.unitsSold),
      averageOrderValue: day.orders ? money(day.sales / day.orders) : 0,
      paidOrderConversionRate: ratio(day.orders, day.attemptedOrders)
    }));

    const staffPerformanceList = Array.from(staffPerformance.values())
      .map((staff) => ({
        ...staff,
        sales: money(staff.sales),
        unitsSold: number(staff.unitsSold),
        averageOrderValue: staff.orders ? money(staff.sales / staff.orders) : 0,
        conversionRate: ratio(staff.orders, staff.attemptedOrders)
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
        days,
        leadTimeDays
      },
      summary: {
        grossSales: money(grossSales),
        netSalesBeforeTax: money(grossSales - taxTotal),
        estimatedGrossProfit: money(grossSales - taxTotal - estimatedCost),
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
        stockOnHandUnits: number(stockOnHandUnits),
        stockoutRate,
        lowStockRate,
        aggregateSellThroughRate,
        pendingEtimsCount,
        failedEtimsCount
      },
      conversion: {
        attemptedOrders: orders.length,
        paidOrders: paidOrders.length,
        paidOrderConversionRate: ratio(paidOrders.length, orders.length),
        voidRate: ratio(voidedOrders.length, orders.length),
        capturedCustomerOrders,
        customerCaptureRate: ratio(capturedCustomerOrders, paidOrders.length),
        uniqueCustomers: customerOrderCounts.size,
        repeatCustomers,
        repeatCustomerRate: ratio(repeatCustomers, customerOrderCounts.size),
        newCustomers: newCustomers.length,
        walkInOrderCount: paidOrders.length - capturedCustomerOrders,
        customerSales: money(customerSales),
        walkInSales: money(grossSales - customerSales),
        creditCustomerCount: creditCustomers.length,
        creditOutstanding: money(creditOutstanding)
      },
      salesTrend,
      paymentMix,
      paymentMixChart,
      bestSellers,
      categorySales: categorySalesList,
      staffPerformance: staffPerformanceList,
      stockRecommendations,
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
        'Estimated gross profit uses the cost price snapshot stored on each order item.',
        'Sell-through rate is estimated from period units sold divided by period units sold plus current on-hand stock.',
        'Conversion rates use POS events already captured by the app: attempted orders, paid orders, customer-linked orders, and repeat customers.'
      ]
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * GET /api/reports/export?days=7&format=csv
 * Downloads a CSV of completed and partially refunded orders in the period,
 * including original, refunded, and net totals.
 */
async function exportCsv(req, res) {
  try {
    const { start, end, days } = parseAnalyticsRange(req.query);

    const orders = await Order.findAll({
      where: tenantWhere(req, {
        status: { [Op.in]: ['completed', 'partial_refund'] },
        createdAt: { [Op.gte]: start, [Op.lte]: end }
      }),
      include: [
        { model: OrderItem, include: [{ model: Product }] },
        { model: Payment },
        { model: User, as: 'cashier', attributes: ['name'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    const csvEscape = (value) => {
      const str = String(value ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const rows = [
      // header
      ['date', 'receipt_number', 'cashier', 'items', 'subtotal', 'vat', 'discount', 'gross_total', 'refunded_total', 'net_total', 'payment_methods'].join(',')
    ];

    for (const order of orders) {
      const itemDesc = (order.OrderItems || [])
        .map((i) => `${i.Product?.name || 'Unknown'} x${Number(i.quantity)}`)
        .join(' | ');
      const methods = (order.Payments || [])
        .filter((p) => p.status === 'confirmed')
        .map((p) => p.method)
        .join('+');

      rows.push([
        csvEscape(order.createdAt.toISOString()),
        csvEscape(order.orderNumber),
        csvEscape(order.cashier?.name || ''),
        csvEscape(itemDesc),
        csvEscape(Number(order.subtotal).toFixed(2)),
        csvEscape(Number(order.taxTotal).toFixed(2)),
        csvEscape(Number(order.discountTotal).toFixed(2)),
        csvEscape(Number(order.total).toFixed(2)),
        csvEscape(Number(order.refundedTotal || 0).toFixed(2)),
        csvEscape(Math.max(Number(order.total) - Number(order.refundedTotal || 0), 0).toFixed(2)),
        csvEscape(methods)
      ].join(','));
    }

    const filename = `pos_export_${days}d_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + rows.join('\r\n')); // UTF-8 BOM for Excel compatibility
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

/**
 * GET /api/reports/vat-products
 * Lists product VAT classifications so managers can review tax setup.
 */
async function vatProducts(req, res) {
  try {
    const products = await Product.findAll({
      where: tenantWhere(req, { isActive: true }),
      include: [{ model: Category, attributes: ['id', 'name', 'taxCategory'] }],
      order: [['name', 'ASC']]
    });

    const summary = {
      standard: { count: 0, stockValue: 0 },
      zero_rated: { count: 0, stockValue: 0 },
      exempt: { count: 0, stockValue: 0 }
    };

    const rows = products.map((product) => {
      const category = product.taxCategory || product.Category?.taxCategory || 'standard';
      const stockValue = Number(product.sellingPrice || 0) * Number(product.stockQuantity || 0);
      const bucket = summary[category] || summary.standard;
      bucket.count += 1;
      bucket.stockValue += stockValue;

      return {
        id: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        category: product.Category?.name || 'Uncategorized',
        productTaxCategory: product.taxCategory,
        categoryTaxCategory: product.Category?.taxCategory || null,
        taxCategory: category,
        unit: product.unit,
        sellingPrice: Number(product.sellingPrice),
        stockQuantity: Number(product.stockQuantity),
        stockValue: money(stockValue),
        needsReview: Boolean(product.Category?.taxCategory && product.taxCategory !== product.Category.taxCategory)
      };
    });

    res.json({
      summary: Object.fromEntries(
        Object.entries(summary).map(([key, value]) => [key, {
          count: value.count,
          stockValue: money(value.stockValue)
        }])
      ),
      totalProducts: rows.length,
      reviewCount: rows.filter((row) => row.needsReview).length,
      products: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/reports/reorder-suggestions?days=30&leadTimeDays=7
 * Analyzes item sales velocity over past N days to recommend PO reorder quantities.
 */
async function reorderSuggestions(req, res) {
  try {
    const days = Math.max(Number(req.query.days || 30), 1);
    const leadTimeDays = Math.max(Number(req.query.leadTimeDays || 7), 1);
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const products = await Product.findAll({
      where: tenantWhere(req, { isActive: true }),
      include: [{ model: Category, attributes: ['name'] }]
    });

    // Aggregate total quantities sold per product in period
    const sales = await OrderItem.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.literal('quantity - COALESCE("refundedQuantity", 0)')), 'totalSold']
      ],
      include: [{
        model: Order,
        attributes: [],
        where: tenantWhere(req, {
          status: { [Op.in]: ['completed', 'partial_refund'] },
          createdAt: { [Op.gte]: start }
        })
      }],
      group: ['productId'],
      raw: true
    });

    const salesMap = new Map(sales.map((s) => [s.productId, Number(s.totalSold || 0)]));

    const suggestions = products.map((p) => {
      const totalSold = salesMap.get(p.id) || 0;
      const dailyVelocity = totalSold / days;
      const leadTimeDemand = dailyVelocity * leadTimeDays;
      const currentStock = Number(p.stockQuantity);
      const reorderLevel = Number(p.reorderLevel);

      // Reorder needed if current stock falls below (Lead Time Demand + Reorder Level)
      const targetStock = Math.ceil(leadTimeDemand + reorderLevel);
      const suggestedReorderQty = Math.max(targetStock - currentStock, 0);

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.Category?.name || 'Uncategorized',
        currentStock,
        reorderLevel,
        costPrice: Number(p.costPrice),
        unit: p.unit,
        totalSoldInPeriod: Number(totalSold.toFixed(2)),
        dailyVelocity: Number(dailyVelocity.toFixed(2)),
        suggestedReorderQty: Math.ceil(suggestedReorderQty),
        needsReorder: currentStock <= reorderLevel || suggestedReorderQty > 0
      };
    }).filter((s) => s.needsReorder).sort((a, b) => b.suggestedReorderQty - a.suggestedReorderQty);

    return res.json({ days, leadTimeDays, suggestions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { analytics, exportCsv, reorderSuggestions, today, vatProducts, invalidateTenantCache };
