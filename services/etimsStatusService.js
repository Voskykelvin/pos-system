const { Op } = require('sequelize');
const { EtimsInvoice, Order } = require('../models');
const { MAX_RETRIES } = require('./etimsSyncWorker');
const { resolveTenantConfig } = require('../utils/tenantConfig');

function orderScope(tenantId, attributes = ['id', 'orderNumber', 'total', 'createdAt', 'tenantId']) {
  const scope = {
    model: Order,
    attributes,
    required: true
  };
  if (tenantId) scope.where = { tenantId };
  return scope;
}

function invoiceError(invoice) {
  const payload = invoice.responsePayload;
  return payload && typeof payload === 'object' ? payload.error || null : null;
}

async function countInvoices(tenantId, where = {}) {
  return EtimsInvoice.count({
    where,
    include: [orderScope(tenantId, [])]
  });
}

function mapInvoice(invoice) {
  return {
    id: invoice.id,
    orderId: invoice.orderId,
    orderNumber: invoice.Order?.orderNumber || null,
    orderTotal: Number(invoice.Order?.total || 0),
    status: invoice.status,
    retryCount: Number(invoice.retryCount || 0),
    maxRetries: MAX_RETRIES,
    cuInvoiceNumber: invoice.cuInvoiceNumber,
    qrCodeUrl: invoice.qrCodeUrl,
    error: invoiceError(invoice),
    queuedAt: invoice.createdAt,
    transmittedAt: invoice.transmittedAt,
    fiscalReady: Boolean(invoice.cuInvoiceNumber && invoice.qrCodeUrl)
  };
}

async function getEtimsStatus({ tenantId = null, includeRecent = false } = {}) {
  const runtimeConfig = await resolveTenantConfig(tenantId);
  const [queued, transmitted, failed, cancelled, retrying, recent] = await Promise.all([
    countInvoices(tenantId, { status: 'queued' }),
    countInvoices(tenantId, { status: 'transmitted' }),
    countInvoices(tenantId, { status: 'failed' }),
    countInvoices(tenantId, { status: 'cancelled' }),
    countInvoices(tenantId, { status: 'queued', retryCount: { [Op.gt]: 0 } }),
    includeRecent
      ? EtimsInvoice.findAll({
          where: {
            [Op.or]: [
              { status: { [Op.in]: ['failed', 'queued'] } },
              { retryCount: { [Op.gt]: 0 } }
            ]
          },
          include: [orderScope(tenantId)],
          order: [['updatedAt', 'DESC']],
          limit: 12
        })
      : Promise.resolve([])
  ]);

  const productionMode = String(runtimeConfig.etims.env || '').toLowerCase() === 'production';
  const readiness = {
    env: runtimeConfig.etims.env,
    status: runtimeConfig.etims.status,
    productionMode,
    sellerPinSet: Boolean(runtimeConfig.business.kraPin),
    deviceSerialSet: Boolean(runtimeConfig.etims.deviceSerial),
    baseUrlSet: Boolean(runtimeConfig.etims.baseUrl),
    apiKeySet: Boolean(runtimeConfig.etims.apiKey)
  };

  return {
    summary: {
      queued,
      transmitted,
      failed,
      cancelled,
      retrying,
      total: queued + transmitted + failed + cancelled
    },
    readiness,
    warnings: {
      hasPending: queued > 0,
      hasFailed: failed > 0,
      productionBlocked: productionMode && !readiness.sellerPinSet
    },
    recent: recent.map(mapInvoice)
  };
}

module.exports = { getEtimsStatus, mapInvoice };
