const { Router } = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { env } = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  githubExchangeSchema,
  uploadUrlSchema,
  avatarCommitSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  authProfileUpdateSchema,
} = require('../models/schemas');
const { UnauthorizedError, ConflictError, BadRequestError } = require('../utils/errors');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { isSmtpConfigured, sendPasswordResetOtp } = require('../utils/mailer');
const { getPersonalCapabilities, normalizePlan } = require('../services/capabilities/capabilityService');
const { buildAuthProfile } = require('../services/auth/profileService');
const { normalizeNotificationPreferences } = require('../services/notifications/notificationPreferences');
const { buildFrontendUrl, isAllowedFrontendOrigin, normalizeOrigin } = require('../utils/frontendOrigin');
const s3Service = require('../services/storage/s3');

const router = Router();

const otpStore = new Map();

function ensureGithubConfigured() {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new BadRequestError('GitHub OAuth is not configured on the server');
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

async function exchangeGithubCodeForToken(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
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

async function fetchGithubProfile(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FixFlowAI-Backend',
  };

  const userResponse = await fetch('https://api.github.com/user', { headers });
  if (!userResponse.ok) {
    throw new BadRequestError('Failed to fetch GitHub user profile');
  }

  const userData = await userResponse.json();
  let email = userData.email;

  if (!email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', { headers });
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
    email: email.toLowerCase(),
    name: (userData.name || userData.login || email.split('@')[0]).trim(),
  };
}

async function findOrCreateUserFromGithub(profile) {
  let user = await User.findOne({ githubId: profile.githubId });

  if (user) {
    let isChanged = false;

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
    }

    return user;
  }

  user = await User.findOne({ email: profile.email });
  if (user) {
    if (user.githubId && user.githubId !== profile.githubId) {
      throw new ConflictError('Email is already linked to another GitHub account');
    }

    user.githubId = profile.githubId;
    if (profile.name && user.name !== profile.name) {
      user.name = profile.name;
    }
    await user.save();

    return user;
  }

  const generatedPassword = `${crypto.randomBytes(32).toString('hex')}Aa1`;
  user = new User({
    email: profile.email,
    passwordHash: generatedPassword,
    name: profile.name,
    githubId: profile.githubId,
  });
  await user.save();

  return user;
}

async function issueTokensForUser(user) {
  const payload = { userId: user._id.toString(), email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  user.refreshTokens.push(refreshToken);
  await user.save();

  return {
    ...(await buildAuthProfile(user)),
    accessToken,
    refreshToken,
  };
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

// POST /api/auth/github/exchange
router.post('/github/exchange', authLimiter, async (req, res, next) => {
  try {
    ensureGithubConfigured();
    const data = githubExchangeSchema.parse(req.body);

    const githubAccessToken = await exchangeGithubCodeForToken(data.code);
    const profile = await fetchGithubProfile(githubAccessToken);
    const user = await findOrCreateUserFromGithub(profile);
    const authResult = await issueTokensForUser(user);

    res.json({
      ...authResult,
      provider: 'github',
      state: data.state || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/avatar/:userId/:fileName
router.get('/avatar/:userId/:fileName', async (req, res, next) => {
  try {
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
router.post('/avatar/upload-url', authMiddleware, async (req, res, next) => {
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
    s3Service.getAvatarMimeTypeFromKey(fileKey);

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
    const user = await findOrCreateUserFromGithub(profile);
    const authResult = await issueTokensForUser(user);
    const redirectBaseUrl = resolveFrontendBaseUrl(state);
    const entryMode = resolveEntryMode(state);

    const redirectUrl = buildFrontendUrl('/login', {
      provider: 'github',
      state,
      mode: entryMode,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      user: Buffer.from(JSON.stringify(authResult.user)).toString('base64'),
    }, { baseUrl: redirectBaseUrl });

    res.redirect(302, redirectUrl);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/request
router.post('/forgot-password/request', authLimiter, async (req, res, next) => {
  try {
    if (!isSmtpConfigured()) {
      throw new BadRequestError('Email service is not configured. Please contact support.');
    }

    const { email } = forgotPasswordRequestSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedError('No account found for that email');
    }

    const otp = createOtpCode();
    otpStore.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    try {
      await sendPasswordResetOtp({ to: normalizedEmail, otp });
    } catch (sendError) {
      otpStore.delete(normalizedEmail);
      console.error('Failed to send OTP email:', sendError);
      throw new BadRequestError('Unable to send OTP email right now. Please try again in a moment.');
    }

    res.json({
      message: 'OTP sent to your registered email address.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', authLimiter, async (req, res, next) => {
  try {
    const { email, otp, newPassword } = forgotPasswordVerifySchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    const stored = otpStore.get(normalizedEmail);
    if (!stored || stored.expiresAt < Date.now()) {
      otpStore.delete(normalizedEmail);
      throw new UnauthorizedError('OTP expired or invalid');
    }

    if (stored.otp !== normalizedOtp) {
      throw new UnauthorizedError('OTP is incorrect');
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedError('No account found for that email');
    }

    user.passwordHash = newPassword;
    user.refreshTokens = [];
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

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const user = new User({
      email: data.email,
      passwordHash: data.password,
      name: data.name,
      plan: data.plan,
      teamPlanPreference: data.defaultEntryMode === 'team' ? data.plan : data.teamPlanPreference,
      defaultEntryMode: data.defaultEntryMode,
      usageLimit: getPersonalCapabilities(data.plan).usageLimit,
    });
    await user.save();

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokens.push(refreshToken);
    await user.save();

    const profile = await buildAuthProfile(user);

    res.status(201).json({
      ...profile,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await User.findOne({ email: data.email });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await user.comparePassword(data.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (data.entryMode) {
      user.defaultEntryMode = data.entryMode;
    }

    const normalizedPlan = normalizePlan(user.plan);
    if (user.plan !== normalizedPlan) {
      user.plan = normalizedPlan;
    }
    user.usageLimit = getPersonalCapabilities(user.plan).usageLimit;

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokens.push(refreshToken);
    await user.save();

    const profile = await buildAuthProfile(user);

    res.json({
      ...profile,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Rotate refresh token
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    const payload = { userId: user._id.toString(), email: user.email };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
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
    if (user.plan === 'enterprise') {
      user.plan = 'pro';
      user.usageLimit = getPersonalCapabilities('pro').usageLimit;
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
    const { refreshToken } = req.body;
    const user = await User.findById(req.user.userId);

    if (user && refreshToken) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
      await user.save();
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
