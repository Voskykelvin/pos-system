const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockTransferController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate, requireRoles('admin', 'manager'));
router.get('/', controller.list);
router.get('/branches/:branchId/balances', controller.balances);
router.post('/', validate({
  sourceBranchId: { type: 'string', minLength: 1 },
  destinationBranchId: { type: 'string', minLength: 1 },
  note: { type: 'string', required: false, maxLength: 500 },
  items: {
    type: 'array', nonEmpty: true,
    items: {
      productId: { type: 'string', minLength: 1 },
      inventoryLotId: { type: 'string', required: false, minLength: 1 },
      quantity: { type: 'number', min: 0.001 }
    }
  }
}), controller.create);

module.exports = router;
