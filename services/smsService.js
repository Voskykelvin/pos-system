'use strict';

/**
 * SMS Receipt Service
 *
 * Sends a short receipt summary via SMS using the Africa's Talking API.
 * Gracefully no-ops when AFRICASTALKING_API_KEY is not configured so the
 * app runs normally in development without sending real messages.
 *
 * Environment variables:
 *   AFRICASTALKING_API_KEY      - API key from Africa's Talking dashboard
 *   AFRICASTALKING_USERNAME     - username (use 'sandbox' for testing)
 *   AFRICASTALKING_SENDER_ID    - short code or alphanumeric sender (optional)
 *
 * Usage:
 *   const { sendReceipt } = require('./smsService');
 *   await sendReceipt(customerPhone, { orderNumber, total, businessName });
 */

const ENABLED = Boolean(process.env.AFRICASTALKING_API_KEY);

async function sendReceipt(phone, { orderNumber, total, businessName }) {
  if (!ENABLED) {
    // Log the would-be SMS in dev so it's visible during local testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[SMS no-op] To: ${phone} | ` +
        `${businessName}: Receipt ${orderNumber}, Total KES ${Number(total).toFixed(2)}. Thank you!`
      );
    }
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  try {
    // Dynamic import - only requires the HTTP call when credentials are present
    const message =
      `${businessName}: Receipt ${orderNumber}, ` +
      `Total KES ${Number(total).toFixed(2)}. ` +
      `Thank you for shopping with us!`;

    const username = process.env.AFRICASTALKING_USERNAME || 'sandbox';
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const senderId = process.env.AFRICASTALKING_SENDER_ID || '';

    const body = new URLSearchParams({
      username,
      to: phone,
      message,
      ...(senderId ? { from: senderId } : {})
    });

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[SMS] Africa\'s Talking error:', data);
      return { sent: false, reason: data?.SMSMessageData?.Message || 'API error' };
    }

    return { sent: true, data };
  } catch (err) {
    // Never throw - SMS failure must not break checkout
    console.warn('[SMS] Failed to send receipt:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendReceipt, isEnabled: () => ENABLED };
