const { Op } = require('sequelize');
const { User, Tenant } = require('../models');
const { createAuthToken } = require('../utils/authToken');
const { verifyPassword } = require('../utils/passwords');
const { getPlan } = require('../utils/planCatalog');

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
      include: [{ model: Tenant, attributes: ['id', 'name', 'plan', 'status', 'currency', 'country'] }]
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid login details' });
    }
    if (user.Tenant?.status === 'suspended') {
      return res.status(403).json({ error: 'This store is suspended. Contact the platform owner.' });
    }

    const tenantPlan = user.Tenant?.plan ? getPlan(user.Tenant.plan) : null;

    return res.json({
      token: createAuthToken(user),
      user: publicUser(user),
      tenant: user.Tenant ? {
        id: user.Tenant.id,
        name: user.Tenant.name,
        plan: user.Tenant.plan,
        status: user.Tenant.status,
        currency: user.Tenant.currency,
        country: user.Tenant.country,
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
