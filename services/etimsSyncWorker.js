const { EtimsInvoice } = require('../models');
const { transmitInvoice } = require('../utils/etimsClient');

// KRA allows up to 48 hours for offline invoice transmission, so we keep
// retrying for a while before giving up and flagging it for manual attention.
const MAX_RETRIES = 10;
const BATCH_SIZE = 20;

/**
 * Processes one batch of queued (or previously failed but retryable)
 * eTIMS invoices. Safe to call repeatedly, e.g. from a cron job every
 * minute, since each invoice is only picked up while status is 'queued'.
 */
async function processQueue() {
  const pending = await EtimsInvoice.findAll({
    where: { status: 'queued' },
    order: [['createdAt', 'ASC']],
    limit: BATCH_SIZE
  });

  const results = { transmitted: 0, failed: 0, skipped: 0 };

  for (const invoice of pending) {
    try {
      const response = await transmitInvoice(invoice.payload);

      await invoice.update({
        status: 'transmitted',
        cuInvoiceNumber: response.cuInvoiceNumber,
        qrCodeUrl: response.qrCodeUrl,
        responsePayload: response.raw,
        transmittedAt: new Date()
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
async function requeueFailed() {
  const [count] = await EtimsInvoice.update(
    { status: 'queued', retryCount: 0 },
    { where: { status: 'failed' } }
  );
  return { requeued: count };
}

module.exports = { processQueue, requeueFailed, MAX_RETRIES };
