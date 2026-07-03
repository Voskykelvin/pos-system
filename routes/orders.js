const express = require('express');
const router = express.Router();
const { checkout } = require('../controllers/checkoutController');
const { voidOrder } = require('../controllers/voidController');
const { refundOrder } = require('../controllers/refundController');
const { searchOrders, receipt } = require('../controllers/orderLookupController');
const { Order, Payment } = require('../models');
const { authenticate, requireRoles } = require('../middleware/auth');

// POST /api/orders/checkout
router.post('/checkout', authenticate, requireRoles('admin', 'manager', 'cashier'), checkout);

router.get('/search', authenticate, requireRoles('admin', 'manager', 'cashier'), searchOrders);

// POST /api/orders/:id/void
router.post('/:id/void', authenticate, requireRoles('admin', 'manager', 'cashier'), voidOrder);

router.post('/:id/refund', authenticate, requireRoles('admin', 'manager', 'cashier'), refundOrder);

router.get('/:id/receipt', authenticate, requireRoles('admin', 'manager', 'cashier'), receipt);

// GET /api/orders/:id/status - used by the checkout screen to poll while
// waiting on an M-Pesa callback
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: Payment }]
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      payments: order.Payments.map((p) => ({
        method: p.method,
        status: p.status,
        amount: p.amount
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
