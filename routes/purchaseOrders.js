const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planEnforcement');
const { validate, schemas } = require('../middleware/validate');
const { create, list, receive } = require('../controllers/purchaseOrderController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager', 'cashier'), requirePlanFeature('purchasing'), list);
router.post('/', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), validate(schemas.createPurchaseOrder), create);
router.post('/:id/receive', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), validate(schemas.receivePurchaseOrder), receive);

module.exports = router;
