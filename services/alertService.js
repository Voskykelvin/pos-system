'use strict';

const logger = require('../utils/logger');
const recentAlerts = new Map();

function clean(value, limit = 500) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, limit);
}

function shouldDispatch(key, now = Date.now()) {
  const windowMs = Number(process.env.ALERT_DEDUPE_WINDOW_MS || 300000);
  const previous = recentAlerts.get(key);
  if (previous && now - previous < windowMs) return false;
  recentAlerts.set(key, now);
  if (recentAlerts.size > 500) {
    for (const [storedKey, timestamp] of recentAlerts) {
      if (now - timestamp >= windowMs) recentAlerts.delete(storedKey);
    }
  }
  return true;
}

async function sendOperationalAlert({ severity = 'error', title, message, context = {}, dedupeKey }) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return { sent: false, reason: 'not_configured' };

  const key = dedupeKey || `${severity}:${title}:${message}`;
  if (!shouldDispatch(key)) return { sent: false, reason: 'deduplicated' };

  const contextLines = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 12)
    .map(([name, value]) => `*${clean(name, 40)}:* ${clean(value)}`);
  const payload = {
    text: [
      `[${clean(severity, 20).toUpperCase()}] *${clean(title, 120)}*`,
      clean(message, 1000),
      `*Environment:* ${clean(process.env.NODE_ENV || 'development')}`,
      `*Timestamp:* ${new Date().toISOString()}`,
      ...contextLines
    ].join('\n')
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(process.env.ALERT_TIMEOUT_MS || 5000))
    });
    if (!res.ok) {
      logger.warn('Failed to dispatch alert webhook', { status: res.status });
      return { sent: false, reason: 'webhook_failed', status: res.status };
    }
    return { sent: true };
  } catch (alertErr) {
    logger.error('Failed to send alert webhook', alertErr);
    return { sent: false, reason: 'request_failed' };
  }
}

async function sendErrorAlert(err, context = {}) {
  const message = err?.message || String(err);
  return sendOperationalAlert({
    severity: 'error',
    title: 'Unhandled application error',
    message,
    context: {
      requestId: context.requestId,
      path: `${context.method || ''} ${context.url || ''}`.trim(),
      userId: context.userId,
      tenantId: context.tenantId
    },
    dedupeKey: `unhandled:${message}:${context.method || ''}:${context.url || ''}`
  });
}

function resetAlertDedupeForTests() {
  recentAlerts.clear();
}

module.exports = { sendErrorAlert, sendOperationalAlert, resetAlertDedupeForTests };
