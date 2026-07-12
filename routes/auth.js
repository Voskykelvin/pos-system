const express = require('express');
const router = express.Router();
const { login, logout, logoutAll, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.post('/login', validate(schemas.login), login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);

module.exports = router;
