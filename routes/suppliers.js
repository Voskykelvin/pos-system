const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { create, list, update } = require('../controllers/supplierController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager', 'cashier'), list);
router.post('/', requireRoles('admin', 'manager'), create);
router.put('/:id', requireRoles('admin', 'manager'), update);

module.exports = router;
