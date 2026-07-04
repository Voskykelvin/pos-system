const express = require('express');
const router = express.Router();
const { checkout } = require('../controllers/checkoutController');
const { voidOrder } = require('../controllers/voidController');
const { refundOrder } = require('../controllers/refundController');
const { partialRefund } = require('../controllers/partialRefundController');
const { searchOrders, receipt } = require('../controllers/orderLookupController');
const { Order, Payment } = require('../models');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { idempotency } = require('../middleware/idempotency');
const { tenantWhere } = require('../utils/tenantScope');

const cashierAndAbove = requireRoles('admin', 'manager', 'cashier');

// POST /api/orders/checkout
// Idempotency key prevents double-charging on network retries.
router.post(
  '/checkout',
  authenticate,
  cashierAndAbove,
  idempotency(),
  validate(schemas.checkout),
  checkout
);

router.get('/search', authenticate, cashierAndAbove, searchOrders);

// POST /api/orders/:id/void
router.post(
  '/:id/void',
  authenticate,
  cashierAndAbove,
  validate(schemas.voidOrder),
  voidOrder
);

router.post(
  '/:id/refund',
  authenticate,
  cashierAndAbove,
  validate(schemas.refundOrder),
  refundOrder
);

router.post(
  '/:id/refund/partial',
  authenticate,
  cashierAndAbove,
  validate(schemas.partialRefund),
  partialRefund
);

router.get('/:id/receipt', authenticate, cashierAndAbove, receipt);

// GET /api/orders/:id/status - used by the checkout screen to poll while
// waiting on an M-Pesa callback
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const order = await Order.findOne({
      where: tenantWhere(req, { id: req.params.id }),
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
