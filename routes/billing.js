const express = require('express');
const router = express.Router();
const {
  confirmSubscriptionPayment,
  getBilling,
  rejectSubscriptionPayment,
  submitPayment
} = require('../controllers/billingController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.get('/', authenticate, getBilling);
router.post('/payments', authenticate, submitPayment);

router.post('/payments/:id/confirm', authenticate, requireRoles('super_admin'), confirmSubscriptionPayment);
router.post('/payments/:id/reject', authenticate, requireRoles('super_admin'), rejectSubscriptionPayment);

module.exports = router;
