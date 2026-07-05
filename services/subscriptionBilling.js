'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const { getPlan, getPlanAmount, getPlanBillingIntervalDays } = require('../utils/planCatalog');

function cleanString(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

function addDays(date, days) {
  return new Date(new Date(date).getTime() + Number(days || 0) * MS_PER_DAY);
}

function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / MS_PER_DAY);
}

function isExpired(tenant) {
  if (!tenant?.subscriptionEndsAt) return false;
  return new Date(tenant.subscriptionEndsAt).getTime() < Date.now();
}

function resolveBillingStatus(tenant) {
  if (!tenant) return 'unknown';
  if (tenant.status === 'active' && isExpired(tenant)) return 'past_due';
  return tenant.status;
}

function getPlanCharge(planId, currency = 'KES') {
  const normalizedCurrency = String(currency || 'KES').toUpperCase();
  return {
    currency: normalizedCurrency,
    amount: getPlanAmount(planId, normalizedCurrency)
  };
}

function buildBillingInstructions(tenant) {
  const platformName = process.env.PLATFORM_BILLING_NAME || process.env.BUSINESS_NAME || 'Jijenge POS';
  const mpesaPhone = process.env.PLATFORM_MPESA_PHONE || process.env.ADMIN_PHONE || '';
  const tillNumber = process.env.PLATFORM_MPESA_TILL || process.env.PLATFORM_MPESA_TILL_NUMBER || '';
  const paybillNumber = process.env.PLATFORM_MPESA_PAYBILL || process.env.PLATFORM_MPESA_PAYBILL_NUMBER || '';
  const accountNumber = (
    process.env.PLATFORM_MPESA_ACCOUNT ||
    tenant?.slug ||
    tenant?.id ||
    'SUBSCRIPTION'
  );

  return {
    platformName,
    preferredMethod: process.env.PLATFORM_PREFERRED_PAYMENT_METHOD || 'mpesa_manual',
    mpesaPhone,
    tillNumber,
    paybillNumber,
    accountNumber,
    bankName: process.env.PLATFORM_BANK_NAME || '',
    bankAccountName: process.env.PLATFORM_BANK_ACCOUNT_NAME || '',
    bankAccountNumber: process.env.PLATFORM_BANK_ACCOUNT_NUMBER || '',
    billingEmail: process.env.PLATFORM_BILLING_EMAIL || process.env.SUPER_ADMIN_EMAIL || '',
    billingPhone: process.env.PLATFORM_BILLING_PHONE || mpesaPhone,
    gatewayProvider: process.env.PLATFORM_PAYMENT_GATEWAY || ''
  };
}

function publicPayment(payment) {
  if (!payment) return null;
  const plain = typeof payment.get === 'function' ? payment.get({ plain: true }) : payment;

  return {
    id: plain.id,
    tenantId: plain.tenantId,
    plan: plain.plan,
    amount: Number(plain.amount || 0),
    currency: plain.currency,
    method: plain.method,
    status: plain.status,
    reference: plain.reference,
    payerName: plain.payerName,
    payerPhone: plain.payerPhone,
    submittedAt: plain.submittedAt,
    confirmedAt: plain.confirmedAt,
    rejectedAt: plain.rejectedAt,
    periodStart: plain.periodStart,
    periodEnd: plain.periodEnd,
    notes: plain.notes,
    adminNotes: plain.adminNotes
  };
}

function buildBillingSummary({ tenant, latestPayment, pendingPayment }) {
  const plan = getPlan(tenant?.plan);
  const charge = getPlanCharge(tenant?.plan, tenant?.currency || 'KES');
  const status = resolveBillingStatus(tenant);
  const daysRemaining = daysUntil(tenant?.subscriptionEndsAt);

  return {
    status,
    plan,
    charge,
    subscriptionStartedAt: tenant?.subscriptionStartedAt || null,
    subscriptionEndsAt: tenant?.subscriptionEndsAt || null,
    daysRemaining,
    latestPayment: publicPayment(latestPayment),
    pendingPayment: publicPayment(pendingPayment)
  };
}

function nextPeriodForTenant(tenant) {
  const intervalDays = getPlanBillingIntervalDays(tenant.plan);
  const currentEnd = tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt) : null;
  const now = new Date();
  const periodStart = currentEnd && currentEnd > now ? currentEnd : now;
  const periodEnd = addDays(periodStart, intervalDays);

  return { periodStart, periodEnd };
}

function sanitizePaymentSubmission(body = {}) {
  return {
    method: cleanString(body.method, 50) || 'mpesa_manual',
    reference: cleanString(body.reference, 120),
    payerName: cleanString(body.payerName, 255),
    payerPhone: cleanString(body.payerPhone, 50),
    notes: cleanString(body.notes, 1000)
  };
}

module.exports = {
  buildBillingInstructions,
  buildBillingSummary,
  cleanString,
  getPlanCharge,
  isExpired,
  nextPeriodForTenant,
  publicPayment,
  resolveBillingStatus,
  sanitizePaymentSubmission
};
