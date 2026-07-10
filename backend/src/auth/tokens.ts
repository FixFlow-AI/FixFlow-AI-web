import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import type { User, UserRole } from '../services/userRepository.js';

/**
 * JWT issuance and verification.
 *
 * - Access token: short-lived JWT signed with JWT_SECRET (default 30m).
 *   Carries identity claims only; stateless verification.
 * - Refresh token: opaque random string; its SHA-256 hash is persisted in the
 *   user record so it can be revoked individually or wholesale on logout.
 *
 * All TTLs and the issuer/audience labels are env-driven.
 */

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '30m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';
const ISSUER = process.env.JWT_ISSUER || 'fixflowai';
const AUDIENCE = process.env.JWT_AUDIENCE || 'fixflowai-clients';

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    console.error(
      '[JWT] ❌ JWT_SECRET is missing or too short (got length:', s?.length ?? 0, ').',
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
      'Then set it in backend/.env',
    );
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  return s;
}

export interface AccessTokenClaims {
  sub: string;          // userId
  email: string;
  role: UserRole;
  name?: string;
}

export interface VerifiedAccessClaims extends Omit<JwtPayload, 'sub'>, AccessTokenClaims {}

export function signAccessToken(user: Pick<User, 'id' | 'email' | 'role' | 'name'>): string {
  const claims: AccessTokenClaims = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return jwt.sign(claims, getSecret(), {
    expiresIn: ACCESS_TTL as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAccessToken(token: string): VerifiedAccessClaims {
  return jwt.verify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as VerifiedAccessClaims;
}

/**
 * Generates an opaque refresh token. The token itself is returned to the
 * client; only its SHA-256 hash is ever stored server-side.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** TTL in milliseconds, derived from REFRESH_TTL. */
export function refreshTtlMs(): number {
  // Tiny duration parser: supports "30m", "12h", "7d", "60s", or raw seconds.
  const s = String(REFRESH_TTL).trim();
  const m = s.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 7 * 24 * 3600 * 1000;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}
