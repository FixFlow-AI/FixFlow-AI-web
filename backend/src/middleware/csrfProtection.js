const { ForbiddenError } = require('../utils/errors');
const { verifyCsrfToken } = require('../services/auth/sessionService');

const CSRF_PATHS = new Set(['/api/auth/refresh', '/api/auth/logout']);
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfProtectionMiddleware(req, _res, next) {
  const isUnsafe = UNSAFE_METHODS.has(String(req.method || '').toUpperCase());
  const hasSessionCookie = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('ff_refresh');
  const isTargetedPath = CSRF_PATHS.has(req.path);

  if ((isTargetedPath && req.method === 'POST') || (isUnsafe && hasSessionCookie)) {
    const token = req.headers['x-csrf-token'];
    if (typeof token !== 'string' || !verifyCsrfToken(token)) {
      return next(new ForbiddenError('Invalid CSRF token'));
    }
  }

  return next();
}

module.exports = { csrfProtectionMiddleware };
