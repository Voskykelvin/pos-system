const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockCountController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate, requireRoles('admin', 'manager'));
router.get('/', controller.list);
router.post('/', validate({
  productIds: { type: 'array', nonEmpty: true },
  branchId: { type: 'string', required: false, minLength: 1 },
  note: { type: 'string', required: false, maxLength: 500 }
}), controller.create);
router.put('/:id/items', validate({
  items: {
    type: 'array', nonEmpty: true,
    items: {
      productId: { type: 'string', minLength: 1 },
      inventoryLotId: { type: 'string', required: false, minLength: 1 },
      countedQuantity: { type: 'number', min: 0 }
    }
  }
}), controller.record);
router.post('/:id/complete', controller.complete);

module.exports = router;
