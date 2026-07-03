const express = require('express');
const router = express.Router();
const { analytics, today } = require('../controllers/reportController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.get('/today', authenticate, requireRoles('admin', 'manager'), today);
router.get('/analytics', authenticate, requireRoles('admin', 'manager'), analytics);

module.exports = router;
