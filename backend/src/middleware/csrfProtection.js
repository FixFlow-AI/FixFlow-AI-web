const { ForbiddenError } = require('../utils/errors');
const { verifyCsrfToken } = require('../services/auth/sessionService');

const CSRF_PATHS = new Set(['/api/auth/refresh', '/api/auth/logout']);

function csrfProtectionMiddleware(req, _res, next) {
  if (!CSRF_PATHS.has(req.path) || req.method !== 'POST') {
    return next();
  }

  const token = req.headers['x-csrf-token'];
  if (typeof token !== 'string' || !verifyCsrfToken(token)) {
    return next(new ForbiddenError('Invalid CSRF token'));
  }

  return next();
}

module.exports = { csrfProtectionMiddleware };
