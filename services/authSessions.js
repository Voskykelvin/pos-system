const crypto = require('crypto');
const { Op } = require('sequelize');
const { AuthSession } = require('../models');
const { createAuthToken } = require('../utils/authToken');

function tokenHash(sessionSecret) {
  return crypto.createHash('sha256').update(sessionSecret).digest('hex');
}

function ttlMilliseconds() {
  const hours = Number(process.env.AUTH_TOKEN_TTL_HOURS || 12);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error('AUTH_TOKEN_TTL_HOURS must be a positive number');
  }
  return hours * 60 * 60 * 1000;
}

async function issueAuthSession(user, req = null) {
  const sessionSecret = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMilliseconds());
  await AuthSession.create({
    userId: user.id,
    tokenHash: tokenHash(sessionSecret),
    userAgent: req?.get?.('user-agent')?.slice(0, 500) || null,
    ipAddress: req?.ip?.slice(0, 64) || null,
    expiresAt
  });
  return createAuthToken(user, { sessionId: sessionSecret, expiresAt });
}

async function findActiveSession(payload) {
  if (!payload.sid) return null;
  return AuthSession.findOne({
    where: {
      userId: payload.sub,
      tokenHash: tokenHash(payload.sid),
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() }
    }
  });
}

async function revokeSession(payload) {
  if (!payload?.sid) return 0;
  const [count] = await AuthSession.update(
    { revokedAt: new Date() },
    { where: { userId: payload.sub, tokenHash: tokenHash(payload.sid), revokedAt: null } }
  );
  return count;
}

async function revokeAllUserSessions(userId) {
  const [count] = await AuthSession.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  );
  return count;
}

module.exports = {
  findActiveSession,
  issueAuthSession,
  revokeAllUserSessions,
  revokeSession,
  tokenHash
};
