const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const Session = require('../models/Session');
const { UnauthorizedError } = require('../utils/errors');
const { normalizePlan } = require('../services/capabilities/capabilityService');
const { inferUserRole, normalizeSelectedPlanForRole } = require('../services/auth/authRules');

async function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  const token = header.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);

    if (decoded.sessionId) {
      const session = await Session.findById(decoded.sessionId).lean();
      if (!session || session.revokedAt) {
        return next(new UnauthorizedError('Session has been revoked'));
      }
    }

    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }
    const role = inferUserRole(user);
    const selectedPlan = normalizeSelectedPlanForRole(role, user.selectedPlan || user.plan || 'free');

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      role,
      selectedPlan,
      authProvider: user.authProvider || (user.githubId ? 'github' : user.googleId ? 'google' : 'email'),
      githubUsername: user.githubUsername || '',
      plan: normalizePlan(selectedPlan),
      teamPlanPreference: normalizePlan(user.teamPlanPreference || user.plan),
      defaultEntryMode: user.defaultEntryMode,
      currentWorkspaceId: user.currentWorkspaceId ? user.currentWorkspaceId.toString() : null,
    };
    req.authSessionId = decoded.sessionId || null;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    return next(new UnauthorizedError('Invalid token'));
  }
}

module.exports = { authMiddleware };
