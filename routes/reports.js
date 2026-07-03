const express = require('express');
const router = express.Router();
const { today } = require('../controllers/reportController');

router.get('/today', today);

module.exports = router;
