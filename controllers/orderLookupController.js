const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  Product,
  Payment,
  Customer,
  User,
  EtimsInvoice,
  Branch
} = require('../models');
const { tenantWhere } = require('../utils/tenantScope');
const { resolveTenantConfig } = require('../utils/tenantConfig');

function productItemCode(product) {
  if (!product) return null;
  const metadata = product.metadata && typeof product.metadata === 'object' ? product.metadata : {};
  return metadata.kraItemCode || metadata.itemCode || product.barcode || product.sku || null;
}

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
        { model: EtimsInvoice },
        { model: Branch, attributes: ['id', 'name', 'code', 'phone', 'address', 'city'] }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const runtimeConfig = await resolveTenantConfig(order.tenantId || req.tenantId);
    const metadata = order.metadata || {};
    const paymentTotal = order.Payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const changeDue = Number(metadata.changeDue || 0);
    const amountTendered = Number(metadata.amountTendered || paymentTotal + changeDue);
    const itemCount = order.OrderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const etimsInvoice = order.EtimsInvoice;
    const fiscalReady = Boolean(etimsInvoice?.cuInvoiceNumber && etimsInvoice?.qrCodeUrl);

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
        barcode: item.Product?.barcode || null,
        itemCode: productItemCode(item.Product),
        unit: item.Product?.unit || null,
        taxCategory: item.Product?.taxCategory || null,
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
      itemCount,
      tender: {
        amountTendered,
        changeDue
      },
      etims: etimsInvoice ? {
        status: etimsInvoice.status,
        cuInvoiceNumber: etimsInvoice.cuInvoiceNumber,
        qrCodeUrl: etimsInvoice.qrCodeUrl,
        transmittedAt: etimsInvoice.transmittedAt,
        retryCount: Number(etimsInvoice.retryCount || 0),
        deviceSerial: runtimeConfig.etims.deviceSerial || null,
        fiscalReady
      } : {
        status: 'not_created',
        cuInvoiceNumber: null,
        qrCodeUrl: null,
        transmittedAt: null,
        retryCount: 0,
        deviceSerial: runtimeConfig.etims.deviceSerial || null,
        fiscalReady: false
      },
      branch: order.Branch ? {
        id: order.Branch.id,
        name: order.Branch.name,
        code: order.Branch.code,
        phone: order.Branch.phone,
        address: order.Branch.address,
        city: order.Branch.city
      } : null,
      business: {
        name: runtimeConfig.business.name,
        kraPin: runtimeConfig.business.kraPin || null,
        receiptPolicy: runtimeConfig.business.receiptPolicy || '',
        receiptFooter: runtimeConfig.business.receiptFooter || ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { receipt, searchOrders };
