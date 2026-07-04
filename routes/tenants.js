const express = require('express');
const router = express.Router();
const { signup, superAdminDashboard, updateTenant } = require('../controllers/tenantController');
const { authenticate, requireRoles } = require('../middleware/auth');

// Public self-serve store onboarding signup
router.post('/signup', signup);

// SaaS Owner Super-Admin Portal routes
router.get('/super-admin/dashboard', authenticate, requireRoles('super_admin'), superAdminDashboard);
router.put('/super-admin/tenants/:id', authenticate, requireRoles('super_admin'), updateTenant);

module.exports = router;
