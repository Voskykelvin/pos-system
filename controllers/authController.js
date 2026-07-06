const { Op } = require('sequelize');
const { User, Tenant } = require('../models');
const { createAuthToken } = require('../utils/authToken');
const { verifyPassword } = require('../utils/passwords');
const { getPlan } = require('../utils/planCatalog');
const { isExpired, resolveBillingStatus } = require('../services/subscriptionBilling');
const { logAudit } = require('../services/auditLogger');
const logger = require('../utils/logger');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    tenantId: user.tenantId || null,
    branchId: user.branchId || null
  };
}

async function login(req, res) {
  const { identifier, password } = req.body;

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

    return res.json({
      token: createAuthToken(user),
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

module.exports = { login, me };
