import { Router, Request, Response, NextFunction } from 'express';
import { verifyGoogleIdToken } from '../auth/googleOauth.js';
import {
  signAccessToken,
  generateRefreshToken,
  refreshTtlMs,
} from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';
import {
  getUserRepository,
  hashRefreshToken,
  type UserRole,
} from '../services/userRepository.js';

/**
 * Authentication routes.
 *
 *  POST   /api/auth/google     — exchange a Google ID token for our access+refresh
 *  POST   /api/auth/refresh    — exchange a refresh token for a new access token
 *  POST   /api/auth/logout     — revoke one refresh token (this device)
 *  POST   /api/auth/logout-all — revoke every active refresh token (all devices)
 *  GET    /api/auth/me         — return the authenticated user
 *  PATCH  /api/auth/me/role    — change the authenticated user's role
 *
 * Refresh tokens are opaque; only their SHA-256 hashes are stored in the user
 * record. Access tokens are stateless JWTs (HS256) signed with JWT_SECRET.
 */

const asyncRoute =
  (h: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    h(req, res).catch(next);

const VALID_ROLES: UserRole[] = ['client', 'freelancer', 'agency', 'developer'];

export const authRouter = Router();

authRouter.post(
  '/google',
  asyncRoute(async (req, res) => {
    const { idToken } = req.body ?? {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    let profile;
    try {
      profile = await verifyGoogleIdToken(idToken);
    } catch (err) {
      res.status(401).json({
        error: 'Google ID token verification failed.',
        detail: (err as Error).message,
      });
      return;
    }

    if (!profile.emailVerified) {
      res.status(403).json({ error: 'Google account email is not verified.' });
      return;
    }

    const repo = getUserRepository();
    const user = await repo.upsertFromGoogleProfile(profile);

    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken();
    await repo.addRefreshTokenHash(user.id, hashRefreshToken(refreshToken));

    res.json({
      user: publicUser(user),
      accessToken,
      refreshToken,
      refreshTokenExpiresInMs: refreshTtlMs(),
    });
  }),
);

authRouter.post(
  '/refresh',
  asyncRoute(async (req, res) => {
    const { refreshToken, userId } = req.body ?? {};
    if (typeof refreshToken !== 'string' || typeof userId !== 'string') {
      res.status(400).json({ error: 'refreshToken and userId are required.' });
      return;
    }
    const repo = getUserRepository();
    const user = await repo.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'Unknown user.' });
      return;
    }
    const hash = hashRefreshToken(refreshToken);
    if (!user.refreshTokenHashes.includes(hash)) {
      res.status(401).json({ error: 'Refresh token not recognised.' });
      return;
    }
    // Rotate: revoke the old hash, issue a new one. Defends against replay if
    // the refresh token ever leaks.
    await repo.removeRefreshTokenHash(user.id, hash);
    const newRefresh = generateRefreshToken();
    await repo.addRefreshTokenHash(user.id, hashRefreshToken(newRefresh));
    const accessToken = signAccessToken(user);
    res.json({
      accessToken,
      refreshToken: newRefresh,
      refreshTokenExpiresInMs: refreshTtlMs(),
    });
  }),
);

authRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    const { refreshToken, userId } = req.body ?? {};
    if (typeof refreshToken !== 'string' || typeof userId !== 'string') {
      res.status(400).json({ error: 'refreshToken and userId are required.' });
      return;
    }
    await getUserRepository().removeRefreshTokenHash(
      userId,
      hashRefreshToken(refreshToken),
    );
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/logout-all',
  requireAuth,
  asyncRoute(async (req, res) => {
    await getUserRepository().clearRefreshTokens(req.auth!.sub);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await getUserRepository().findById(req.auth!.sub);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me/role',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { role } = req.body ?? {};
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    const updated = await getUserRepository().updateRole(req.auth!.sub, role);
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: publicUser(updated) });
  }),
);

authRouter.post(
  '/dev-login',
  asyncRoute(async (req, res) => {
    const email = req.body?.email || 'dev-tester@fixflow.ai';
    const name = req.body?.name || 'Dev Tester';
    const profile = {
      googleSub: 'dev-sub-123456',
      email,
      emailVerified: true,
      name,
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    };
    const repo = getUserRepository();
    const user = await repo.upsertFromGoogleProfile(profile);

    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken();
    await repo.addRefreshTokenHash(user.id, hashRefreshToken(refreshToken));

    res.json({
      user: publicUser(user),
      accessToken,
      refreshToken,
      refreshTokenExpiresInMs: refreshTtlMs(),
    });
  }),
);

/** Strip private fields (refresh-token hashes) from outgoing user payloads. */
function publicUser(u: {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    name: u.name,
    picture: u.picture,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
