const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const {
  list, create, update, deactivate, adjustStock, lowStock
} = require('../controllers/productAdminController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager'), list);
router.get('/low-stock', requireRoles('admin', 'manager'), lowStock);
router.post('/', requireRoles('admin', 'manager'), create);
router.put('/:id', requireRoles('admin', 'manager'), update);
router.delete('/:id', requireRoles('admin', 'manager'), deactivate);
router.post('/:id/adjust-stock', requireRoles('admin', 'manager', 'cashier'), adjustStock);

module.exports = router;
