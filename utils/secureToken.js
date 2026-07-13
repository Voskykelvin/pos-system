'use strict';

const crypto = require('crypto');

function constantTimeTokenMatch(expectedValue, providedValue) {
  const expected = Buffer.from(String(expectedValue || ''));
  const provided = Buffer.from(String(providedValue || ''));
  return expected.length > 0 && expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

module.exports = { constantTimeTokenMatch };
