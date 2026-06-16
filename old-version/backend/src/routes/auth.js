const { Router } = require('express');
const crypto = require('crypto');
const { isValidId } = require('../db/dynamoModel');
const User = require('../models/User');
const { env } = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const {
  registerSchema,
  loginSchema,
  githubExchangeSchema,
  uploadUrlSchema,
  avatarCommitSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  authProfileUpdateSchema,
} = require('../models/schemas');
const { UnauthorizedError, ConflictError, BadRequestError } = require('../utils/errors');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter, uploadLimiter } = require('../middleware/rateLimit');
const { isSmtpConfigured, sendPasswordResetOtp } = require('../utils/mailer');
const { getPersonalCapabilities, normalizePlan } = require('../services/capabilities/capabilityService');
const { buildAuthProfile } = require('../services/auth/profileService');
const {
  applyAuthMetadata,
  assertPlanAllowedForRole,
  assertProviderAllowedForRole,
  assertRoleMatchesUser,
  getRoleDashboardPath,
  inferUserRole,
  normalizeRole,
  normalizeSelectedPlanForRole,
} = require('../services/auth/authRules');
const { normalizeNotificationPreferences } = require('../services/notifications/notificationPreferences');
const { buildFrontendUrl, isAllowedFrontendOrigin, normalizeOrigin } = require('../utils/frontendOrigin');
const s3Service = require('../services/storage/s3');
const { safeFetch } = require('../utils/safeFetch');
const {
  clearRefreshCookie,
  createCsrfToken,
  createSession,
  getRefreshTokenFromRequest,
  revokeSession,
  rotateRefreshSession,
  setRefreshCookie,
  verifyRefreshSession,
} = require('../services/auth/sessionService');
const { getClientIp, writeAuditLog } = require('../services/audit/auditService');

const router = Router();

const otpStore = new Map();
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function ensureGithubConfigured() {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new BadRequestError('GitHub OAuth is not configured on the server');
  }
}

function ensureGoogleConfigured() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new BadRequestError('Google OAuth is not configured on the server');
  }
}

function buildGithubAuthorizeUrl(state = '') {
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL);
  authorizeUrl.searchParams.set('scope', env.GITHUB_OAUTH_SCOPE);

  if (state) {
    authorizeUrl.searchParams.set('state', state);
  }

  return authorizeUrl.toString();
}

function buildGoogleAuthorizeUrl(state = '') {
  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', env.GOOGLE_OAUTH_SCOPE);
  authorizeUrl.searchParams.set('access_type', 'offline');
  authorizeUrl.searchParams.set('prompt', 'select_account');

  if (state) {
    authorizeUrl.searchParams.set('state', state);
  }

  return authorizeUrl.toString();
}

async function exchangeGithubCodeForToken(code) {
  const response = await safeFetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'FixFlowAI-Backend',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
    }),
  });

  if (!response.ok) {
    throw new BadRequestError('Failed to exchange GitHub authorization code');
  }

  const data = await response.json();
  if (data.error) {
    throw new BadRequestError(data.error_description || 'GitHub OAuth exchange failed');
  }

  if (!data.access_token) {
    throw new BadRequestError('GitHub did not return an access token');
  }

  return data.access_token;
}

async function exchangeGoogleCodeForToken(code) {
  const response = await safeFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FixFlowAI-Backend',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.GOOGLE_CALLBACK_URL,
    }),
  });

  if (!response.ok) {
    throw new BadRequestError('Failed to exchange Google authorization code');
  }

  const data = await response.json();
  if (data.error) {
    throw new BadRequestError(data.error_description || 'Google OAuth exchange failed');
  }

  if (!data.access_token) {
    throw new BadRequestError('Google did not return an access token');
  }

  return data.access_token;
}

async function fetchGithubProfile(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FixFlowAI-Backend',
  };

  const userResponse = await safeFetch('https://api.github.com/user', { headers });
  if (!userResponse.ok) {
    throw new BadRequestError('Failed to fetch GitHub user profile');
  }

  const userData = await userResponse.json();
  let email = userData.email;

  if (!email) {
    const emailResponse = await safeFetch('https://api.github.com/user/emails', { headers });
    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      if (Array.isArray(emails)) {
        const preferred =
          emails.find((item) => item.primary && item.verified) ||
          emails.find((item) => item.verified) ||
          emails[0];
        email = preferred?.email;
      }
    }
  }

  if (!userData.id) {
    throw new BadRequestError('Invalid GitHub profile payload');
  }

  if (!email) {
    throw new BadRequestError(
      'GitHub account email is unavailable. Please make email visible or grant user:email scope.'
    );
  }

  return {
    githubId: String(userData.id),
    githubUsername: userData.login || '',
    email: email.toLowerCase(),
    name: (userData.name || userData.login || email.split('@')[0]).trim(),
  };
}

