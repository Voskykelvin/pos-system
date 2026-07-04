'use strict';

const { Tenant } = require('../models');
const { planHasFeature } = require('../utils/planCatalog');

async function resolveTenant(req) {
  if (req.tenant) return req.tenant;
  if (!req.tenantId) return null;
  const tenant = await Tenant.findByPk(req.tenantId, {
    attributes: ['id', 'name', 'plan', 'status']
  });
  if (!tenant) return null;
  req.tenant = {
    id: tenant.id,
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status
  };
  return req.tenant;
}

async function assertPlanFeature(req, feature) {
  if (!req.tenantId || req.user?.role === 'super_admin') return;

  const tenant = await resolveTenant(req);
  if (!tenant) return;
  if (tenant.status === 'suspended') {
    throw Object.assign(new Error('This store is suspended. Contact the platform owner.'), { status: 403 });
  }
  if (!planHasFeature(tenant.plan, feature)) {
    throw Object.assign(
      new Error(`Your ${tenant.plan} plan does not include this feature.`),
      { status: 402 }
    );
  }
}

function requirePlanFeature(feature) {
  return async (req, res, next) => {
    try {
      await assertPlanFeature(req, feature);
      return next();
    } catch (err) {
      return res.status(err.status || 403).json({ error: err.message });
    }
  };
}

module.exports = { assertPlanFeature, requirePlanFeature };
