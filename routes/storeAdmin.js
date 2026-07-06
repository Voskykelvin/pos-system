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
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);

router.get('/setup', requireRoles('admin', 'manager'), loadSetup);

router.post('/branches', requireRoles('admin'), validate(schemas.createBranch), createBranch);
router.put('/branches/:id', requireRoles('admin'), validate(schemas.updateBranch), updateBranch);

router.post('/staff', requireRoles('admin'), validate(schemas.createStaff), createStaff);
router.put('/staff/:id', requireRoles('admin'), validate(schemas.updateStaff), updateStaff);

router.put('/settings', requireRoles('admin'), updateSettings);

module.exports = router;