async function fetchGoogleProfile(accessToken) {
  const response = await safeFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'FixFlowAI-Backend',
    },
  });

  if (!response.ok) {
    throw new BadRequestError('Failed to fetch Google user profile');
  }

  const userData = await response.json();
  if (!userData.sub || !userData.email) {
    throw new BadRequestError('Invalid Google profile payload');
  }
  if (userData.email_verified === false) {
    throw new BadRequestError('Google account email must be verified');
  }

  return {
    googleId: String(userData.sub),
    email: String(userData.email).toLowerCase(),
    name: (userData.name || userData.email.split('@')[0]).trim(),
  };
}

async function findOrCreateUserFromGithub(profile, options = {}) {
  const role = normalizeRole(options.role);
  const selectedPlan = normalizeSelectedPlanForRole(role, options.selectedPlan || 'free');
  assertProviderAllowedForRole(role, 'github');
  assertPlanAllowedForRole(role, selectedPlan);

  let user = await User.findOne({ githubId: profile.githubId });

  if (user) {
    let isChanged = false;
    const actualRole = assertRoleMatchesUser(user, role);
    applyAuthMetadata(user, {
      role: actualRole,
      selectedPlan: user.selectedPlan || user.plan || selectedPlan,
      authProvider: 'github',
      githubUsername: profile.githubUsername,
    });

    if (profile.name && user.name !== profile.name) {
      user.name = profile.name;
      isChanged = true;
    }

    if (profile.email && user.email !== profile.email) {
      const existingByEmail = await User.findOne({ email: profile.email });
      if (!existingByEmail || existingByEmail._id.toString() === user._id.toString()) {
        user.email = profile.email;
        isChanged = true;
      }
    }

    if (isChanged) {
      await user.save();
    } else {
      await user.save();
    }

    return user;
  }

  user = await User.findOne({ email: profile.email });
  if (user) {
    assertRoleMatchesUser(user, role);
    if (user.githubId && user.githubId !== profile.githubId) {
      throw new ConflictError('Email is already linked to another GitHub account');
    }

    user.githubId = profile.githubId;
    user.githubUsername = profile.githubUsername || user.githubUsername || '';
    if (profile.name && user.name !== profile.name) {
      user.name = profile.name;
    }
    applyAuthMetadata(user, {
      role,
      selectedPlan: user.selectedPlan || user.plan || selectedPlan,
      authProvider: 'github',
      githubUsername: profile.githubUsername,
    });
    await user.save();

    return user;
  }

  const generatedPassword = `${crypto.randomBytes(32).toString('hex')}Aa1`;
  user = new User({
    email: profile.email,
    passwordHash: generatedPassword,
    name: profile.name,
    githubId: profile.githubId,
    githubUsername: profile.githubUsername || '',
  });
  applyAuthMetadata(user, { role, selectedPlan, authProvider: 'github', githubUsername: profile.githubUsername });
  await user.save();

  return user;
}

async function findOrCreateUserFromGoogle(profile, options = {}) {
  const role = normalizeRole(options.role);
  const selectedPlan = normalizeSelectedPlanForRole(role, options.selectedPlan || 'free');
  assertProviderAllowedForRole(role, 'google');
  assertPlanAllowedForRole(role, selectedPlan);

  let user = await User.findOne({ googleId: profile.googleId });
  if (user) {
    const actualRole = assertRoleMatchesUser(user, role);
    applyAuthMetadata(user, {
      role: actualRole,
      selectedPlan: user.selectedPlan || user.plan || selectedPlan,
      authProvider: 'google',
      googleId: profile.googleId,
    });
    if (profile.name && user.name !== profile.name) {
      user.name = profile.name;
    }
    if (profile.email && user.email !== profile.email) {
      const existingByEmail = await User.findOne({ email: profile.email });
      if (!existingByEmail || existingByEmail._id.toString() === user._id.toString()) {
        user.email = profile.email;
      }
    }
    await user.save();
    return user;
  }

  user = await User.findOne({ email: profile.email });
  if (user) {
    assertRoleMatchesUser(user, role);
    if (user.googleId && user.googleId !== profile.googleId) {
      throw new ConflictError('Email is already linked to another Google account');
    }

    user.googleId = profile.googleId;
    if (profile.name && user.name !== profile.name) {
      user.name = profile.name;
    }
    applyAuthMetadata(user, {
      role,
      selectedPlan: user.selectedPlan || user.plan || selectedPlan,
      authProvider: 'google',
      googleId: profile.googleId,
    });
    await user.save();
    return user;
  }

  const generatedPassword = `${crypto.randomBytes(32).toString('hex')}Aa1`;
  user = new User({
    email: profile.email,
    passwordHash: generatedPassword,
    name: profile.name,
    googleId: profile.googleId,
  });
  applyAuthMetadata(user, { role, selectedPlan, authProvider: 'google', googleId: profile.googleId });
  await user.save();

  return user;
}

