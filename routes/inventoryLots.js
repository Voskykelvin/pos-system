const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventoryLotController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate, requireRoles('admin', 'manager'));
router.get('/', controller.list);
router.post('/', validate({
  productId: { type: 'string', minLength: 1 },
  branchId: { type: 'string', required: false, minLength: 1 },
  lotNumber: { type: 'string', minLength: 1, maxLength: 100 },
  expiryDate: { type: 'string', required: false, maxLength: 10 },
  quantity: { type: 'number', min: 0.001 },
  unitCost: { type: 'number', required: false, min: 0 }
}), controller.receive);
router.post('/:id/write-off', validate({
  quantity: { type: 'number', min: 0.001 },
  note: { type: 'string', required: false, maxLength: 500 }
}), controller.writeOff);

module.exports = router;
