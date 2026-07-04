const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planEnforcement');
const { create, list, update } = require('../controllers/supplierController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager', 'cashier'), requirePlanFeature('purchasing'), list);
router.post('/', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), create);
router.put('/:id', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), update);

module.exports = router;
