const express = require('express');
const router = express.Router();
const { initiate, callback } = require('../controllers/mpesaController');

// POST /api/mpesa/stk-push  - triggers the prompt on the customer's phone
router.post('/stk-push', initiate);

// POST /api/mpesa/callback  - Safaricom calls this with the result, must be public HTTPS
router.post('/callback', callback);

module.exports = router;
