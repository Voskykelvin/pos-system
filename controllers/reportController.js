const { Op } = require('sequelize');
const {
  Product,
  Category,
  Order,
  Payment,
  EtimsInvoice
} = require('../models');
const { getBusinessDayRange } = require('../utils/businessTime');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
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

module.exports = { today };
