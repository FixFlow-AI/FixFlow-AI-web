const crypto = require('crypto');
const Session = require('../../models/Session');
const { env } = require('../../config/env');
const { serializeCookie } = require('../../utils/cookies');
const { UnauthorizedError } = require('../../utils/errors');
const { getClientIp } = require('../audit/auditService');

const REFRESH_COOKIE_NAME = 'ff_refresh';
const CSRF_COOKIE_NAME = 'ff_csrf';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function parseRefreshToken(token) {
  const [sessionId, secret] = String(token || '').split('.');
  if (!sessionId || !secret) {
    throw new UnauthorizedError('Invalid refresh token');
  }
  return { sessionId, secret };
}

function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function expiryToSeconds(value = '7d') {
  const match = String(value || '').match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  return amount * 24 * 60 * 60;
}

function buildCookieOptions(maxAgeSeconds = expiryToSeconds(env.JWT_REFRESH_EXPIRY)) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/api/auth',
    maxAge: maxAgeSeconds,
  };
}

function setRefreshCookie(res, refreshToken) {
  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAME, refreshToken, buildCookieOptions()));
}

function clearRefreshCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAME, '', {
    ...buildCookieOptions(0),
    expires: new Date(0),
  }));
}

async function createSession(user, req) {
  const secret = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + expiryToSeconds(env.JWT_REFRESH_EXPIRY) * 1000).toISOString();
  const session = await Session.create({
    userId: user._id.toString(),
    refreshTokenHash: hashToken(secret),
    userAgent: req?.headers?.['user-agent'] || '',
    ipAddress: req ? getClientIp(req) : '',
    expiresAt,
    lastUsedAt: new Date().toISOString(),
  });

  return {
    session,
    refreshToken: `${session._id}.${secret}`,
  };
}

async function verifyRefreshSession(refreshToken) {
  const { sessionId, secret } = parseRefreshToken(refreshToken);
  const session = await Session.findById(sessionId);
  if (!session || session.revokedAt) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    session.revokedAt = new Date().toISOString();
    await session.save();
    throw new UnauthorizedError('Refresh token expired');
  }

  const incomingHash = hashToken(secret);
  if (!timingSafeEqualHex(incomingHash, session.refreshTokenHash)) {
    session.replayDetectedAt = new Date().toISOString();
    session.revokedAt = session.replayDetectedAt;
    await session.save();
    throw new UnauthorizedError('Invalid refresh token');
  }

  return session;
}

async function rotateRefreshSession(session, req) {
  const secret = crypto.randomBytes(48).toString('base64url');
  session.refreshTokenHash = hashToken(secret);
  session.lastUsedAt = new Date().toISOString();
  session.userAgent = req?.headers?.['user-agent'] || session.userAgent || '';
  session.ipAddress = req ? getClientIp(req) : session.ipAddress || '';
  await session.save();
  return `${session._id}.${secret}`;
}

async function revokeSession(sessionId) {
  if (!sessionId) return null;
  const session = await Session.findById(sessionId);
  if (!session || session.revokedAt) return session;
  session.revokedAt = new Date().toISOString();
  await session.save();
  return session;
}

function getRefreshTokenFromRequest(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || '';
}

function createCsrfToken(sessionId = '') {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const payload = `${Date.now()}.${sessionId}.${nonce}`;
  const signature = crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyCsrfToken(token = '') {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return false;
  const payload = parts.slice(0, 3).join('.');
  const signature = parts[3];
  const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = {
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  createCsrfToken,
  createSession,
  getRefreshTokenFromRequest,
  revokeSession,
  rotateRefreshSession,
  setRefreshCookie,
  verifyCsrfToken,
  verifyRefreshSession,
};
