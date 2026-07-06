const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { EtimsInvoice, Order } = require('../models');
const { processQueue, requeueFailed, MAX_RETRIES } = require('../services/etimsSyncWorker');
const { authenticate, requireRoles } = require('../middleware/auth');
const { resolveTenantConfig } = require('../utils/tenantConfig');

router.use(authenticate, requireRoles('admin', 'manager'));

function orderScope(req) {
  const scope = {
    model: Order,
    attributes: ['id', 'orderNumber', 'total', 'createdAt', 'tenantId'],
    required: true
  };
  if (req.tenantId) scope.where = { tenantId: req.tenantId };
  return scope;
}

function invoiceError(invoice) {
  const payload = invoice.responsePayload;
  return payload && typeof payload === 'object' ? payload.error || null : null;
}

async function countInvoices(req, where = {}) {
  return EtimsInvoice.count({
    where,
    include: [orderScope(req)]
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

router.get('/dashboard', async (req, res) => {
  try {
    const runtimeConfig = await resolveTenantConfig(req.tenantId);
    const [queued, transmitted, failed, cancelled, retrying, recent] = await Promise.all([
      countInvoices(req, { status: 'queued' }),
      countInvoices(req, { status: 'transmitted' }),
      countInvoices(req, { status: 'failed' }),
      countInvoices(req, { status: 'cancelled' }),
      countInvoices(req, { status: 'queued', retryCount: { [Op.gt]: 0 } }),
      EtimsInvoice.findAll({
        where: {
          [Op.or]: [
            { status: { [Op.in]: ['failed', 'queued'] } },
            { retryCount: { [Op.gt]: 0 } }
          ]
        },
        include: [orderScope(req)],
        order: [['updatedAt', 'DESC']],
        limit: 12
      })
    ]);

    res.json({
      summary: {
        queued,
        transmitted,
        failed,
        cancelled,
        retrying,
        total: queued + transmitted + failed + cancelled
      },
      readiness: {
        env: runtimeConfig.etims.env,
        status: runtimeConfig.etims.status,
        productionMode: String(runtimeConfig.etims.env || '').toLowerCase() === 'production',
        sellerPinSet: Boolean(runtimeConfig.business.kraPin),
        deviceSerialSet: Boolean(runtimeConfig.etims.deviceSerial),
        baseUrlSet: Boolean(runtimeConfig.etims.baseUrl),
        apiKeySet: Boolean(runtimeConfig.etims.apiKey)
      },
      recent: recent.map(mapInvoice)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/etims/sync - manually trigger a sync batch, useful for testing
router.post('/sync', async (req, res) => {
  try {
    const results = await processQueue({ tenantId: req.tenantId || null });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/etims/requeue-failed - retry invoices that hit max retries
router.post('/requeue-failed', async (req, res) => {
  try {
    const result = await requeueFailed({ tenantId: req.tenantId || null });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
