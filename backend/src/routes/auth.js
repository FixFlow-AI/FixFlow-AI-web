const { Router } = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { env } = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { registerSchema, loginSchema, refreshSchema, githubExchangeSchema } = require('../models/schemas');
const { UnauthorizedError, ConflictError, BadRequestError } = require('../utils/errors');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

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
      'User-Agent': 'Proplytics-Backend',
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
    'User-Agent': 'Proplytics-Backend',
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
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
}

function safeFrontendRedirect(path, params) {
  const url = new URL(path, env.FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
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

    const redirectUrl = safeFrontendRedirect('/login', {
      provider: 'github',
      state,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      user: Buffer.from(JSON.stringify(authResult.user)).toString('base64'),
    });

    res.redirect(302, redirectUrl);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/request
router.post('/forgot-password/request', authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      throw new BadRequestError('Email is required');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new UnauthorizedError('No account found for that email');
    }

    const otp = createOtpCode();
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // In production, send OTP via email provider. For now, return a safe development response.
    res.json({
      message: 'OTP generated successfully. Check your email integration to deliver it.',
      otp,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!email || !otp || !newPassword) {
      throw new BadRequestError('Email, OTP, and new password are required');
    }

    const stored = otpStore.get(email);
    if (!stored || stored.expiresAt < Date.now()) {
      otpStore.delete(email);
      throw new UnauthorizedError('OTP expired or invalid');
    }

    if (stored.otp !== otp) {
      throw new UnauthorizedError('OTP is incorrect');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new UnauthorizedError('No account found for that email');
    }

    user.passwordHash = newPassword;
    user.refreshTokens = [];
    await user.save();
    otpStore.delete(email);

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
    });
    await user.save();

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokens.push(refreshToken);
    await user.save();

    res.status(201).json({
      user: user.toJSON(),
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

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({
      user: user.toJSON(),
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
    res.json({ user: user.toJSON() });
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
