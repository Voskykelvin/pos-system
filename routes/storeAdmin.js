const express = require('express');
const router = express.Router();
const {
  createBranch,
  createStaff,
  loadSetup,
  updateBranch,
  updateSettings,
  updateStaff
} = require('../controllers/storeAdminController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/setup', requireRoles('admin', 'manager'), loadSetup);

router.post('/branches', requireRoles('admin'), createBranch);
router.put('/branches/:id', requireRoles('admin'), updateBranch);

router.post('/staff', requireRoles('admin'), createStaff);
router.put('/staff/:id', requireRoles('admin'), updateStaff);

router.put('/settings', requireRoles('admin'), updateSettings);

module.exports = router;
