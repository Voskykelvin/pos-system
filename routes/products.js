const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { list, search } = require('../controllers/productController');

router.use(authenticate);

router.get('/', list);
router.get('/search', search);

module.exports = router;
