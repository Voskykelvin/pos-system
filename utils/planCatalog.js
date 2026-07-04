'use strict';

const PLAN_CATALOG = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceUsd: 20,
    registerLimit: 1,
    staffLimit: 3,
    enabledFeatures: [
      'checkout',
      'catalog',
      'daily_dashboard',
      'csv_tools',
      'low_stock'
    ],
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
    priceUsd: 70,
    registerLimit: 5,
    staffLimit: 15,
    enabledFeatures: [
      'checkout',
      'catalog',
      'daily_dashboard',
      'csv_tools',
      'low_stock',
      'advanced_analytics',
      'reorder_suggestions',
      'purchasing',
      'customer_credit',
      'loyalty',
      'promotions',
      'staff_reports'
    ],
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
    priceUsd: 115,
    registerLimit: null,
    staffLimit: null,
    enabledFeatures: [
      'checkout',
      'catalog',
      'daily_dashboard',
      'csv_tools',
      'low_stock',
      'advanced_analytics',
      'reorder_suggestions',
      'purchasing',
      'customer_credit',
      'loyalty',
      'promotions',
      'staff_reports',
      'multi_branch',
      'platform_api'
    ],
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
  return Object.values(PLAN_CATALOG).map((plan) => ({
    ...plan,
    features: [...plan.features],
    enabledFeatures: [...plan.enabledFeatures]
  }));
}

function getPlanPrice(planId) {
  return PLAN_CATALOG[planId]?.priceUsd || 0;
}

function getPlan(planId) {
  const plan = PLAN_CATALOG[planId];
  return plan ? { ...plan, features: [...plan.features], enabledFeatures: [...plan.enabledFeatures] } : null;
}

function isKnownPlan(planId) {
  return Boolean(PLAN_CATALOG[planId]);
}

function planHasFeature(planId, feature) {
  const plan = PLAN_CATALOG[planId];
  if (!plan) return false;
  return plan.enabledFeatures.includes(feature);
}

function getPlanLimit(planId, limitName) {
  const plan = PLAN_CATALOG[planId];
  return plan ? plan[limitName] : undefined;
}

module.exports = {
  PLAN_CATALOG,
  getPlan,
  getPlanCatalog,
  getPlanLimit,
  getPlanPrice,
  isKnownPlan,
  planHasFeature
};
