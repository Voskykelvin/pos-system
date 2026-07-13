'use strict';

const { Op } = require('sequelize');
const { sequelize, Tenant, SubscriptionPayment } = require('../models');
const {
  buildBillingInstructions,
  buildBillingSummary,
  getPlanCharge,
  getMidCycleUpgradeQuotes,
  nextPeriodForTenant,
  publicPayment,
  sanitizePaymentSubmission
} = require('../services/subscriptionBilling');
const { logAudit } = require('../services/auditLogger');

const PAYMENT_METHODS = ['mpesa_manual', 'till_manual', 'paybill_manual', 'bank_transfer', 'card_gateway', 'other'];

async function loadTenantBilling(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'slug', 'plan', 'status', 'currency', 'country', 'subscriptionStartedAt', 'subscriptionEndsAt', 'settings']
  });

  if (!tenant) return null;

  const payments = await SubscriptionPayment.findAll({
    where: { tenantId },
    order: [['createdAt', 'DESC']],
    limit: 10
  });

  const latestPayment = payments[0] || null;
  const pendingPayment = payments.find((payment) => payment.status === 'pending') || null;

  return {
    tenant,
    payments,
    billing: buildBillingSummary({ tenant, latestPayment, pendingPayment }),
    instructions: buildBillingInstructions(tenant)
  };
}

