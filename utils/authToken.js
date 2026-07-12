const crypto = require('crypto');

const DEFAULT_TTL_HOURS = 12;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input) {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_TOKEN_SECRET is required in production');
  }
  return secret || 'dev-only-change-me';
}

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function createAuthToken(user, { sessionId = null, expiresAt = null } = {}) {
  const ttlHours = Number(process.env.AUTH_TOKEN_TTL_HOURS || DEFAULT_TTL_HOURS);
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
    throw new Error('AUTH_TOKEN_TTL_HOURS must be a positive number');
  }
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name,
    tenantId: user.tenantId || null,
    exp: expiresAt
      ? Math.floor(new Date(expiresAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + ttlHours * 60 * 60
  };
  if (sessionId) payload.sid = sessionId;

  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function assertAuthTokenConfig() {
  getSecret();
}

function verifyAuthToken(token) {
  if (!token || !token.includes('.')) {
    throw new Error('Invalid auth token');
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid auth token');
  }
  const [encoded, signature] = parts;
  const expected = sign(encoded);
  const actual = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);

  if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    throw new Error('Invalid auth token');
  }

  const payload = JSON.parse(fromBase64url(encoded));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Auth token expired');
  }

  return payload;
}

module.exports = { assertAuthTokenConfig, createAuthToken, verifyAuthToken };
