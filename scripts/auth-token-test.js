const assert = require('assert');
const { assertAuthTokenConfig, createAuthToken, verifyAuthToken } = require('../utils/authToken');

const originalEnv = {
  AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_TOKEN_TTL_HOURS: process.env.AUTH_TOKEN_TTL_HOURS
};

try {
  process.env.AUTH_TOKEN_SECRET = 'test-secret-that-is-not-used-outside-this-process';
  process.env.AUTH_TOKEN_TTL_HOURS = '1';

  const token = createAuthToken({ id: 'user-1', role: 'cashier', name: 'Test User' });
  assert.equal(verifyAuthToken(token).sub, 'user-1');
  assert.throws(() => verifyAuthToken(`${token}.extra`), /Invalid auth token/);
  assert.throws(() => verifyAuthToken(`${token.slice(0, -1)}x`), /Invalid auth token/);

  process.env.AUTH_TOKEN_TTL_HOURS = 'invalid';
  assert.throws(
    () => createAuthToken({ id: 'user-1', role: 'cashier', name: 'Test User' }),
    /must be a positive number/
  );

  delete process.env.AUTH_TOKEN_SECRET;
  delete process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';
  assert.throws(() => assertAuthTokenConfig(), /required in production/);

  // eslint-disable-next-line no-console
  console.log('Auth token smoke passed');
} finally {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
