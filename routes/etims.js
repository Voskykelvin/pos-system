const express = require('express');
const router = express.Router();
const { processQueue, requeueFailed } = require('../services/etimsSyncWorker');

// POST /api/etims/sync - manually trigger a sync batch, useful for testing
router.post('/sync', async (req, res) => {
  try {
    const results = await processQueue();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/etims/requeue-failed - retry invoices that hit max retries
router.post('/requeue-failed', async (req, res) => {
  try {
    const result = await requeueFailed();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
