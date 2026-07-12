const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, EtimsCreditNote, Order, Tenant } = require('../models');
const { transmitCreditNote } = require('../utils/etimsClient');
const { resolveTenantConfig } = require('../utils/tenantConfig');
const { retryDelayMilliseconds, MAX_RETRIES } = require('./etimsSyncWorker');

const BATCH_SIZE = 20;

function buildCreditNotePayload({ order, refund, accounting }) {
  return {
    creditNoteNumber: `CN-${order.orderNumber}-${refund.id.slice(0, 8)}`,
    originalTraderInvoiceNumber: order.orderNumber,
    originalCuInvoiceNumber: order.EtimsInvoice.cuInvoiceNumber,
    creditNoteDate: refund.createdAt,
    reason: refund.reason,
    refundType: refund.type,
    items: accounting.lines.map((line) => ({
      orderItemId: line.orderItemId,
      productId: line.productId,
      quantity: Number(line.quantity),
      grossTotal: Number(line.grossTotal),
      discountTotal: Number(line.discountTotal),
      taxTotal: Number(line.taxTotal),
      total: Number(line.total)
    })),
    subtotal: Number(accounting.subtotal),
    taxTotal: Number(accounting.taxTotal),
    discountTotal: Number(accounting.discountTotal),
    total: Number(accounting.total)
  };
}

async function queueCreditNote({ order, refund, accounting, transaction }) {
  if (order.EtimsInvoice?.status !== 'transmitted') return null;
  return EtimsCreditNote.create({
    refundId: refund.id,
    orderId: order.id,
    originalInvoiceId: order.EtimsInvoice.id,
    payload: buildCreditNotePayload({ order, refund, accounting })
  }, { transaction });
}

async function processCreditNoteQueue({ tenantId = null } = {}) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await EtimsCreditNote.update(
    { status: 'queued', lockedAt: null, lockToken: null },
    { where: { status: 'processing', lockedAt: { [Op.lt]: staleBefore } } }
  );
  const ids = await sequelize.transaction(async (transaction) => {
    const notes = await EtimsCreditNote.findAll({
      where: {
        status: 'queued',
        [Op.or]: [{ nextAttemptAt: null }, { nextAttemptAt: { [Op.lte]: new Date() } }]
      },
      include: [{ model: Order, required: true, where: tenantId ? { tenantId } : undefined }],
      order: [['createdAt', 'ASC']],
      limit: BATCH_SIZE,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    });
    for (const note of notes) {
      await note.update({ status: 'processing', lockedAt: new Date(), lockToken: crypto.randomUUID() }, { transaction });
    }
    return notes.map((note) => note.id);
  });

  const notes = await EtimsCreditNote.findAll({
    where: { id: ids, status: 'processing' },
    include: [{ model: Order, include: [{ model: Tenant }] }]
  });
  const results = { transmitted: 0, failed: 0, retrying: 0 };
  for (const note of notes) {
    try {
      const config = await resolveTenantConfig(note.Order?.Tenant || note.Order?.tenantId);
      const response = await transmitCreditNote(note.payload, config.etims);
      await note.update({
        status: 'transmitted',
        cuCreditNoteNumber: response.cuCreditNoteNumber,
        responsePayload: response.raw,
        transmittedAt: new Date(),
        nextAttemptAt: null,
        lockedAt: null,
        lockToken: null
      });
      results.transmitted += 1;
    } catch (err) {
      const retryCount = Number(note.retryCount || 0) + 1;
      const failed = retryCount >= MAX_RETRIES;
      await note.update({
        status: failed ? 'failed' : 'queued',
        retryCount,
        nextAttemptAt: failed ? null : new Date(Date.now() + retryDelayMilliseconds(retryCount)),
        lockedAt: null,
        lockToken: null,
        responsePayload: { error: err.message, attemptedAt: new Date().toISOString() }
      });
      results[failed ? 'failed' : 'retrying'] += 1;
    }
  }
  return results;
}

module.exports = { buildCreditNotePayload, processCreditNoteQueue, queueCreditNote };
