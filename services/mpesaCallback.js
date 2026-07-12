const crypto = require('crypto');

function callbackPayloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
}

function validateCallbackAmount(received, expected) {
  const paidAmount = Number(received);
  const expectedAmount = Number(expected);
  if (!Number.isFinite(paidAmount) || !Number.isFinite(expectedAmount)) {
    return { valid: false, paidAmount, expectedAmount };
  }
  return {
    valid: Math.abs(paidAmount - expectedAmount) < 0.001,
    paidAmount,
    expectedAmount
  };
}

module.exports = { callbackPayloadHash, validateCallbackAmount };
