const cron = require('node-cron');
const { Op } = require('sequelize');
const { AuthSession, MpesaCallbackEvent } = require('../models');
const logger = require('../utils/logger');

async function runRetentionCleanup(now = new Date()) {
  const sessionCutoff = new Date(now.getTime() - Number(process.env.SESSION_RETENTION_DAYS || 30) * 86400000);
  const callbackCutoff = new Date(now.getTime() - Number(process.env.CALLBACK_RETENTION_DAYS || 90) * 86400000);
  const sessions = await AuthSession.destroy({
    where: {
      [Op.or]: [
        { expiresAt: { [Op.lt]: sessionCutoff } },
        { revokedAt: { [Op.lt]: sessionCutoff } }
      ]
    }
  });
  const callbacks = await MpesaCallbackEvent.destroy({
    where: {
      status: { [Op.in]: ['processed', 'duplicate', 'payment_failed', 'resolved'] },
      createdAt: { [Op.lt]: callbackCutoff }
    }
  });
  return { sessions, callbacks };
}

function startMaintenanceScheduler() {
  cron.schedule('17 2 * * *', async () => {
    try {
      logger.info('Retention cleanup completed', await runRetentionCleanup());
    } catch (err) {
      logger.error('Retention cleanup failed', err);
    }
  });
  logger.info('Maintenance scheduler started');
}

module.exports = { runRetentionCleanup, startMaintenanceScheduler };
