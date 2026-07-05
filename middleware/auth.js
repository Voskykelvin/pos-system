const { User, Tenant } = require('../models');
const { verifyAuthToken } = require('../utils/authToken');

async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifyAuthToken(token);
    const user = await User.findByPk(payload.sub, {
      include: [{ model: Tenant, attributes: ['id', 'name', 'plan', 'status', 'currency', 'country'] }]
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User is inactive or missing' });
    }
    if (user.Tenant?.status === 'suspended') {
      return res.status(403).json({ error: 'This store is suspended. Contact the platform owner.' });
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
      country: user.Tenant.country
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
