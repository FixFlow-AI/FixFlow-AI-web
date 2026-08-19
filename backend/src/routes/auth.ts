import { Router, Request, Response, NextFunction } from 'express';
import { verifyGoogleIdToken } from '../auth/googleOauth.js';
import { verifyGithubCode } from '../auth/githubOauth.js';
import { isAiServiceConfigured } from '../services/aiClient.js';
import { enqueueGithubScan } from '../services/githubScanService.js';
import { captureProfileSnapshot } from '../services/githubProfileService.js';
import { getGithubScanRepository } from '../services/githubScanRepository.js';
import {
  signAccessToken,
  generateRefreshToken,
  refreshTtlMs,
} from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';
import {
  getUserRepository,
  hashRefreshToken,
  pruneExpiredRefreshTokens,
  type UserRole,
  type User,
  type UserRepository,
} from '../services/userRepository.js';
import { notifyWelcome } from '../services/emailService.js';

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

/**
 * Temporary public-launch gate. Existing accounts always retain their stored
 * role; only genuinely new account creation is restricted. Default-on prevents
 * an omitted production env var from reopening unfinished onboarding paths.
 */
const FREELANCER_ONLY_ONBOARDING =
  process.env.FREELANCER_ONLY_ONBOARDING !== 'false';

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
  isNewUser: boolean,
) {
  let finalUser = user;
  if (
    isNewUser &&
    typeof intendedRole === 'string' &&
    VALID_ROLES.includes(intendedRole as UserRole) &&
    allowedRoles.includes(intendedRole as UserRole) &&
    intendedRole !== user.role
  ) {
    console.log('[AuthRoute] Role change requested during session issuance:', user.role, '->', intendedRole);
    finalUser = (await repo.updateRole(user.id, intendedRole as UserRole)) ?? user;
  }
  const accessToken = signAccessToken(finalUser);
  const refreshToken = generateRefreshToken();
  await repo.addRefreshTokenHash(finalUser.id, hashRefreshToken(refreshToken));
  console.log('[AuthRoute] ✅ Session issued for user:', finalUser.id, '| role:', finalUser.role, '| email:', finalUser.email);
  const roleMismatch = (!isNewUser && typeof intendedRole === 'string' && intendedRole !== finalUser.role)
    ? { requested: intendedRole, existing: finalUser.role }
    : undefined;

  return {
    user: publicUser(finalUser),
    accessToken,
    refreshToken,
    refreshTokenExpiresInMs: refreshTtlMs(),
    isNewUser,
    roleMismatch,
  };
}

