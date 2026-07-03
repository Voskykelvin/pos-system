const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { create, getOne, loyaltyBalance, search } = require('../controllers/customerController');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);

// GET /api/customers/search?q=phone_or_name
router.get('/search', requireRoles('admin', 'manager', 'cashier'), search);

// GET /api/customers/:id
router.get('/:id', requireRoles('admin', 'manager', 'cashier'), getOne);

// GET /api/customers/:id/loyalty
router.get('/:id/loyalty', requireRoles('admin', 'manager', 'cashier'), loyaltyBalance);

// POST /api/customers  — cashier creates customer at checkout
router.post('/', requireRoles('admin', 'manager', 'cashier'), validate(schemas.createCustomer), create);

module.exports = router;