async function issueTokensForUser(user, req, res) {
  const { session, refreshToken } = await createSession(user, req);
  const payload = { userId: user._id.toString(), email: user.email, sessionId: session._id.toString() };
  const accessToken = signAccessToken(payload);
  setRefreshCookie(res, refreshToken);
  req.authSessionId = session._id.toString();

  return {
    ...(await buildAuthProfile(user)),
    accessToken,
    expiresIn: env.JWT_ACCESS_EXPIRY,
  };
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp || '')).digest('hex');
}

function isPasswordLocked(user) {
  return user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now();
}

async function recordAuthEvent(req, user, action, success, metadata = {}, riskLevel = 'low') {
  await writeAuditLog({
    userId: user?._id?.toString() || user?.id || null,
    sessionId: req.authSessionId || null,
    eventType: 'auth',
    action,
    method: req.method,
    endpoint: req.originalUrl,
    statusCode: success ? 200 : 401,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || '',
    requestId: req.id || '',
    metadata,
    riskLevel,
    success,
  });
}

function safeFrontendRedirect(path, params) {
  return buildFrontendUrl(path, params);
}

function decodeOAuthState(state) {
  if (!state) {
    return {};
  }

  try {
    const decoded = Buffer.from(state, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveFrontendBaseUrl(state) {
  const payload = decodeOAuthState(state);
  const originCandidate =
    typeof payload.frontendOrigin === 'string'
      ? payload.frontendOrigin
      : typeof payload.frontendUrl === 'string'
        ? payload.frontendUrl
        : '';

  const normalizedOrigin = normalizeOrigin(originCandidate);
  if (normalizedOrigin && isAllowedFrontendOrigin(normalizedOrigin, { allowLoopback: true })) {
    return normalizedOrigin;
  }

  return env.FRONTEND_URL;
}

function resolveEntryMode(state) {
  const payload = decodeOAuthState(state);
  return payload.entryMode === 'team' ? 'team' : 'individual';
}

function resolveOAuthContext(state) {
  const payload = decodeOAuthState(state);
  const role = normalizeRole(payload.role);
  const selectedPlan = normalizeSelectedPlanForRole(role, payload.selectedPlan || payload.plan || 'free');
  const flow = payload.flow === 'login' ? 'login' : 'signup';
  const returnTo = typeof payload.returnTo === 'string' && payload.returnTo.startsWith('/') ? payload.returnTo : '';

  return {
    flow,
    role,
    selectedPlan,
    entryMode: payload.entryMode === 'team' ? 'team' : 'individual',
    returnTo,
  };
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// GET /api/auth/github/url
router.get('/github/url', (req, res, next) => {
  try {
    ensureGithubConfigured();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const authUrl = buildGithubAuthorizeUrl(state);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/google/url
router.get('/google/url', (req, res, next) => {
  try {
    ensureGoogleConfigured();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const context = resolveOAuthContext(state);
    assertProviderAllowedForRole(context.role, 'google');
    const authUrl = buildGoogleAuthorizeUrl(state);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
});

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: createCsrfToken(req.authSessionId || '') });
});

// GET /api/auth/github
router.get('/github', (req, res, next) => {
  try {
    ensureGithubConfigured();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const authUrl = buildGithubAuthorizeUrl(state);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/google
router.get('/google', (req, res, next) => {
  try {
    ensureGoogleConfigured();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const context = resolveOAuthContext(state);
    assertProviderAllowedForRole(context.role, 'google');
    const authUrl = buildGoogleAuthorizeUrl(state);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/github/exchange
router.post('/github/exchange', authLimiter, async (req, res, next) => {
  try {
    ensureGithubConfigured();
    const data = githubExchangeSchema.parse(req.body);
    const context = resolveOAuthContext(data.state);

    const githubAccessToken = await exchangeGithubCodeForToken(data.code);
    const profile = await fetchGithubProfile(githubAccessToken);
    const user = await findOrCreateUserFromGithub(profile, context);
    const authResult = await issueTokensForUser(user, req, res);
    await recordAuthEvent(req, user, 'oauth_github_exchange_success', true, { provider: 'github' });

    res.json({
      ...authResult,
      provider: 'github',
      state: data.state || null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google/exchange
router.post('/google/exchange', authLimiter, async (req, res, next) => {
  try {
    ensureGoogleConfigured();
    const data = githubExchangeSchema.parse(req.body);
    const context = resolveOAuthContext(data.state);

    const googleAccessToken = await exchangeGoogleCodeForToken(data.code);
    const profile = await fetchGoogleProfile(googleAccessToken);
    const user = await findOrCreateUserFromGoogle(profile, context);
    const authResult = await issueTokensForUser(user, req, res);
    await recordAuthEvent(req, user, 'oauth_google_exchange_success', true, { provider: 'google' });

    res.json({
      ...authResult,
      provider: 'google',
      state: data.state || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/avatar/:userId/:fileName
router.get('/avatar/:userId/:fileName', async (req, res, next) => {
  try {
    if (!isValidId(req.params.userId)) {
      throw new BadRequestError('Avatar not found.');
    }

    const user = await User.findById(req.params.userId).lean();
    const expectedFileName = decodeURIComponent(req.params.fileName || '');

    if (!user?.avatarKey || s3Service.getAvatarFileNameFromKey(user.avatarKey) !== expectedFileName) {
      throw new BadRequestError('Avatar not found.');
    }

    const buffer = await s3Service.getFile(user.avatarKey);
    res.setHeader('Content-Type', s3Service.getAvatarMimeTypeFromKey(user.avatarKey));
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/avatar/upload-url
router.post('/avatar/upload-url', authMiddleware, uploadLimiter, async (req, res, next) => {
  try {
    const { fileName, fileType } = uploadUrlSchema.parse(req.body);
    res.json(await s3Service.generateAvatarUploadUrl(req.user.userId, fileType, fileName));
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/avatar/commit
router.post('/avatar/commit', authMiddleware, async (req, res, next) => {
  try {
    const { fileKey } = avatarCommitSchema.parse(req.body);
    s3Service.assertOwnedAvatarKey(req.user.userId, fileKey);
    const mimeType = s3Service.getAvatarMimeTypeFromKey(fileKey);

    // Fetch the file from S3 and verify the image signature (magic bytes)
    const fileBuffer = await s3Service.getFile(fileKey);
    const { assertFileSignature } = require('../services/fileParser');
    assertFileSignature(fileBuffer, mimeType);

    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    user.avatarKey = fileKey;
    user.avatar = s3Service.buildAvatarUrl(user._id.toString(), fileKey);
    await user.save();

    const profile = await buildAuthProfile(user);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/github/callback
router.get('/github/callback', authLimiter, async (req, res, next) => {
  try {
    ensureGithubConfigured();

    if (typeof req.query.error === 'string') {
      const reason = typeof req.query.error_description === 'string' ? req.query.error_description : req.query.error;
      throw new BadRequestError(`GitHub OAuth failed: ${reason}`);
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : null;

    if (!code) {
      throw new BadRequestError('Missing GitHub authorization code');
    }

    const githubAccessToken = await exchangeGithubCodeForToken(code);
    const profile = await fetchGithubProfile(githubAccessToken);
    const context = resolveOAuthContext(state);
    const user = await findOrCreateUserFromGithub(profile, context);
    const authResult = await issueTokensForUser(user, req, res);
    await recordAuthEvent(req, user, 'oauth_github_callback_success', true, { provider: 'github' });
    const redirectBaseUrl = resolveFrontendBaseUrl(state);
    const entryMode = context.entryMode || resolveEntryMode(state);
    const dashboardPath = context.returnTo || getRoleDashboardPath(inferUserRole(user));

    const redirectUrl = buildFrontendUrl('/login', {
      provider: 'github',
      state,
      mode: entryMode,
      role: inferUserRole(user),
      redirectTo: dashboardPath,
      oauth: 'success',
    }, { baseUrl: redirectBaseUrl });

    res.redirect(302, redirectUrl);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/google/callback
router.get('/google/callback', authLimiter, async (req, res, next) => {
  try {
    ensureGoogleConfigured();

    if (typeof req.query.error === 'string') {
      const reason = typeof req.query.error_description === 'string' ? req.query.error_description : req.query.error;
      throw new BadRequestError(`Google OAuth failed: ${reason}`);
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : null;

    if (!code) {
      throw new BadRequestError('Missing Google authorization code');
    }

    const googleAccessToken = await exchangeGoogleCodeForToken(code);
    const profile = await fetchGoogleProfile(googleAccessToken);
    const context = resolveOAuthContext(state);
    const user = await findOrCreateUserFromGoogle(profile, context);
    const authResult = await issueTokensForUser(user, req, res);
    await recordAuthEvent(req, user, 'oauth_google_callback_success', true, { provider: 'google' });
    const redirectBaseUrl = resolveFrontendBaseUrl(state);
    const entryMode = context.entryMode || resolveEntryMode(state);
    const dashboardPath = context.returnTo || getRoleDashboardPath(inferUserRole(user));

    const redirectUrl = buildFrontendUrl('/login', {
      provider: 'google',
      state,
      mode: entryMode,
      role: inferUserRole(user),
      redirectTo: dashboardPath,
      oauth: 'success',
    }, { baseUrl: redirectBaseUrl });

    res.redirect(302, redirectUrl);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/request
router.post('/forgot-password/request', passwordResetLimiter, async (req, res, next) => {
  try {
    if (!isSmtpConfigured()) {
      throw new BadRequestError('Email service is not configured. Please contact support.');
    }

    const { email } = forgotPasswordRequestSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      await recordAuthEvent(req, null, 'password_reset_requested_unknown_email', false, { email: normalizedEmail }, 'medium');
      return res.json({
        message: 'If an account exists for that email, an OTP has been sent.',
      });
    }

    const otp = createOtpCode();
    otpStore.set(normalizedEmail, {
      otpHash: hashOtp(otp),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    try {
      await sendPasswordResetOtp({ to: normalizedEmail, otp });
    } catch (sendError) {
      otpStore.delete(normalizedEmail);
      console.error('Failed to send OTP email:', sendError);
      throw new BadRequestError('Unable to send OTP email right now. Please try again in a moment.');
    }

    res.json({
      message: 'If an account exists for that email, an OTP has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', passwordResetLimiter, async (req, res, next) => {
  try {
    const { email, otp, newPassword } = forgotPasswordVerifySchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    const stored = otpStore.get(normalizedEmail);
    if (!stored || stored.expiresAt < Date.now()) {
      otpStore.delete(normalizedEmail);
      throw new UnauthorizedError('OTP expired or invalid');
    }

    stored.attempts = Number(stored.attempts || 0) + 1;
    if (stored.attempts > 5) {
      otpStore.delete(normalizedEmail);
      await recordAuthEvent(req, null, 'password_reset_otp_attempts_exceeded', false, { email: normalizedEmail }, 'high');
      throw new UnauthorizedError('OTP expired or invalid');
    }

    if (stored.otpHash !== hashOtp(normalizedOtp)) {
      throw new UnauthorizedError('OTP is incorrect');
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedError('No account found for that email');
    }

    user.passwordHash = newPassword;
    user.refreshTokens = [];
    user.passwordChangedAt = new Date().toISOString();
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();
    otpStore.delete(normalizedEmail);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    assertProviderAllowedForRole(data.role, 'email');
    const selectedPlan = assertPlanAllowedForRole(data.role, data.selectedPlan);

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const user = new User({
      email: data.email,
      passwordHash: data.password,
      name: data.name,
      role: data.role,
      selectedPlan,
      authProvider: 'email',
      plan: selectedPlan,
      teamPlanPreference: 'free',
      defaultEntryMode: data.defaultEntryMode,
      usageLimit: getPersonalCapabilities(selectedPlan).usageLimit,
      proposalLimit: getPersonalCapabilities(selectedPlan).proposalLimit,
    });
    applyAuthMetadata(user, { role: data.role, selectedPlan, authProvider: 'email' });
    await user.save();

    user.lastLoginAt = new Date().toISOString();
    await user.save();
    const authResult = await issueTokensForUser(user, req, res);
    await recordAuthEvent(req, user, 'register_success', true, { role: data.role });

    res.status(201).json({
      ...authResult,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    assertProviderAllowedForRole(data.role, 'email');

    const user = await User.findOne({ email: data.email });
    if (!user) {
      await recordAuthEvent(req, null, 'login_failure_unknown_email', false, { email: data.email }, 'medium');
      throw new UnauthorizedError('Invalid email or password');
    }
    if (isPasswordLocked(user)) {
      await recordAuthEvent(req, user, 'login_failure_account_locked', false, {}, 'high');
      throw new UnauthorizedError('Too many failed attempts. Please try again later.');
    }
    const actualRole = assertRoleMatchesUser(user, data.role);
    applyAuthMetadata(user, {
      role: actualRole,
      selectedPlan: user.selectedPlan || user.plan || 'free',
      authProvider: user.authProvider || 'email',
    });

    const isValid = await user.comparePassword(data.password);
    if (!isValid) {
      user.failedLoginCount = Number(user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MS).toISOString();
      }
      await user.save();
      await recordAuthEvent(req, user, 'login_failure_bad_password', false, {
        failedLoginCount: user.failedLoginCount,
      }, user.failedLoginCount >= MAX_FAILED_LOGINS ? 'high' : 'medium');
      throw new UnauthorizedError('Invalid email or password');
    }

    if (data.entryMode) {
      user.defaultEntryMode = data.entryMode;
    }

    const normalizedPlan = normalizePlan(user.plan);
    if (user.plan !== normalizedPlan) {
      user.plan = normalizedPlan;
    }
    user.selectedPlan = normalizeSelectedPlanForRole(actualRole, user.selectedPlan || normalizedPlan);
    user.plan = user.selectedPlan;
    const capabilities = getPersonalCapabilities(user.plan);
    user.usageLimit = capabilities.usageLimit;
    user.proposalLimit = capabilities.proposalLimit;
    const normalizedTeamPlan = normalizePlan(user.teamPlanPreference || 'free');
    user.teamPlanPreference = normalizedTeamPlan === 'solo' ? 'free' : normalizedTeamPlan;

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date().toISOString();
    await user.save();
    const authResult = await issueTokensForUser(user, req, res);
    await recordAuthEvent(req, user, 'login_success', true, { role: actualRole });

    res.json({
      ...authResult,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const session = await verifyRefreshSession(refreshToken);
    const user = await User.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const newRefreshToken = await rotateRefreshSession(session, req);
    setRefreshCookie(res, newRefreshToken);
    req.authSessionId = session._id.toString();

    const payload = { userId: user._id.toString(), email: user.email, sessionId: session._id.toString() };
    const newAccessToken = signAccessToken(payload);

    res.json({
      accessToken: newAccessToken,
      expiresIn: env.JWT_ACCESS_EXPIRY,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    const normalizedPlan = normalizePlan(user.plan);
    const actualRole = inferUserRole(user);
    const normalizedSelectedPlan = normalizeSelectedPlanForRole(actualRole, user.selectedPlan || normalizedPlan);
    const normalizedTeamPlanRaw = normalizePlan(user.teamPlanPreference || 'free');
    const normalizedTeamPlan = normalizedTeamPlanRaw === 'solo' ? 'free' : normalizedTeamPlanRaw;
    if (
      user.role !== actualRole ||
      user.selectedPlan !== normalizedSelectedPlan ||
      user.plan !== normalizedSelectedPlan ||
      user.teamPlanPreference !== normalizedTeamPlan
    ) {
      user.role = actualRole;
      user.selectedPlan = normalizedSelectedPlan;
      user.plan = normalizedSelectedPlan;
      user.teamPlanPreference = normalizedTeamPlan;
      const capabilities = getPersonalCapabilities(normalizedSelectedPlan);
      user.usageLimit = capabilities.usageLimit;
      user.proposalLimit = capabilities.proposalLimit;
      await user.save();
    }

    const profile = await buildAuthProfile(user);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const payload = authProfileUpdateSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (payload.name) {
      user.name = payload.name;
    }

    if (typeof payload.avatar === 'string') {
      user.avatar = payload.avatar;
      user.avatarKey = payload.avatar.startsWith('/api/auth/avatar/') ? user.avatarKey : '';
    }

    if (payload.notificationPreferences) {
      user.notificationPreferences = normalizeNotificationPreferences(payload.notificationPreferences);
    }

    if (typeof payload.timezone === 'string') {
      user.timezone = payload.timezone;
    }

    if (typeof payload.theme === 'string') {
      user.theme = payload.theme;
    }

    await user.save();

    const profile = await buildAuthProfile(user);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    await revokeSession(req.authSessionId);
    clearRefreshCookie(res);
    await recordAuthEvent(req, { _id: req.user.userId }, 'logout_success', true);

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
