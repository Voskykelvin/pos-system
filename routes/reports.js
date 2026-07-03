const express = require('express');
const router = express.Router();
const { analytics, today, exportCsv } = require('../controllers/reportController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.get('/today', authenticate, requireRoles('admin', 'manager'), today);
router.get('/analytics', authenticate, requireRoles('admin', 'manager'), analytics);
router.get('/export', authenticate, requireRoles('admin', 'manager'), exportCsv);

module.exports = router;
