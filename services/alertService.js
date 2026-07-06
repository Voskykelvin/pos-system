'use strict';

const logger = require('../utils/logger');

async function sendErrorAlert(err, context = {}) {
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const payload = {
      text: `🚨 *Jijenge POS Unhandled Error Alert* 🚨\n\n` +
            `*Message:* ${err.message || String(err)}\n` +
            `*Environment:* ${process.env.NODE_ENV || 'development'}\n` +
            `*Timestamp:* ${new Date().toISOString()}\n` +
            `*Request ID:* ${context.requestId || 'N/A'}\n` +
            `*Path:* ${context.method || ''} ${context.url || ''}\n` +
            `*User ID:* ${context.userId || 'N/A'}\n` +
            `*Tenant ID:* ${context.tenantId || 'N/A'}\n` +
            `*Stack Trace:*\n\`\`\`\n${(err.stack || '').slice(0, 1000)}\n\`\`\``
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`Failed to dispatch alert webhook. Status: ${res.status}. Body: ${body}`);
    }
  } catch (alertErr) {
    logger.error('Failed to send error alert webhook', alertErr);
  }
}

module.exports = { sendErrorAlert };
