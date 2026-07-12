const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planEnforcement');
const { validate, schemas } = require('../middleware/validate');
const { create, list, receive, listReturns, createReturn, confirmSupplierCredit } = require('../controllers/purchaseOrderController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager', 'cashier'), requirePlanFeature('purchasing'), list);
router.post('/', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), validate(schemas.createPurchaseOrder), create);
router.post('/:id/receive', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), validate(schemas.receivePurchaseOrder), receive);
router.get('/returns/history', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), listReturns);
router.post('/:id/returns', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), validate({
  reason: { type: 'string', minLength: 5, maxLength: 500 },
  items: {
    type: 'array', nonEmpty: true,
    items: {
      itemId: { type: 'string', minLength: 1 },
      quantity: { type: 'number', min: 0.001 },
      inventoryLotId: { type: 'string', required: false, minLength: 1 }
    }
  }
}), createReturn);
router.post('/returns/:id/confirm-credit', requireRoles('admin', 'manager'), requirePlanFeature('purchasing'), validate({
  reference: { type: 'string', minLength: 3, maxLength: 100 },
  note: { type: 'string', required: false, maxLength: 500 }
}), confirmSupplierCredit);

module.exports = router;
