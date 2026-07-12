const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, EtimsInvoice, Order, Tenant } = require('../models');
const { transmitInvoice } = require('../utils/etimsClient');
const { resolveTenantConfig } = require('../utils/tenantConfig');

// KRA allows up to 48 hours for offline invoice transmission, so we keep
// retrying for a while before giving up and flagging it for manual attention.
const MAX_RETRIES = 10;
const BATCH_SIZE = 20;
const LEASE_MINUTES = 10;

function retryDelayMilliseconds(retryCount) {
  return Math.min(30 * 60 * 1000, 30 * 1000 * (2 ** Math.max(0, retryCount - 1)));
}

async function claimBatch({ tenantId = null } = {}) {
  const staleBefore = new Date(Date.now() - LEASE_MINUTES * 60 * 1000);
  await EtimsInvoice.update(
    { status: 'queued', lockedAt: null, lockToken: null },
    { where: { status: 'processing', lockedAt: { [Op.lt]: staleBefore } } }
  );

  return sequelize.transaction(async (transaction) => {
    const invoices = await EtimsInvoice.findAll({
      where: {
        status: 'queued',
        [Op.or]: [{ nextAttemptAt: null }, { nextAttemptAt: { [Op.lte]: new Date() } }]
      },
      include: [{ model: Order, where: tenantId ? { tenantId } : undefined }],
      order: [['createdAt', 'ASC']],
      limit: BATCH_SIZE,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction
    });

    for (const invoice of invoices) {
      await invoice.update({
        status: 'processing',
        lockedAt: new Date(),
        lockToken: crypto.randomUUID()
      }, { transaction });
    }
    return invoices.map((invoice) => invoice.id);
  });
}

/**
 * Processes one batch of queued (or previously failed but retryable)
 * eTIMS invoices. Safe to call repeatedly, e.g. from a cron job every
 * minute, since each invoice is only picked up while status is 'queued'.
 */
async function processQueue({ tenantId = null } = {}) {
  const claimedIds = await claimBatch({ tenantId });
  const pending = await EtimsInvoice.findAll({
    where: { id: claimedIds, status: 'processing' },
    include: [{
      model: Order,
      where: tenantId ? { tenantId } : undefined,
      include: [{ model: Tenant }]
    }],
    order: [['createdAt', 'ASC']]
  });

  const results = { transmitted: 0, failed: 0, skipped: 0 };

  for (const invoice of pending) {
    try {
      const tenantConfig = await resolveTenantConfig(invoice.Order?.Tenant || invoice.Order?.tenantId);
      const response = await transmitInvoice(invoice.payload, tenantConfig.etims);

      await invoice.update({
        status: 'transmitted',
        cuInvoiceNumber: response.cuInvoiceNumber,
        qrCodeUrl: response.qrCodeUrl,
        responsePayload: response.raw,
        transmittedAt: new Date(),
        nextAttemptAt: null,
        lockedAt: null,
        lockToken: null
      });

      results.transmitted += 1;
    } catch (err) {
      const nextRetryCount = invoice.retryCount + 1;
      const givingUp = nextRetryCount >= MAX_RETRIES;

      await invoice.update({
        retryCount: nextRetryCount,
        // Stays 'queued' so the next run picks it up again, unless we've
        // exhausted retries, in which case it needs a human to look at it.
        status: givingUp ? 'failed' : 'queued',
        nextAttemptAt: givingUp ? null : new Date(Date.now() + retryDelayMilliseconds(nextRetryCount)),
        lockedAt: null,
        lockToken: null,
        responsePayload: {
          error: err.message,
          attemptedAt: new Date().toISOString()
        }
      });

      if (givingUp) {
        console.error(
          `eTIMS invoice ${invoice.id} (order ${invoice.orderId}) failed after ${MAX_RETRIES} attempts: ${err.message}`
        );
        results.failed += 1;
      } else {
        results.skipped += 1;
      }
    }
  }

  return results;
}

/**
 * Requeues invoices that were marked 'failed', for after you've fixed
 * whatever was wrong (bad credentials, KRA outage, payload bug). Call
 * this manually, it is not run automatically.
 */
async function requeueFailed({ tenantId = null } = {}) {
  if (!tenantId) {
    const [count] = await EtimsInvoice.update(
      { status: 'queued', retryCount: 0, nextAttemptAt: null, lockedAt: null, lockToken: null },
      { where: { status: 'failed' } }
    );
    return { requeued: count };
  }

  const failed = await EtimsInvoice.findAll({
    where: { status: 'failed' },
    include: [{ model: Order, where: { tenantId } }],
    attributes: ['id']
  });
  const ids = failed.map((invoice) => invoice.id);
  if (ids.length === 0) return { requeued: 0 };

  const [count] = await EtimsInvoice.update(
    { status: 'queued', retryCount: 0, nextAttemptAt: null, lockedAt: null, lockToken: null },
    { where: { id: ids } }
  );
  return { requeued: count };
}

module.exports = { processQueue, requeueFailed, retryDelayMilliseconds, MAX_RETRIES };
