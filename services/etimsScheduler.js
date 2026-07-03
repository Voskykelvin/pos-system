const cron = require('node-cron');
const { processQueue } = require('./etimsSyncWorker');

let isRunning = false;

function startEtimsScheduler() {
  // Every minute. Adjust if KRA rate-limits or you want a slower cadence.
  cron.schedule('* * * * *', async () => {
    // Prevent overlapping runs if one batch takes longer than a minute
    if (isRunning) return;
    isRunning = true;

    try {
      const results = await processQueue();
      if (results.transmitted || results.failed) {
        console.log(
          `eTIMS sync: ${results.transmitted} transmitted, ${results.failed} failed, ${results.skipped} still queued`
        );
      }
    } catch (err) {
      console.error('eTIMS scheduler error:', err.message);
    } finally {
      isRunning = false;
    }
  });

  console.log('eTIMS sync scheduler started (runs every minute)');
}

module.exports = { startEtimsScheduler };
