const axios = require('axios');

function buildConfig(config = {}) {
  return {
    env: config.env || process.env.ETIMS_ENV || 'sandbox',
    baseUrl: config.baseUrl || process.env.ETIMS_BASE_URL,
    apiKey: config.apiKey || process.env.ETIMS_API_KEY,
    deviceSerial: config.deviceSerial || process.env.ETIMS_DEVICE_SERIAL
  };
}

/**
 * Sends one invoice payload to KRA eTIMS (VSCU).
 *
 * IMPORTANT: this function's request shape is a placeholder. KRA's actual
 * VSCU technical spec defines exact field names, headers, and auth. Once
 * you complete SI registration on iTax, replace the axios call below with
 * the real endpoint/payload contract. Everything around this function
 * (queueing, retries, status tracking) does not need to change.
 *
 * Must return { success: true, cuInvoiceNumber, qrCodeUrl, raw } on success,
 * or throw an Error on failure so the worker can retry / mark it failed.
 */
async function transmitInvoice(payload, inputConfig = {}) {
  const config = buildConfig(inputConfig);

  if (!config.baseUrl) {
    throw new Error(
      'ETIMS_BASE_URL is not configured. Complete SI registration on iTax first.'
    );
  }
  if (!config.apiKey || !config.deviceSerial) {
    throw new Error('ETIMS_API_KEY and ETIMS_DEVICE_SERIAL must be configured before syncing invoices.');
  }

  const { data } = await axios.post(
    `${config.baseUrl}/invoices`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'X-Device-Serial': config.deviceSerial,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  // Adjust these field lookups to match KRA's real response shape.
  // The worker only marks an invoice transmitted when both customer-facing
  // verification values are available for the printed receipt.
  const qrCodeUrl = data.qrCodeUrl || data.qrUrl || data.qrCode || null;

  if (!data.cuInvoiceNumber) {
    throw new Error('eTIMS response missing cuInvoiceNumber');
  }
  if (!qrCodeUrl) {
    throw new Error('eTIMS response missing qrCodeUrl');
  }

  return {
    success: true,
    cuInvoiceNumber: data.cuInvoiceNumber,
    qrCodeUrl,
    raw: data
  };
}

module.exports = { transmitInvoice };
