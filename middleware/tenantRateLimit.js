'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Per-Tenant Rate Limiter Middleware
 *
 * Enforces per-store request quotas (300 req/min per tenantId)
 * to prevent a single mega-store from overwhelming server CPU/DB IOPS.
 */
const tenantApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 300, // max 300 API calls per minute per store
  keyGenerator: (req) => {
    return req.tenantId || req.ip;
  },
  validate: { xForwardedForHeader: false, default: false },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Your store has exceeded the API request limit (300 req/min). Please try again in a moment.' }
});

module.exports = { tenantApiLimiter };
