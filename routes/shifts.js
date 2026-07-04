const express = require('express');
const router = express.Router();
const { closeShift, current, list, openShift, summary, addExpense } = require('../controllers/shiftController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);

router.get('/current', requireRoles('admin', 'manager', 'cashier'), current);
router.get('/summary', requireRoles('admin', 'manager'), summary);
router.get('/', requireRoles('admin', 'manager'), list);
router.post('/open', requireRoles('admin', 'manager', 'cashier'), validate(schemas.openShift), openShift);
router.post('/:id/close', requireRoles('admin', 'manager', 'cashier'), validate(schemas.closeShift), closeShift);
router.post('/expenses', requireRoles('admin', 'manager', 'cashier'), addExpense);

module.exports = router;
