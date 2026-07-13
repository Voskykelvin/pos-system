'use strict';

const logger = require('../utils/logger');
const { sendOperationalAlert } = require('./alertService');

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server?.listening) return resolve();
    server.close(() => resolve());
  });
}

function installProcessLifecycle({ server, sequelize, processRef = process }) {
  let shuttingDown = false;
  const timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);

  async function shutdown(reason, exitCode = 0, error = null) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Graceful shutdown started', { reason, exitCode });

    if (error) {
      await sendOperationalAlert({
        severity: 'critical',
        title: 'Jijenge POS process failure',
        message: error.message || String(error),
        context: { reason },
        dedupeKey: `process:${reason}:${error.message || String(error)}`
      });
    }

    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out', new Error(`Exceeded ${timeoutMs}ms`));
      processRef.exit(1);
    }, timeoutMs);
    timeout.unref?.();

    try {
      await closeServer(server);
      await sequelize?.close();
      clearTimeout(timeout);
      logger.info('Graceful shutdown completed', { reason });
      processRef.exit(exitCode);
    } catch (shutdownError) {
      clearTimeout(timeout);
      logger.error('Graceful shutdown failed', shutdownError, { reason });
      processRef.exit(1);
    }
  }

  const onSigterm = () => shutdown('SIGTERM');
  const onSigint = () => shutdown('SIGINT');
  const onUnhandledRejection = (reason) => shutdown(
    'unhandledRejection',
    1,
    reason instanceof Error ? reason : new Error(String(reason))
  );
  const onUncaughtException = (error) => shutdown('uncaughtException', 1, error);

  processRef.once('SIGTERM', onSigterm);
  processRef.once('SIGINT', onSigint);
  processRef.once('unhandledRejection', onUnhandledRejection);
  processRef.once('uncaughtException', onUncaughtException);

  return { shutdown };
}

module.exports = { closeServer, installProcessLifecycle };
