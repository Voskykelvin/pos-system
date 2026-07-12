const express = require('express');
const router = express.Router();
const { processQueue, requeueFailed } = require('../services/etimsSyncWorker');
const { authenticate, requireRoles } = require('../middleware/auth');
const { getEtimsStatus } = require('../services/etimsStatusService');
const { processCreditNoteQueue } = require('../services/etimsCreditNotes');

router.use(authenticate);

router.get('/status', requireRoles('admin', 'manager', 'cashier'), async (req, res) => {
  try {
    const status = await getEtimsStatus({ tenantId: req.tenantId });
    res.json({
      queued: status.summary.queued,
      failed: status.summary.failed,
      retrying: status.summary.retrying,
      transmitted: status.summary.transmitted,
      productionMode: status.readiness.productionMode,
      sellerPinSet: status.readiness.sellerPinSet,
      deviceSerialSet: status.readiness.deviceSerialSet,
      readyForSync: status.readiness.sellerPinSet &&
        status.readiness.deviceSerialSet &&
        status.readiness.baseUrlSet &&
        status.readiness.apiKeySet,
      warnings: status.warnings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(requireRoles('admin', 'manager'));

router.get('/dashboard', async (req, res) => {
  try {
    res.json(await getEtimsStatus({ tenantId: req.tenantId, includeRecent: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/etims/sync - manually trigger a sync batch, useful for testing
router.post('/sync', async (req, res) => {
  try {
    const results = await processQueue({ tenantId: req.tenantId || null });
    const creditNotes = await processCreditNoteQueue({ tenantId: req.tenantId || null });
    res.json({ ...results, creditNotes });
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
