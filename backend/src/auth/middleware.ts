import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, VerifiedAccessClaims } from './tokens.js';

/**
 * Authentication middleware.
 *
 * `requireAuth` enforces a valid access token on protected routes.
 * `optionalAuth` attaches `req.auth` when a token is present but never fails.
 *
 * Attach to an Express route with `app.get('/api/private', requireAuth, handler)`.
 */

// Augment the Express Request type so handlers can read `req.auth`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: VerifiedAccessClaims;
    }
  }
}

function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    console.error(
      '[AuthMiddleware] ❌ Missing Authorization header.',
      'Method:', req.method, '| Path:', req.originalUrl,
      '| Headers present:', Object.keys(req.headers).join(', '),
    );
    res.status(401).json({ error: 'Missing Authorization: Bearer <token>.' });
    return;
  }
  try {
    req.auth = verifyAccessToken(token);
    console.log('[AuthMiddleware] ✅ Token verified. userId:', req.auth.sub, '| role:', req.auth.role, '| path:', req.originalUrl);
    next();
  } catch (err) {
    console.error(
      '[AuthMiddleware] ❌ Token verification failed.',
      'Path:', req.originalUrl,
      '| Error:', (err as Error).message,
      '| Token length:', token.length,
    );
    res.status(401).json({
      error: 'Invalid or expired access token.',
      detail: (err as Error).message,
    });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) return next();
  try {
    req.auth = verifyAccessToken(token);
  } catch {
    // Silently ignore — caller wanted "optional".
  }
  next();
}
