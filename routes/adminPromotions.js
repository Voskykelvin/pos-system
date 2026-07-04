const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { create, list, update } = require('../controllers/promotionController');

router.use(authenticate, requireRoles('admin', 'manager'));

router.get('/', list);
router.post('/', validate(schemas.createPromotion), create);
router.put('/:id', validate(schemas.updatePromotion), update);

module.exports = router;