authRouter.post(
  '/google',
  asyncRoute(async (req, res) => {
    console.log('[AuthRoute] POST /api/auth/google — Google login attempt');
    const { idToken, intendedRole } = req.body ?? {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
      console.error('[AuthRoute] ❌ Google login: idToken missing or empty. Body keys:', Object.keys(req.body ?? {}));
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }
    console.log('[AuthRoute]   idToken length:', idToken.length, '| intendedRole:', intendedRole ?? '(not provided)');

    // Freelancers must use GitHub — their profile is derived from their code.
    if (intendedRole === 'freelancer') {
      console.error('[AuthRoute] ❌ Google login rejected: freelancer role requires GitHub sign-in, not Google.');
      res.status(400).json({
        error: 'Freelancers must sign in with GitHub.',
        code: 'role_requires_github',
      });
      return;
    }

    let profile;
    try {
      profile = await verifyGoogleIdToken(idToken);
      console.log('[AuthRoute]   ✅ Google ID token verified. email:', profile.email, '| sub:', profile.googleSub);
    } catch (err) {
      console.error('[AuthRoute] ❌ Google ID token verification failed:', (err as Error).message);
      res.status(401).json({
        error: 'Google ID token verification failed.',
        detail: (err as Error).message,
      });
      return;
    }

    if (!profile.emailVerified) {
      console.error('[AuthRoute] ❌ Google account email is not verified. email:', profile.email);
      res.status(403).json({ error: 'Google account email is not verified.' });
      return;
    }

    const repo = getUserRepository();
    // Provider-id lookup is authoritative. Verified-email lookup preserves a
    // grandfathered account when the same person uses another OAuth provider.
    const existingByProvider = await repo.findByGoogleSub(profile.googleSub);
    const existing = existingByProvider ?? await repo.findByEmail(profile.email);
    const isNewUser = !existing;

    if (FREELANCER_ONLY_ONBOARDING && isNewUser) {
      console.log('[AuthRoute] New Google signup deferred during freelancer-only launch. email:', profile.email);
      res.status(403).json({
        error: 'Client, agency, and developer onboarding is coming soon. New accounts can currently join as freelancers with GitHub.',
        code: 'freelancer_onboarding_only',
      });
      return;
    }

    const user = await repo.upsertFromGoogleProfile(profile);
    console.log('[AuthRoute]   ✅ User upserted from Google. userId:', user.id, '| role:', user.role);
    // Existing users retain their stored role. This branch can create users only
    // when launch mode is disabled, in which case the original role matrix applies.
    const session = await issueSession(repo, user, intendedRole, GOOGLE_ROLES, isNewUser);
    if (isNewUser && user.email) {
      notifyWelcome({ name: session.user.name, role: session.user.role as UserRole, email: user.email }, user.email);
    }
    res.json(session);
  }),
);

