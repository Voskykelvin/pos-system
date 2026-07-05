const { User, Tenant } = require('../models');
const { verifyAuthToken } = require('../utils/authToken');
const { isExpired, resolveBillingStatus } = require('../services/subscriptionBilling');

function isBillingRecoveryPath(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return (
    path === '/api/bootstrap' ||
    path === '/api/auth/me' ||
    path.startsWith('/api/billing')
  );
}

async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifyAuthToken(token);
    const user = await User.findByPk(payload.sub, {
      include: [{
        model: Tenant,
        attributes: ['id', 'name', 'plan', 'status', 'currency', 'country', 'subscriptionStartedAt', 'subscriptionEndsAt']
      }]
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User is inactive or missing' });
    }
    if (user.Tenant?.status === 'active' && isExpired(user.Tenant)) {
      await user.Tenant.update({ status: 'past_due' });
      user.Tenant.status = 'past_due';
    }

    const billingStatus = resolveBillingStatus(user.Tenant);
    if (user.Tenant && billingStatus !== 'active' && !isBillingRecoveryPath(req)) {
      const status = billingStatus === 'suspended' ? 403 : 402;
      return res.status(status).json({
        error: billingStatus === 'suspended'
          ? 'This store is suspended. Contact the platform owner.'
          : 'Subscription payment is required to continue.',
        billingRequired: true,
        billingStatus
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId || null,
      branchId: user.branchId || null
    };
    req.tenantId = user.role === 'super_admin' && req.get('x-tenant-id')
      ? req.get('x-tenant-id')
      : user.tenantId || null;
    req.tenant = user.Tenant ? {
      id: user.Tenant.id,
      name: user.Tenant.name,
      plan: user.Tenant.plan,
      status: user.Tenant.status,
      currency: user.Tenant.currency,
      country: user.Tenant.country,
      subscriptionStartedAt: user.Tenant.subscriptionStartedAt,
      subscriptionEndsAt: user.Tenant.subscriptionEndsAt
    } : null;

    return next();
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return next();
  };
}

module.exports = { authenticate, requireRoles };
