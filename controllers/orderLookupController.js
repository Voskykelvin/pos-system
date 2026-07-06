const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  Product,
  Payment,
  Customer,
  User,
  EtimsInvoice
} = require('../models');
const { tenantWhere } = require('../utils/tenantScope');

function mapPayment(payment) {
  return {
    id: payment.id,
    method: payment.method,
    amount: Number(payment.amount),
    status: payment.status,
    mpesaReceiptNumber: payment.mpesaReceiptNumber,
    mpesaPhone: payment.mpesaPhone
  };
}

async function searchOrders(req, res) {
  const q = (req.query.q || '').trim();
  const where = {};

  if (q) {
    where.orderNumber = { [Op.iLike]: `%${q}%` };
  }

  try {
    const orders = await Order.findAll({
      where: tenantWhere(req, where),
      include: [
        { model: Payment },
        { model: User, as: 'cashier', attributes: ['id', 'name', 'role'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 30
    });

    res.json(orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      status: order.status,
      paymentStatus: order.paymentStatus,
      cashier: order.cashier?.name || null,
      createdAt: order.createdAt,
      payments: order.Payments.map(mapPayment)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function receipt(req, res) {
  try {
    const order = await Order.findOne({
      where: tenantWhere(req, { id: req.params.id }),
      include: [
        {
          model: OrderItem,
          include: [{ model: Product }]
        },
        { model: Payment },
        { model: Customer },
        { model: User, as: 'cashier', attributes: ['id', 'name', 'role'] },
        { model: EtimsInvoice }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const metadata = order.metadata || {};
    const paymentTotal = order.Payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const changeDue = Number(metadata.changeDue || 0);
    const amountTendered = Number(metadata.amountTendered || paymentTotal + changeDue);

    res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      cashier: order.cashier ? {
        id: order.cashier.id,
        name: order.cashier.name,
        role: order.cashier.role
      } : null,
      customer: order.Customer ? {
        id: order.Customer.id,
        name: order.Customer.name,
        phone: order.Customer.phone,
        kraPin: order.Customer.kraPin
      } : null,
      items: order.OrderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.Product?.name || 'Unknown product',
        sku: item.Product?.sku || null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        lineTotal: Number(item.lineTotal)
      })),
      payments: order.Payments.map(mapPayment),
      subtotal: Number(order.subtotal),
      taxTotal: Number(order.taxTotal),
      discountTotal: Number(order.discountTotal),
      total: Number(order.total),
      tender: {
        amountTendered,
        changeDue
      },
      etims: order.EtimsInvoice ? {
        status: order.EtimsInvoice.status,
        cuInvoiceNumber: order.EtimsInvoice.cuInvoiceNumber,
        qrCodeUrl: order.EtimsInvoice.qrCodeUrl,
        transmittedAt: order.EtimsInvoice.transmittedAt
      } : null,
      business: {
        name: process.env.BUSINESS_NAME || 'Jijenge POS',
        kraPin: process.env.BUSINESS_KRA_PIN || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { receipt, searchOrders };
