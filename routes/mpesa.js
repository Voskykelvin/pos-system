const express = require('express');
const router = express.Router();
const { initiate, callback } = require('../controllers/mpesaController');
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

module.exports = router;
