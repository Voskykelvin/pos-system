const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { create, getOne, loyaltyBalance, search, ledger, payDebt } = require('../controllers/customerController');
const { validate, schemas } = require('../middleware/validate');
const { requirePlanFeature } = require('../middleware/planEnforcement');

router.use(authenticate);

// GET /api/customers/search?q=phone_or_name
router.get('/search', requireRoles('admin', 'manager', 'cashier'), search);

// GET /api/customers/:id
router.get('/:id', requireRoles('admin', 'manager', 'cashier'), getOne);

// GET /api/customers/:id/loyalty
router.get('/:id/loyalty', requireRoles('admin', 'manager', 'cashier'), requirePlanFeature('loyalty'), loyaltyBalance);

// POST /api/customers  - cashier creates customer at checkout
router.post('/', requireRoles('admin', 'manager', 'cashier'), validate(schemas.createCustomer), create);

// GET /api/customers/:id/ledger
router.get('/:id/ledger', requireRoles('admin', 'manager'), requirePlanFeature('customer_credit'), ledger);

// POST /api/customers/:id/payment
router.post('/:id/payment', requireRoles('admin', 'manager'), requirePlanFeature('customer_credit'), validate(schemas.customerPayment), payDebt);

module.exports = router;
