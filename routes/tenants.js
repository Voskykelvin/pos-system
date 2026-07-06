const express = require('express');
const router = express.Router();
const { plans, signup, superAdminDashboard, updateTenant, deleteTenant } = require('../controllers/tenantController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Public pricing tiers used by the master frontend and signup flow
router.get('/plans', plans);

// Public self-serve store onboarding signup
router.post('/signup', validate(schemas.signup), signup);

// SaaS Owner Super-Admin Portal routes
router.get('/super-admin/dashboard', authenticate, requireRoles('super_admin'), superAdminDashboard);
router.put('/super-admin/tenants/:id', authenticate, requireRoles('super_admin'), validate(schemas.updateTenant), updateTenant);
router.delete('/super-admin/tenants/:id', authenticate, requireRoles('super_admin'), deleteTenant);

module.exports = router;
