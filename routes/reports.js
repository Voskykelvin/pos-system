const express = require('express');
const router = express.Router();
const { analytics, today, exportCsv, reorderSuggestions } = require('../controllers/reportController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planEnforcement');

router.get('/today', authenticate, requireRoles('admin', 'manager'), today);
router.get('/analytics', authenticate, requireRoles('admin', 'manager'), requirePlanFeature('advanced_analytics'), analytics);
router.get('/export', authenticate, requireRoles('admin', 'manager'), exportCsv);
router.get('/reorder-suggestions', authenticate, requireRoles('admin', 'manager'), requirePlanFeature('reorder_suggestions'), reorderSuggestions);

module.exports = router;
