'use strict';

const PLAN_CATALOG = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceUsd: 29,
    registerLimit: 1,
    staffLimit: 3,
    featureSummary: 'Fast checkout, catalog control, daily reporting, CSV tools, and low-stock alerts.',
    features: [
      'POS checkout and split payments',
      'Product catalog and category management',
      'Daily dashboard and CSV exports',
      'Low-stock alerts',
      '1 register and up to 3 staff users'
    ]
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceUsd: 79,
    registerLimit: 5,
    staffLimit: 15,
    featureSummary: 'Advanced analytics, reorder intelligence, suppliers, customer credit, loyalty, and staff reports.',
    features: [
      'Everything in Starter',
      'Advanced sales and inventory analytics',
      'Reorder recommendations and purchase orders',
      'Supplier management',
      'Customer credit, loyalty, and staff performance'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: 199,
    registerLimit: null,
    staffLimit: null,
    featureSummary: 'Multi-branch controls, deeper audit visibility, platform support, API exports, and custom rollout help.',
    features: [
      'Everything in Growth',
      'Unlimited registers and staff users',
      'Multi-branch reporting readiness',
      'Audit and compliance reporting',
      'Priority support and custom integrations'
    ]
  }
};

function getPlanCatalog() {
  return Object.values(PLAN_CATALOG).map((plan) => ({ ...plan, features: [...plan.features] }));
}

function getPlanPrice(planId) {
  return PLAN_CATALOG[planId]?.priceUsd || 0;
}

function isKnownPlan(planId) {
  return Boolean(PLAN_CATALOG[planId]);
}

module.exports = { PLAN_CATALOG, getPlanCatalog, getPlanPrice, isKnownPlan };
