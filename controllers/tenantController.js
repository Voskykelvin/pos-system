'use strict';

const { hashPassword } = require('../utils/passwords');
const { sequelize, Tenant, User, Category } = require('../models');
const { createAuthToken } = require('../utils/authToken');

/**
 * POST /api/signup
 * Self-serve onboarding for store owners.
 * Body: { businessName, email, password, currency, country, plan }
 */
async function signup(req, res) {
  const { businessName, email, password, currency = 'KES', country = 'KE', plan = 'starter' } = req.body;

  if (!businessName || !email || !password) {
    return res.status(400).json({ error: 'businessName, email, and password are required' });
  }

  const t = await sequelize.transaction();

  try {
    const slug = String(businessName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);

    const existingUser = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ error: 'An account with that email address already exists' });
    }

    // 1. Create Tenant
    const tenant = await Tenant.create({
      name: String(businessName).trim(),
      slug,
      currency: String(currency).toUpperCase(),
      country: String(country).toUpperCase(),
      plan,
      status: 'active'
    }, { transaction: t });

    // 2. Create Owner User
    const passwordHash = hashPassword(password);
    const owner = await User.create({
      name: `${businessName} Admin`,
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: 'admin',
      tenantId: tenant.id
    }, { transaction: t });

    await tenant.update({ ownerUserId: owner.id }, { transaction: t });

    // 3. Auto-provision default product categories for the new store
    const defaultCats = ['General', 'Beverages', 'Groceries', 'Snacks', 'Electronics'];
    for (const catName of defaultCats) {
      await Category.create({ name: catName, taxCategory: 'standard', tenantId: tenant.id }, { transaction: t });
    }

    await t.commit();

    const token = createAuthToken(owner);

    return res.status(201).json({
      message: 'Store provisioned successfully!',
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        currency: tenant.currency,
        plan: tenant.plan
      },
      user: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
        tenantId: owner.tenantId
      }
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/super-admin/dashboard
 * SaaS Owner platform analytics (MRR, Total Stores, Active Subscribers).
 */
async function superAdminDashboard(req, res) {
  try {
    const totalTenants = await Tenant.count();
    const activeTenants = await Tenant.count({ where: { status: 'active' } });
    const starterCount = await Tenant.count({ where: { plan: 'starter', status: 'active' } });
    const growthCount = await Tenant.count({ where: { plan: 'growth', status: 'active' } });
    const enterpriseCount = await Tenant.count({ where: { plan: 'enterprise', status: 'active' } });

    // Calculate MRR (Monthly Recurring Revenue in USD)
    const mrrUsd = (starterCount * 29) + (growthCount * 79) + (enterpriseCount * 199);

    const tenants = await Tenant.findAll({
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      metrics: {
        totalTenants,
        activeTenants,
        mrrUsd,
        mrrKes: mrrUsd * 130, // approx KES conversion
        planBreakdown: { starter: starterCount, growth: growthCount, enterprise: enterpriseCount }
      },
      tenants
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/super-admin/tenants/:id
 * Toggle tenant plan or status (activate/suspend).
 */
async function updateTenant(req, res) {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { status, plan, currency } = req.body;
    await tenant.update({ status, plan, currency });

    return res.json(tenant);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { signup, superAdminDashboard, updateTenant };
