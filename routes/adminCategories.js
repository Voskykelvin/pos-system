const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { list, create } = require('../controllers/categoryController');

router.use(authenticate, requireRoles('admin', 'manager'));

router.get('/', list);
router.post('/', create);

module.exports = router;