async function getBilling(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'A tenant account is required for billing.' });
    }

    const payload = await loadTenantBilling(req.tenantId);
    if (!payload) return res.status(404).json({ error: 'Tenant not found' });

    return res.json({
      tenant: {
        id: payload.tenant.id,
        name: payload.tenant.name,
        slug: payload.tenant.slug,
        plan: payload.tenant.plan,
        status: payload.tenant.status,
        currency: payload.tenant.currency,
        country: payload.tenant.country
      },
      billing: payload.billing,
      instructions: payload.instructions,
      recentPayments: payload.payments.map(publicPayment)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function submitPayment(req, res) {
  const submission = sanitizePaymentSubmission(req.body);

  if (!req.tenantId) {
    return res.status(400).json({ error: 'A tenant account is required for billing.' });
  }
  if (!PAYMENT_METHODS.includes(submission.method)) {
    return res.status(400).json({ error: 'Unsupported subscription payment method.' });
  }
  if (submission.reference.length < 4) {
    return res.status(400).json({ error: 'Enter the M-Pesa, bank, or gateway payment reference.' });
  }

  const t = await sequelize.transaction();

  try {
    const tenant = await Tenant.findByPk(req.tenantId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!tenant) {
      await t.rollback();
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const pending = await SubscriptionPayment.findOne({
      where: { tenantId: tenant.id, status: 'pending' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (pending) {
      await t.rollback();
      return res.status(409).json({ error: 'A subscription payment is already awaiting review.' });
    }

    const duplicate = await SubscriptionPayment.findOne({
      where: {
        tenantId: tenant.id,
        reference: submission.reference,
        status: { [Op.ne]: 'rejected' }
      },
      transaction: t
    });

    if (duplicate) {
      await t.rollback();
      return res.status(409).json({ error: 'That payment reference has already been submitted.' });
    }

    let paymentPlan = tenant.plan;
    let charge = getPlanCharge(tenant.plan, tenant.currency || 'KES');
    let paymentMetadata = {
      submittedByUserId: req.user.id,
      source: 'tenant_billing_page',
      billingType: 'renewal'
    };

    if (submission.targetPlan) {
      const quote = getMidCycleUpgradeQuotes(tenant).find((item) => item.targetPlan === submission.targetPlan);
      if (!quote) {
        await t.rollback();
        return res.status(400).json({ error: 'That plan is not an available mid-cycle upgrade for this subscription.' });
      }
      paymentPlan = quote.targetPlan;
      charge = { amount: quote.amount, currency: quote.currency };
      paymentMetadata = {
        ...paymentMetadata,
        billingType: 'mid_cycle_upgrade',
        fromPlan: quote.fromPlan,
        targetPlan: quote.targetPlan,
        unusedCurrentPlanCredit: quote.unusedCurrentPlanCredit,
        targetPlanProratedValue: quote.targetPlanProratedValue,
        remainingDays: quote.remainingDays,
        subscriptionEndsAt: quote.subscriptionEndsAt.toISOString()
      };
    }

    const payment = await SubscriptionPayment.create({
      tenantId: tenant.id,
      plan: paymentPlan,
      amount: charge.amount,
      currency: charge.currency,
      method: submission.method,
      reference: submission.reference,
      payerName: submission.payerName || null,
      payerPhone: submission.payerPhone || null,
      notes: submission.notes || null,
      metadata: paymentMetadata
    }, { transaction: t });

    const settings = tenant.settings || {};
    const nextSettings = {
      ...settings,
      billing: {
        ...((settings || {}).billing || {}),
        subscriptionPaymentMethod: submission.method,
        status: submission.targetPlan ? 'upgrade_review' : 'manual_review',
        billingContactName: submission.payerName || settings.billing?.billingContactName || '',
        billingPhone: submission.payerPhone || settings.billing?.billingPhone || '',
        billingReference: submission.reference
      }
    };

    await tenant.update({
      status: tenant.status === 'active' ? 'active' : 'pending_payment',
      settings: nextSettings
    }, { transaction: t });

    await t.commit();

    const payload = await loadTenantBilling(req.tenantId);
    return res.status(201).json({
      message: submission.targetPlan
        ? `Upgrade payment submitted. ${paymentPlan} features activate after verification.`
        : 'Payment reference submitted for admin verification.',
      paymentId: payment.id,
      billing: payload.billing,
      recentPayments: payload.payments.map(publicPayment)
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
}

async function confirmSubscriptionPayment(req, res) {
  const t = await sequelize.transaction();

  try {
    const payment = await SubscriptionPayment.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).json({ error: 'Subscription payment not found' });
    }
    if (payment.status === 'confirmed') {
      await t.rollback();
      return res.status(400).json({ error: 'Payment is already confirmed' });
    }
    if (payment.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ error: 'Only pending payments can be confirmed' });
    }

    const tenant = await Tenant.findByPk(payment.tenantId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!tenant) {
      await t.rollback();
      return res.status(404).json({ error: 'Tenant not found for this subscription payment' });
    }

    const isUpgrade = payment.metadata?.billingType === 'mid_cycle_upgrade';
    if (isUpgrade && tenant.plan !== payment.metadata.fromPlan) {
      await t.rollback();
      return res.status(409).json({ error: 'The store plan changed after this upgrade was submitted. Review the payment manually.' });
    }
    const renewalPeriod = nextPeriodForTenant(tenant);
    const periodStart = isUpgrade ? new Date() : renewalPeriod.periodStart;
    const periodEnd = isUpgrade
      ? new Date(payment.metadata.subscriptionEndsAt)
      : renewalPeriod.periodEnd;
    const settings = tenant.settings || {};
    const adminNotes = String(req.body?.adminNotes || '').trim().slice(0, 1000) || null;

    await payment.update({
      status: 'confirmed',
      confirmedAt: new Date(),
      reviewedByUserId: req.user.id,
      periodStart,
      periodEnd,
      adminNotes
    }, { transaction: t });

    await tenant.update({
      plan: payment.plan,
      status: 'active',
      subscriptionStartedAt: tenant.subscriptionStartedAt || periodStart,
      subscriptionEndsAt: periodEnd,
      settings: {
        ...settings,
        billing: {
          ...((settings || {}).billing || {}),
          subscriptionPaymentMethod: payment.method,
          status: 'active',
          billingReference: payment.reference,
          billingPhone: payment.payerPhone || settings.billing?.billingPhone || '',
          billingContactName: payment.payerName || settings.billing?.billingContactName || ''
        }
      }
    }, { transaction: t });

    await t.commit();

    logAudit({
      req,
      action: 'billing.payment_confirmed',
      entityType: 'subscription_payment',
      entityId: payment.id,
      metadata: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        plan: payment.plan,
        amount: Number(payment.amount),
        periodStart,
        periodEnd
      }
    }).catch(() => {});

    return res.json({
      message: isUpgrade ? `Upgrade to ${payment.plan} confirmed.` : 'Subscription payment confirmed.',
      paymentId: payment.id,
      tenantId: tenant.id,
      periodStart,
      periodEnd
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
}

async function rejectSubscriptionPayment(req, res) {
  const t = await sequelize.transaction();

  try {
    const payment = await SubscriptionPayment.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).json({ error: 'Subscription payment not found' });
    }
    if (payment.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ error: 'Only pending payments can be rejected' });
    }

    const tenant = await Tenant.findByPk(payment.tenantId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!tenant) {
      await t.rollback();
      return res.status(404).json({ error: 'Tenant not found for this subscription payment' });
    }

    const settings = tenant.settings || {};
    const adminNotes = String(req.body?.adminNotes || '').trim().slice(0, 1000) || 'Reference could not be verified.';

    await payment.update({
      status: 'rejected',
      rejectedAt: new Date(),
      reviewedByUserId: req.user.id,
      adminNotes
    }, { transaction: t });

    await tenant.update({
      status: tenant.subscriptionEndsAt && new Date(tenant.subscriptionEndsAt).getTime() > Date.now()
        ? 'active'
        : 'pending_payment',
      settings: {
        ...settings,
        billing: {
          ...((settings || {}).billing || {}),
          status: 'payment_rejected',
          billingReference: payment.reference
        }
      }
    }, { transaction: t });

    await t.commit();

    logAudit({
      req,
      action: 'billing.payment_rejected',
      entityType: 'subscription_payment',
      entityId: payment.id,
      metadata: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        reference: payment.reference,
        adminNotes
      }
    }).catch(() => {});

    return res.json({
      message: 'Subscription payment rejected.',
      paymentId: payment.id,
      tenantId: tenant.id
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  confirmSubscriptionPayment,
  getBilling,
  rejectSubscriptionPayment,
  submitPayment
};
