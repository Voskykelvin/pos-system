const crypto = require('crypto');
const { Op } = require('sequelize');
const { AuthSession, User } = require('../models');
const { createAuthToken } = require('../utils/authToken');

function tokenHash(sessionSecret) {
  return crypto.createHash('sha256').update(sessionSecret).digest('hex');
}

function accessTtlMilliseconds() {
  const minutes = Number(process.env.AUTH_ACCESS_TTL_MINUTES || 15);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('AUTH_ACCESS_TTL_MINUTES must be positive');
  return minutes * 60 * 1000;
}

function refreshTtlMilliseconds() {
  const days = Number(process.env.AUTH_REFRESH_TTL_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) throw new Error('AUTH_REFRESH_TTL_DAYS must be positive');
  return days * 86400000;
}

async function issueAuthSession(user, req = null) {
  const sessionSecret = crypto.randomBytes(32).toString('base64url');
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + refreshTtlMilliseconds());
  await AuthSession.create({
    userId: user.id,
    tokenHash: tokenHash(sessionSecret),
    userAgent: req?.get?.('user-agent')?.slice(0, 500) || null,
    ipAddress: req?.ip?.slice(0, 64) || null,
    expiresAt,
    refreshTokenHash: tokenHash(refreshToken),
    refreshExpiresAt: expiresAt
  });
  return {
    accessToken: createAuthToken(user, {
      sessionId: sessionSecret,
      expiresAt: new Date(Date.now() + accessTtlMilliseconds())
    }),
    refreshToken,
    refreshExpiresAt: expiresAt
  };
}

async function rotateRefreshToken(refreshToken) {
  if (!refreshToken) return null;
  const session = await AuthSession.findOne({
    where: {
      refreshTokenHash: tokenHash(refreshToken),
      revokedAt: null,
      refreshExpiresAt: { [Op.gt]: new Date() }
    }
  });
  if (!session) return null;
  const user = await User.findByPk(session.userId);
  if (!user?.isActive) return null;
  const sessionSecret = crypto.randomBytes(32).toString('base64url');
  const nextRefreshToken = crypto.randomBytes(48).toString('base64url');
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMilliseconds());
  await session.update({
    tokenHash: tokenHash(sessionSecret),
    refreshTokenHash: tokenHash(nextRefreshToken),
    refreshExpiresAt,
    expiresAt: refreshExpiresAt,
    lastSeenAt: new Date()
  });
  return {
    accessToken: createAuthToken(user, {
      sessionId: sessionSecret,
      expiresAt: new Date(Date.now() + accessTtlMilliseconds())
    }),
    refreshToken: nextRefreshToken,
    refreshExpiresAt
  };
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
  rotateRefreshToken,
  revokeAllUserSessions,
  revokeSession,
  tokenHash
};