authRouter.post(
  '/github',
  asyncRoute(async (req, res) => {
    console.log('[AuthRoute] POST /api/auth/github — GitHub login attempt');
    const { code, intendedRole, redirectUri } = req.body ?? {};
    console.log('[AuthRoute]   code:', code ? `${code.slice(0, 8)}... (len ${code.length})` : 'MISSING',
      '| intendedRole:', intendedRole ?? '(not provided)',
      '| redirectUri:', redirectUri ?? '(not provided)',
    );

    if (typeof code !== 'string' || !code.trim()) {
      console.error('[AuthRoute] ❌ GitHub login: authorization code missing or empty. Body keys:', Object.keys(req.body ?? {}));
      res.status(400).json({ error: 'GitHub authorization code is required.' });
      return;
    }

    let profile;
    try {
      profile = await verifyGithubCode(code, typeof redirectUri === 'string' ? redirectUri : undefined);
      console.log('[AuthRoute]   ✅ GitHub code verified. username:', profile.githubUsername, '| userId:', profile.githubUserId);
    } catch (err) {
      console.error('[AuthRoute] ❌ GitHub code→token exchange failed:', (err as Error).message);
      res.status(401).json({
        error: 'GitHub sign-in failed.',
        detail: (err as Error).message,
        code: 'github_exchange_failed',
      });
      return;
    }

    const repo = getUserRepository();
    console.log('[AuthRoute]   Upserting user from GitHub profile...');

    // Brand-newness must match the repository's verified-email linking rule.
    // Otherwise an existing cross-provider account could be merged and then
    // incorrectly treated as new, overwriting its grandfathered role.
    const existingByProvider = await repo.findByGithubUserId(profile.githubUserId);
    const existingByVerifiedEmail =
      !existingByProvider && profile.emailVerified
        ? await repo.findByEmail(profile.email)
        : null;
    const priorUser = existingByProvider ?? existingByVerifiedEmail;
    const isNewUser = !priorUser;

    // Note: profile.accessToken is stored server-side ONLY (stripped by
    // publicUser) so a returning freelancer can re-analyze without re-auth.
    const user = await repo.upsertFromGithubProfile({
      githubUserId: profile.githubUserId,
      githubUsername: profile.githubUsername,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      picture: profile.picture,
      githubAccessToken: profile.accessToken,
    });
    console.log(
      '[AuthRoute]   ✅ User upserted from GitHub. userId:', user.id,
      '| role:', user.role, '| newUser:', isNewUser,
    );

    // During the public freelancer launch, a genuinely new GitHub account is
    // always a freelancer regardless of a tampered client-supplied intendedRole.
    // Existing accounts bypass role mutation inside issueSession.
    const requestedRole = FREELANCER_ONLY_ONBOARDING && isNewUser
      ? 'freelancer'
      : intendedRole;
    const allowedRoles = FREELANCER_ONLY_ONBOARDING && isNewUser
      ? (['freelancer'] as UserRole[])
      : GITHUB_ROLES;
    const session = await issueSession(repo, user, requestedRole, allowedRoles, isNewUser);

    // Fire-and-forget welcome email for brand-new users.
    if (isNewUser && user.email) {
      notifyWelcome({ name: session.user.name, role: session.user.role as UserRole, email: user.email }, user.email);
    }

    // Token hand-off: a deep GitHub scan is enqueued ONLY for a brand-new
    // freelancer account. The access token is used only server-side and is never
    // returned to the browser. Failure never blocks login.
    let scanJobId: string | undefined;
    if (session.user.role === 'freelancer' && isNewUser && isAiServiceConfigured()) {
      try {
        scanJobId = await enqueueGithubScan(
          session.user.id,
          profile.githubUsername,
          profile.accessToken,
        );
        console.log('[AuthRoute]   ✅ First-time GitHub scan enqueued. jobId:', scanJobId);
      } catch (err) {
        console.error('[AuthRoute]   ⚠️ failed to enqueue GitHub scan:', err);
      }
    } else if (session.user.role === 'freelancer') {
      console.log('[AuthRoute]   ↩️ Returning freelancer — skipping auto-scan (use Analytics → Re-analyze).');
    }

    // Capture a lightweight profile snapshot + README in the BACKGROUND. Done
    // once at first sign-up, and backfilled once for returning users who don't
    // have one yet. It grounds the AI analysis and gives an instant profile view.
    if (session.user.role === 'freelancer') {
      const freelancerId = session.user.id;
      const { githubUsername, accessToken } = profile;
      void (async () => {
        try {
          if (isNewUser) {
            await captureProfileSnapshot(freelancerId, githubUsername, accessToken);
            return;
          }
          const existing = await getGithubScanRepository().getProfileSnapshot(freelancerId);
          if (!existing) {
            await captureProfileSnapshot(freelancerId, githubUsername, accessToken);
          }
        } catch (err) {
          console.error('[AuthRoute]   ⚠️ profile snapshot capture failed:', err);
        }
      })();
    }

    res.json({ ...session, githubUsername: profile.githubUsername, scanJobId });
  }),
);

