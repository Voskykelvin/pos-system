const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate: validateCode } = require('../controllers/promotionController');

// GET /api/promotions/validate?code=SAVE10&orderTotal=5000
// Cashier-accessible endpoint used by the Checkout UI to validate a promo code.
router.get('/validate', authenticate, requireRoles('admin', 'manager', 'cashier'), validateCode);

module.exports = router;
