const express = require('express');
const router = express.Router();
const { login, logout, logoutAll, me, refresh, sessions, revokeSessionById, setupMfa, enableMfa, disableMfa } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.post('/login', validate(schemas.login), login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/sessions', authenticate, sessions);
router.delete('/sessions/:id', authenticate, revokeSessionById);
router.post('/mfa/setup', authenticate, validate({ password: { type: 'string', minLength: 1, maxLength: 1024 } }), setupMfa);
router.post('/mfa/enable', authenticate, validate({ code: { type: 'string', minLength: 6, maxLength: 6 } }), enableMfa);
router.post('/mfa/disable', authenticate, validate({
  password: { type: 'string', minLength: 1, maxLength: 1024 },
  code: { type: 'string', required: false, minLength: 6, maxLength: 6 }
}), disableMfa);

module.exports = router;
