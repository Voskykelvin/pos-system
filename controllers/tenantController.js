'use strict';

const { Op } = require('sequelize');
const { hashPassword } = require('../utils/passwords');
const { sequelize, Tenant, User, Branch, Category, Order, Payment } = require('../models');
const { createAuthToken } = require('../utils/authToken');
const { getPlanCatalog, getPlanPrice, isKnownPlan } = require('../utils/planCatalog');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function percent(value) {
  return Number(Number(value || 0).toFixed(1));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? percent((numerator / denominator) * 100) : 0;
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function parseRange(query) {
  const days = Math.min(Math.max(Number(query.days || 30), 1), 365);
  const end = query.end ? new Date(query.end) : new Date();
  const start = query.start ? new Date(query.start) : new Date(end);

  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
    throw new Error('Invalid start or end date');
  }

  if (!query.start) {
    start.setDate(start.getDate() - days + 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end, days };
}

function buildDailySeries(start, end) {
  const series = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    series.push({
      date: dateKey(cursor),
      signups: 0,
      activated: 0,
      paidOrders: 0,
      revenue: 0
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

function sanitizeTenant(tenant) {
  const plain = typeof tenant.get === 'function' ? tenant.get({ plain: true }) : tenant;
  const { settings, ...safe } = plain;
  return safe;
}

/**
 * GET /api/plans
 * Public plan catalog for the homepage and signup flow.
 */
async function plans(req, res) {
  return res.json({ plans: getPlanCatalog() });
}

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

  if (!isKnownPlan(plan)) {
    return res.status(400).json({ error: 'Unknown subscription plan' });
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

    const mainBranch = await Branch.create({
      tenantId: tenant.id,
      name: 'Main branch',
      code: 'MAIN',
      isActive: true
    }, { transaction: t });

    // 2. Create Owner User
    const passwordHash = hashPassword(password);
    const owner = await User.create({
      name: `${businessName} Admin`,
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: 'admin',
      tenantId: tenant.id,
      branchId: mainBranch.id
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
        tenantId: owner.tenantId,
        branchId: owner.branchId
      }
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/super-admin/dashboard
 * SaaS Owner platform analytics (MRR, tenants, activation, and activity).
 */
async function superAdminDashboard(req, res) {
  try {
    const { start, end, days } = parseRange(req.query);

    const [tenants, users, orders] = await Promise.all([
      Tenant.findAll({
        include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
        order: [['createdAt', 'DESC']]
      }),
      User.findAll({ attributes: ['id', 'tenantId', 'role', 'isActive'] }),
      Order.findAll({
        where: {
          createdAt: {
            [Op.gte]: start,
            [Op.lte]: end
          }
        },
        include: [{ model: Payment }],
        order: [['createdAt', 'DESC']]
      })
    ]);

    const activeTenants = tenants.filter((tenant) => tenant.status === 'active');
    const suspendedTenants = tenants.filter((tenant) => tenant.status === 'suspended');
    const pastDueTenants = tenants.filter((tenant) => tenant.status === 'past_due');
    const newTenants = tenants.filter((tenant) => tenant.createdAt >= start && tenant.createdAt <= end);
    const activeNewTenants = newTenants.filter((tenant) => tenant.status === 'active');

    const planBreakdown = { starter: 0, growth: 0, enterprise: 0 };
    const planRevenue = { starter: 0, growth: 0, enterprise: 0 };

    for (const tenant of activeTenants) {
      if (!Object.prototype.hasOwnProperty.call(planBreakdown, tenant.plan)) {
        continue;
      }
      planBreakdown[tenant.plan] += 1;
      planRevenue[tenant.plan] += getPlanPrice(tenant.plan);
    }

    const mrrUsd = Object.values(planRevenue).reduce((sum, value) => sum + value, 0);
    const usersByTenant = new Map();
    for (const user of users) {
      if (!user.tenantId) continue;
      const count = usersByTenant.get(user.tenantId) || { totalUsers: 0, activeUsers: 0 };
      count.totalUsers += 1;
      if (user.isActive) count.activeUsers += 1;
      usersByTenant.set(user.tenantId, count);
    }

    const tenantActivity = new Map();
    const dailySeries = buildDailySeries(start, end);
    const dailyMap = new Map(dailySeries.map((day) => [day.date, day]));

    for (const tenant of tenants) {
      const signupDay = dailyMap.get(dateKey(tenant.createdAt));
      if (signupDay) {
        signupDay.signups += 1;
        if (tenant.status === 'active') signupDay.activated += 1;
      }
    }

    for (const order of orders) {
      if (!order.tenantId) continue;

      const current = tenantActivity.get(order.tenantId) || {
        attemptedOrders: 0,
        paidOrders: 0,
        voidedOrders: 0,
        sales: 0,
        confirmedPayments: 0,
        lastOrderAt: null
      };

      current.attemptedOrders += 1;
      if (order.status === 'voided') current.voidedOrders += 1;

      if (order.status === 'completed' && order.paymentStatus === 'paid') {
        current.paidOrders += 1;
        current.sales += Number(order.total || 0);
        current.confirmedPayments += (order.Payments || [])
          .filter((payment) => payment.status === 'confirmed')
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        const day = dailyMap.get(dateKey(order.createdAt));
        if (day) {
          day.paidOrders += 1;
          day.revenue += Number(order.total || 0);
        }
      }

      if (!current.lastOrderAt || order.createdAt > current.lastOrderAt) {
        current.lastOrderAt = order.createdAt;
      }

      tenantActivity.set(order.tenantId, current);
    }

    const activeStoresWithSales = Array.from(tenantActivity.entries())
      .filter(([tenantId, activity]) => {
        const tenant = tenants.find((item) => item.id === tenantId);
        return tenant?.status === 'active' && activity.paidOrders > 0;
      }).length;

    const tenantRows = tenants.map((tenant) => {
      const plain = sanitizeTenant(tenant);
      const activity = tenantActivity.get(tenant.id) || {
        attemptedOrders: 0,
        paidOrders: 0,
        voidedOrders: 0,
        sales: 0,
        confirmedPayments: 0,
        lastOrderAt: null
      };
      const userCounts = usersByTenant.get(tenant.id) || { totalUsers: 0, activeUsers: 0 };
      const daysSinceSignup = Math.max(
        Math.ceil((Date.now() - new Date(tenant.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
        0
      );

      let health = 'healthy';
      if (tenant.status !== 'active') health = tenant.status;
      else if (activity.paidOrders === 0 && daysSinceSignup > 7) health = 'no_sales';
      else if (daysSinceSignup <= 7) health = 'new_store';

      const upgradeSignal = tenant.plan === 'starter' && (
        activity.paidOrders >= 100 ||
        activity.sales >= 250000 ||
        userCounts.activeUsers >= 3
      );

      return {
        ...plain,
        activity: {
          attemptedOrders: activity.attemptedOrders,
          paidOrders: activity.paidOrders,
          voidedOrders: activity.voidedOrders,
          sales: money(activity.sales),
          confirmedPayments: money(activity.confirmedPayments),
          conversionRate: ratio(activity.paidOrders, activity.attemptedOrders),
          lastOrderAt: activity.lastOrderAt,
          daysSinceSignup,
          health,
          upgradeSignal,
          totalUsers: userCounts.totalUsers,
          activeUsers: userCounts.activeUsers
        }
      };
    });

    return res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
        days
      },
      metrics: {
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        suspendedTenants: suspendedTenants.length,
        pastDueTenants: pastDueTenants.length,
        newTenants: newTenants.length,
        activeNewTenants: activeNewTenants.length,
        signupToActiveConversionRate: ratio(activeTenants.length, tenants.length),
        newSignupActivationRate: ratio(activeNewTenants.length, newTenants.length),
        activeStoresWithSales,
        storeActivityRate: ratio(activeStoresWithSales, activeTenants.length),
        mrrUsd,
        mrrKes: mrrUsd * 130, // approx KES conversion
        arpaUsd: activeTenants.length ? money(mrrUsd / activeTenants.length) : 0,
        planBreakdown,
        planRevenue
      },
      charts: {
        signupTrend: dailySeries.map((day) => ({
          ...day,
          revenue: money(day.revenue)
        })),
        planMix: getPlanCatalog().map((plan) => ({
          plan: plan.id,
          name: plan.name,
          stores: planBreakdown[plan.id] || 0,
          mrrUsd: planRevenue[plan.id] || 0
        })),
        tenantHealth: ['healthy', 'new_store', 'no_sales', 'past_due', 'suspended'].map((health) => ({
          health,
          stores: tenantRows.filter((tenant) => tenant.activity.health === health).length
        }))
      },
      plans: getPlanCatalog(),
      tenants: tenantRows
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

    const { status, plan, currency, settings } = req.body;
    const updates = {};

    if (status !== undefined) {
      if (!['active', 'past_due', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'Unknown tenant status' });
      }
      updates.status = status;
    }

    if (plan !== undefined) {
      if (!isKnownPlan(plan)) {
        return res.status(400).json({ error: 'Unknown subscription plan' });
      }
      updates.plan = plan;
    }

    if (currency !== undefined) {
      updates.currency = String(currency).toUpperCase();
    }

    if (settings !== undefined) {
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return res.status(400).json({ error: 'settings must be an object' });
      }
      updates.settings = settings;
    }

    await tenant.update(updates);

    return res.json(sanitizeTenant(tenant));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { plans, signup, superAdminDashboard, updateTenant };
