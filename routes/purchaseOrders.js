const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { create, list, receive } = require('../controllers/purchaseOrderController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager', 'cashier'), list);
router.post('/', requireRoles('admin', 'manager'), create);
router.post('/:id/receive', requireRoles('admin', 'manager'), receive);

module.exports = router;
