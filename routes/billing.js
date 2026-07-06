const express = require('express');
const router = express.Router();
const {
  confirmSubscriptionPayment,
  getBilling,
  rejectSubscriptionPayment,
  submitPayment
} = require('../controllers/billingController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.get('/', authenticate, getBilling);
router.post('/payments', authenticate, validate(schemas.submitPayment), submitPayment);

router.post('/payments/:id/confirm', authenticate, requireRoles('super_admin'), confirmSubscriptionPayment);
router.post('/payments/:id/reject', authenticate, requireRoles('super_admin'), rejectSubscriptionPayment);

module.exports = router;
