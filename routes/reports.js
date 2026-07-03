const express = require('express');
const router = express.Router();
const { analytics, today } = require('../controllers/reportController');

router.get('/today', today);
router.get('/analytics', analytics);

module.exports = router;
