const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { create, list, update, validate: validateCode } = require('../controllers/promotionController');

// GET /api/promotions/validate?code=SAVE10&orderTotal=5000
// Cashier-accessible — used by the Checkout UI to validate a promo code
router.get('/validate', authenticate, requireRoles('admin', 'manager', 'cashier'), validateCode);

// Admin / manager CRUD
router.get('/', authenticate, requireRoles('admin', 'manager'), list);
router.post('/', authenticate, requireRoles('admin', 'manager'), create);
router.put('/:id', authenticate, requireRoles('admin', 'manager'), update);

module.exports = router;
