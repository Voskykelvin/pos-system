'use strict';

const { Tenant } = require('../models');
const { planHasFeature } = require('../utils/planCatalog');
const { isExpired, resolveBillingStatus } = require('../services/subscriptionBilling');

async function resolveTenant(req) {
  if (req.tenant) return req.tenant;
  if (!req.tenantId) return null;
  const tenant = await Tenant.findByPk(req.tenantId, {
    attributes: ['id', 'name', 'plan', 'status', 'subscriptionEndsAt']
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
  if (tenant.status === 'active' && isExpired(tenant)) {
    await Tenant.update({ status: 'past_due' }, { where: { id: tenant.id } });
    tenant.status = 'past_due';
  }

  const billingStatus = resolveBillingStatus(tenant);
  if (billingStatus !== 'active') {
    throw Object.assign(
      new Error(billingStatus === 'suspended'
        ? 'This store is suspended. Contact the platform owner.'
        : 'Subscription payment is required to continue.'),
      { status: billingStatus === 'suspended' ? 403 : 402 }
    );
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
