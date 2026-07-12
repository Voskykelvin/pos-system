const cron = require('node-cron');
const { processQueue } = require('./etimsSyncWorker');
const { processCreditNoteQueue } = require('./etimsCreditNotes');
const logger = require('../utils/logger');

let isRunning = false;

function startEtimsScheduler() {
  // Every minute. Adjust if KRA rate-limits or you want a slower cadence.
  cron.schedule('* * * * *', async () => {
    // Prevent overlapping runs if one batch takes longer than a minute
    if (isRunning) return;
    isRunning = true;

    try {
      const results = await processQueue();
      const creditNotes = await processCreditNoteQueue();
      if (results.transmitted || results.failed) {
        logger.info(
          `eTIMS sync: ${results.transmitted} transmitted, ${results.failed} failed, ${results.skipped} still queued`,
          results
        );
      }
      if (creditNotes.transmitted || creditNotes.failed || creditNotes.retrying) {
        logger.info('eTIMS credit-note sync', creditNotes);
      }
    } catch (err) {
      logger.error('eTIMS scheduler error', err);
    } finally {
      isRunning = false;
    }
  });

  logger.info('eTIMS sync scheduler started (runs every minute)');
}

module.exports = { startEtimsScheduler };
