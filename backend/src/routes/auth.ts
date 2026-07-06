import { Router, Request, Response, NextFunction } from 'express';
import { verifyGoogleIdToken } from '../auth/googleOauth.js';
import { verifyGithubCode } from '../auth/githubOauth.js';
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
  type User,
  type UserRepository,
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
// Roles allowed to sign in with each provider (permission matrix, doc 00).
const GOOGLE_ROLES: UserRole[] = ['client', 'developer', 'agency'];
const GITHUB_ROLES: UserRole[] = ['freelancer', 'developer'];

export const authRouter = Router();

/**
 * Issues our tokens for a freshly upserted user and, when the caller supplied a
 * valid `intendedRole` for a brand-new account, applies it. Returns the auth payload.
 */
async function issueSession(
  repo: UserRepository,
  user: User,
  intendedRole: unknown,
  allowedRoles: UserRole[],
) {
  let finalUser = user;
  if (
    typeof intendedRole === 'string' &&
    VALID_ROLES.includes(intendedRole as UserRole) &&
    allowedRoles.includes(intendedRole as UserRole) &&
    intendedRole !== user.role
  ) {
    finalUser = (await repo.updateRole(user.id, intendedRole as UserRole)) ?? user;
  }
  const accessToken = signAccessToken(finalUser);
  const refreshToken = generateRefreshToken();
  await repo.addRefreshTokenHash(finalUser.id, hashRefreshToken(refreshToken));
  return {
    user: publicUser(finalUser),
    accessToken,
    refreshToken,
    refreshTokenExpiresInMs: refreshTtlMs(),
  };
}

authRouter.post(
  '/google',
  asyncRoute(async (req, res) => {
    const { idToken, intendedRole } = req.body ?? {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    // Freelancers must use GitHub — their profile is derived from their code.
    if (intendedRole === 'freelancer') {
      res.status(400).json({
        error: 'Freelancers must sign in with GitHub.',
        code: 'role_requires_github',
      });
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
    res.json(await issueSession(repo, user, intendedRole, GOOGLE_ROLES));
  }),
);

authRouter.post(
  '/github',
  asyncRoute(async (req, res) => {
    const { code, intendedRole, redirectUri } = req.body ?? {};
    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'GitHub authorization code is required.' });
      return;
    }

    let profile;
    try {
      profile = await verifyGithubCode(code, typeof redirectUri === 'string' ? redirectUri : undefined);
    } catch (err) {
      res.status(401).json({
        error: 'GitHub sign-in failed.',
        detail: (err as Error).message,
        code: 'github_exchange_failed',
      });
      return;
    }

    const repo = getUserRepository();
    // Note: profile.accessToken is available here for enqueuing a repo scan
    // (see roles/01). It is intentionally NOT returned to the browser.
    const user = await repo.upsertFromGithubProfile({
      githubUserId: profile.githubUserId,
      githubUsername: profile.githubUsername,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      picture: profile.picture,
    });

    const session = await issueSession(repo, user, intendedRole, GITHUB_ROLES);
    // scanJobId placeholder — wire to the GitHub scan pipeline (roles/01, AIA-03).
    res.json({ ...session, githubUsername: profile.githubUsername });
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
function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    name: u.name,
    picture: u.picture,
    role: u.role,
    authProvider: u.authProvider,
    githubUsername: u.githubUsername,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
