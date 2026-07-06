'use strict';

const logger = require('../utils/logger');

const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 1000);

function responseTimeMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = Number((diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2));

    const logData = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      tenantId: req.tenantId || null,
      userId: req.userId || null
    };

    if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(`Slow request detected: ${req.method} ${logData.url} took ${duration}ms`, logData);
    } else if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REQUEST_LOGGING === 'true') {
      logger.info(`${req.method} ${logData.url} - ${res.statusCode} in ${duration}ms`, logData);
    }
  });

  next();
}

module.exports = { responseTimeMiddleware };
