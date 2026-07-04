const axios = require('axios');

function mpesaBaseUrl(env = 'sandbox') {
  return env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function buildConfig(config = {}) {
  return {
    env: config.env || process.env.MPESA_ENV || 'sandbox',
    consumerKey: config.consumerKey || process.env.MPESA_CONSUMER_KEY,
    consumerSecret: config.consumerSecret || process.env.MPESA_CONSUMER_SECRET,
    shortcode: config.shortcode || process.env.MPESA_SHORTCODE,
    passkey: config.passkey || process.env.MPESA_PASSKEY,
    callbackUrl: config.callbackUrl || process.env.MPESA_CALLBACK_URL
  };
}

function requireConfig(config) {
  for (const key of ['consumerKey', 'consumerSecret', 'shortcode', 'passkey', 'callbackUrl']) {
    if (!config[key]) {
      throw new Error(`M-Pesa ${key} is not configured`);
    }
  }
}

// Daraja tokens are valid about 1 hour. Cache per credential pair so tenants
// with separate credentials do not reuse each other's token.
const tokenCache = new Map();

async function getAccessToken(inputConfig) {
  const config = buildConfig(inputConfig);
  requireConfig(config);
  const baseUrl = mpesaBaseUrl(config.env);
  const cacheKey = `${baseUrl}:${config.consumerKey}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString('base64');

  const { data } = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  const token = data.access_token;
  const expiresAt = Date.now() + (Number(data.expires_in) - 60) * 1000;
  tokenCache.set(cacheKey, { token, expiresAt });

  return token;
}

function generateTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function generatePassword(timestamp, config) {
  return Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString(
    'base64'
  );
}

// Normalizes local formats (07..., +2547...) to the 2547XXXXXXXX format Daraja expects
function normalizePhone(phone) {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = `254${p.slice(1)}`;
  if (p.startsWith('7') || p.startsWith('1')) p = `254${p}`;
  return p;
}

/**
 * Initiates an STK push (Lipa Na M-Pesa Online) to the customer's phone.
 * Returns Safaricom's immediate acknowledgement, NOT the payment result.
 * The actual result arrives later at the callback URL.
 */
async function initiateStkPush({ phone, amount, accountReference, transactionDesc, config: inputConfig }) {
  const config = buildConfig(inputConfig);
  requireConfig(config);
  const token = await getAccessToken(config);
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp, config);
  const baseUrl = mpesaBaseUrl(config.env);

  const { data } = await axios.post(
    `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: normalizePhone(phone),
      PartyB: config.shortcode,
      PhoneNumber: normalizePhone(phone),
      CallBackURL: config.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // data contains: MerchantRequestID, CheckoutRequestID, ResponseCode,
  // ResponseDescription, CustomerMessage
  return data;
}

module.exports = { initiateStkPush, normalizePhone };
