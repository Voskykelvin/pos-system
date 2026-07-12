const express = require('express');
const router = express.Router();
const { initiate, callback, callbackExceptions, resolveCallbackException, simulateCallback } = require('../controllers/mpesaController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { idempotency } = require('../middleware/idempotency');
const { validate, schemas } = require('../middleware/validate');

// POST /api/mpesa/stk-push  - triggers the prompt on the customer's phone
router.post(
  '/stk-push',
  authenticate,
  requireRoles('admin', 'manager', 'cashier'),
  idempotency(),
  validate(schemas.mpesaStkPush),
  initiate
);

// POST /api/mpesa/callback  - Safaricom calls this with the result, must be public HTTPS
router.post('/callback', callback);
router.get('/callback-events', authenticate, requireRoles('admin', 'manager'), callbackExceptions);
router.post(
  '/simulate-callback',
  authenticate,
  requireRoles('admin', 'manager'),
  validate({
    paymentId: { type: 'string', minLength: 1, maxLength: 100 },
    scenario: { type: 'string', required: false, enumValues: ['success', 'cancelled', 'timeout', 'amount_mismatch'] },
    receiptNumber: { type: 'string', required: false, minLength: 8, maxLength: 30 }
  }),
  simulateCallback
);
router.post(
  '/callback-events/:id/resolve',
  authenticate,
  requireRoles('admin', 'manager'),
  validate({
    action: { type: 'string', enumValues: ['confirm', 'dismiss'] },
    note: { type: 'string', minLength: 5, maxLength: 500 },
    receiptNumber: { type: 'string', required: false, minLength: 8, maxLength: 30 }
  }),
  (req, res, next) => {
    if (req.body.action === 'confirm' && !req.body.receiptNumber) {
      return res.status(400).json({ error: 'receiptNumber is required when confirming from a statement' });
    }
    return next();
  },
  resolveCallbackException
);

module.exports = router;
