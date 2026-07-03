const express = require('express');
const router = express.Router();
const { list, create } = require('../controllers/categoryController');

router.get('/', list);
router.post('/', create);

module.exports = router;
