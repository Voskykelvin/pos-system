const express = require('express');
const router = express.Router();
const { closeShift, current, list, openShift } = require('../controllers/shiftController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/current', requireRoles('admin', 'manager', 'cashier'), current);
router.get('/', requireRoles('admin', 'manager'), list);
router.post('/open', requireRoles('admin', 'manager', 'cashier'), openShift);
router.post('/:id/close', requireRoles('admin', 'manager', 'cashier'), closeShift);

module.exports = router;
