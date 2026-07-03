const express = require('express');
const router = express.Router();
const { list } = require('../controllers/auditLogController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);
router.get('/', requireRoles('admin', 'manager'), list);

module.exports = router;
