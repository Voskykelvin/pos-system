const { Op } = require('sequelize');
const { User, Tenant, AuthSession } = require('../models');
const { verifyPassword } = require('../utils/passwords');
const { getPlan } = require('../utils/planCatalog');
const { isExpired, resolveBillingStatus } = require('../services/subscriptionBilling');
const { logAudit } = require('../services/auditLogger');
const logger = require('../utils/logger');
const { issueAuthSession, rotateRefreshToken, revokeAllUserSessions, revokeSession } = require('../services/authSessions');
const { decryptSecret, encryptSecret, generateSecret, verifyCode } = require('../utils/totp');

function setRefreshCookie(res, value, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `pos_refresh_token=${encodeURIComponent(value)}; Path=/api/auth; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${secure}`);
}

function clearRefreshCookie(res) {
  res.setHeader('Set-Cookie', `pos_refresh_token=; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function readRefreshCookie(req) {
  const match = String(req.get('cookie') || '').match(/(?:^|;\s*)pos_refresh_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    tenantId: user.tenantId || null,
    branchId: user.branchId || null,
    mfaEnabled: Boolean(user.mfaEnabled)
  };
}

async function login(req, res) {
  const { identifier, password, mfaCode } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  try {
    const trimmed = identifier.trim();
    const user = await User.findOne({
      where: {
        isActive: true,
        [Op.or]: [{ email: { [Op.iLike]: trimmed } }, { phone: trimmed }]
      },
      include: [{
        model: Tenant,
        attributes: ['id', 'name', 'plan', 'status', 'currency', 'country', 'subscriptionStartedAt', 'subscriptionEndsAt']
      }]
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      logAudit({
        req,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: null,
        metadata: { identifier: trimmed }
      }).catch(() => {});
      
      logger.warn('Audit Payload: Login failed', {
        requestId: req.id,
        identifier: trimmed,
        reason: 'invalid_credentials'
      });

      return res.status(401).json({ error: 'Invalid login details' });
    }
    if (user.mfaEnabled) {
      if (!mfaCode) return res.status(401).json({ error: 'Authenticator code required', mfaRequired: true });
      if (!verifyCode(decryptSecret(user.mfaSecretEncrypted), mfaCode)) {
        logger.warn('Audit Payload: MFA verification failed', { requestId: req.id, userId: user.id });
        return res.status(401).json({ error: 'Invalid authenticator code', mfaRequired: true });
      }
    }
    if (user.Tenant?.status === 'active' && isExpired(user.Tenant)) {
      await user.Tenant.update({ status: 'past_due' });
      user.Tenant.status = 'past_due';
    }

    const tenantPlan = user.Tenant?.plan ? getPlan(user.Tenant.plan) : null;
    const billingStatus = resolveBillingStatus(user.Tenant);

    logAudit({
      req,
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: { role: user.role, tenantId: user.tenantId || null }
    }).catch(() => {});

    logger.info('Audit Payload: Login successful', {
      requestId: req.id,
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId || null
    });

    const session = await issueAuthSession(user, req);
    setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
    return res.json({
      token: session.accessToken,
      user: publicUser(user),
      tenant: user.Tenant ? {
        id: user.Tenant.id,
        name: user.Tenant.name,
        plan: user.Tenant.plan,
        status: billingStatus,
        currency: user.Tenant.currency,
        country: user.Tenant.country,
        subscriptionStartedAt: user.Tenant.subscriptionStartedAt,
        subscriptionEndsAt: user.Tenant.subscriptionEndsAt,
        enabledFeatures: tenantPlan?.enabledFeatures || []
      } : null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function me(req, res) {
  return res.json({ user: req.user });
}

async function logout(req, res) {
  await revokeSession(req.authTokenPayload);
  clearRefreshCookie(res);
  return res.status(204).end();
}

async function refresh(req, res) {
  const session = await rotateRefreshToken(readRefreshCookie(req));
  if (!session) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Refresh session expired or revoked' });
  }
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  return res.json({ token: session.accessToken });
}

async function logoutAll(req, res) {
  const revokedSessions = await revokeAllUserSessions(req.user.id);
  clearRefreshCookie(res);
  return res.json({ revokedSessions });
}

async function sessions(req, res) {
  const rows = await AuthSession.findAll({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    attributes: ['id', 'userAgent', 'ipAddress', 'lastSeenAt', 'expiresAt', 'createdAt'],
    order: [['createdAt', 'DESC']]
  });
  return res.json(rows.map((session) => ({
    ...session.toJSON(),
    current: session.id === req.authSession.id
  })));
}

async function revokeSessionById(req, res) {
  const session = await AuthSession.findOne({ where: { id: req.params.id, userId: req.user.id, revokedAt: null } });
  if (!session) return res.status(404).json({ error: 'Active session not found' });
  await session.update({ revokedAt: new Date() });
  await logAudit({
    req,
    action: 'auth.session_revoked',
    entityType: 'auth_session',
    entityId: session.id,
    metadata: { current: session.id === req.authSession.id }
  });
  return res.status(204).end();
}

function requirePrivilegedMfaUser(req, res) {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'MFA enrollment is available to administrators and platform owners' });
    return false;
  }
  return true;
}

async function setupMfa(req, res) {
  if (!requirePrivilegedMfaUser(req, res)) return;
  const user = await User.findByPk(req.user.id);
  if (!verifyPassword(req.body.password, user.passwordHash)) return res.status(401).json({ error: 'Current password is incorrect' });
  if (user.mfaEnabled) return res.status(409).json({ error: 'MFA is already enabled; disable it before enrolling a different authenticator' });
  const secret = generateSecret();
  await user.update({ mfaSecretEncrypted: encryptSecret(secret), mfaEnabled: false });
  const issuer = encodeURIComponent(process.env.BUSINESS_NAME || 'Jijenge POS');
  const account = encodeURIComponent(user.email || user.phone || user.id);
  return res.json({ secret, otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30` });
}

async function enableMfa(req, res) {
  if (!requirePrivilegedMfaUser(req, res)) return;
  const user = await User.findByPk(req.user.id);
  if (!user.mfaSecretEncrypted) return res.status(409).json({ error: 'Start MFA setup first' });
  if (!verifyCode(decryptSecret(user.mfaSecretEncrypted), req.body.code)) return res.status(400).json({ error: 'Authenticator code is invalid' });
  await user.update({ mfaEnabled: true });
  await logAudit({ req, action: 'auth.mfa_enabled', entityType: 'user', entityId: user.id });
  return res.json({ mfaEnabled: true });
}

async function disableMfa(req, res) {
  if (!requirePrivilegedMfaUser(req, res)) return;
  const user = await User.findByPk(req.user.id);
  if (!verifyPassword(req.body.password, user.passwordHash)) return res.status(401).json({ error: 'Current password is incorrect' });
  if (user.mfaEnabled && !verifyCode(decryptSecret(user.mfaSecretEncrypted), req.body.code)) return res.status(400).json({ error: 'Authenticator code is invalid' });
  await user.update({ mfaEnabled: false, mfaSecretEncrypted: null });
  await logAudit({ req, action: 'auth.mfa_disabled', entityType: 'user', entityId: user.id });
  return res.json({ mfaEnabled: false });
}

module.exports = { login, logout, logoutAll, me, refresh, sessions, revokeSessionById, setRefreshCookie, setupMfa, enableMfa, disableMfa };
