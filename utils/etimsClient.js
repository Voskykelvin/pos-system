const axios = require('axios');

const {
  ETIMS_ENV = 'sandbox',
  ETIMS_BASE_URL,       // set once you have your KRA VSCU endpoint
  ETIMS_API_KEY,        // or whatever auth scheme your SI credentials use
  ETIMS_DEVICE_SERIAL   // the CU/device identifier issued during SI registration
} = process.env;

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
async function transmitInvoice(payload) {
  if (!ETIMS_BASE_URL) {
    throw new Error(
      'ETIMS_BASE_URL is not configured. Complete SI registration on iTax first.'
    );
  }

  const { data } = await axios.post(
    `${ETIMS_BASE_URL}/invoices`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${ETIMS_API_KEY}`,
        'X-Device-Serial': ETIMS_DEVICE_SERIAL,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  // Adjust these field lookups to match KRA's real response shape
  if (!data.cuInvoiceNumber) {
    throw new Error('eTIMS response missing cuInvoiceNumber');
  }

  return {
    success: true,
    cuInvoiceNumber: data.cuInvoiceNumber,
    qrCodeUrl: data.qrCodeUrl || null,
    raw: data
  };
}

module.exports = { transmitInvoice };