authRouter.post(
  '/refresh',
  asyncRoute(async (req, res) => {
    console.log('[AuthRoute] POST /api/auth/refresh — Token refresh attempt');
    const { refreshToken, userId } = req.body ?? {};
    if (typeof refreshToken !== 'string' || typeof userId !== 'string') {
      console.error('[AuthRoute] ❌ Refresh: missing refreshToken or userId. Got types:', typeof refreshToken, typeof userId);
      res.status(400).json({ error: 'refreshToken and userId are required.' });
      return;
    }
    console.log('[AuthRoute]   userId:', userId, '| refreshToken length:', refreshToken.length);
    const repo = getUserRepository();
    const user = await repo.findById(userId);
    if (!user) {
      console.error('[AuthRoute] ❌ Refresh: user not found in repository. userId:', userId);
      res.status(401).json({ error: 'Unknown user.' });
      return;
    }
    const hash = hashRefreshToken(refreshToken);
    // Only non-expired tokens count. An expired hash is treated as unknown; the
    // stale record is cleaned up on the next add/rotation.
    const activeTokens = pruneExpiredRefreshTokens(user.refreshTokens ?? []);
    if (!activeTokens.some((r) => r.hash === hash)) {
      console.error('[AuthRoute] ❌ Refresh: token hash not found or expired. userId:', userId, '| active tokens:', activeTokens.length);
      res.status(401).json({ error: 'Refresh token not recognised.' });
      return;
    }
    // Rotate: revoke the old hash, issue a new one. Defends against replay if
    // the refresh token ever leaks.
    await repo.removeRefreshTokenHash(user.id, hash);
    const newRefresh = generateRefreshToken();
    await repo.addRefreshTokenHash(user.id, hashRefreshToken(newRefresh));
    const accessToken = signAccessToken(user);
    console.log('[AuthRoute]   ✅ Token refresh successful. userId:', userId);
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
    console.log('[AuthRoute] POST /api/auth/logout — Single-device logout');
    const { refreshToken, userId } = req.body ?? {};
    if (typeof refreshToken !== 'string' || typeof userId !== 'string') {
      console.error('[AuthRoute] ❌ Logout: missing refreshToken or userId.');
      res.status(400).json({ error: 'refreshToken and userId are required.' });
      return;
    }
    await getUserRepository().removeRefreshTokenHash(
      userId,
      hashRefreshToken(refreshToken),
    );
    console.log('[AuthRoute]   ✅ Logout successful. userId:', userId);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/logout-all',
  requireAuth,
  asyncRoute(async (req, res) => {
    console.log('[AuthRoute] POST /api/auth/logout-all — All-device logout for userId:', req.auth!.sub);
    await getUserRepository().clearRefreshTokens(req.auth!.sub);
    console.log('[AuthRoute]   ✅ All refresh tokens cleared for userId:', req.auth!.sub);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    console.log('[AuthRoute] GET /api/auth/me — userId:', req.auth!.sub);
    const user = await getUserRepository().findById(req.auth!.sub);
    if (!user) {
      console.error('[AuthRoute] ❌ /me: authenticated user not found in repository. userId:', req.auth!.sub);
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    console.log('[AuthRoute]   ✅ /me: returning profile for', user.email, '| role:', user.role);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me/role',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { role } = req.body ?? {};
    console.log('[AuthRoute] PATCH /api/auth/me/role — userId:', req.auth!.sub, '| requested role:', role);
    if (!VALID_ROLES.includes(role)) {
      console.error('[AuthRoute] ❌ Role change: invalid role:', role, '| valid:', VALID_ROLES.join(', '));
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    const repo = getUserRepository();
    const current = await repo.findById(req.auth!.sub);
    if (!current) {
      console.error('[AuthRoute] ❌ Role change: user not found. userId:', req.auth!.sub);
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (FREELANCER_ONLY_ONBOARDING) {
      // No-op requests remain harmless for grandfathered sessions, but role
      // promotion/demotion is closed so a new freelancer cannot self-promote.
      if (role === current.role) {
        res.json({ user: publicUser(current) });
        return;
      }
      res.status(403).json({
        error: 'Role changes are temporarily unavailable during the freelancer-only launch.',
        code: 'role_changes_paused',
      });
      return;
    }

    const updated = await repo.updateRole(req.auth!.sub, role);
    if (!updated) {
      console.error('[AuthRoute] ❌ Role change: user not found. userId:', req.auth!.sub);
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    console.log('[AuthRoute]   ✅ Role changed to:', updated.role, 'for userId:', updated.id);
    res.json({ user: publicUser(updated) });
  }),
);

authRouter.post(
  '/dev-login',
  asyncRoute(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    console.log('[AuthRoute] POST /api/auth/dev-login — Development bypass login');
    const email = req.body?.email || 'dev-tester@fixflow.ai';
    const name = req.body?.name || 'Dev Tester';
    console.log('[AuthRoute]   email:', email, '| name:', name);
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
    console.log('[AuthRoute]   ✅ Dev-login session issued. userId:', user.id, '| role:', user.role);

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
    razorpayAccountId: u.razorpayAccountId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
