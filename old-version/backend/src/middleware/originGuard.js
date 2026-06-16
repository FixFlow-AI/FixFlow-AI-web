const { isAllowedFrontendOrigin, normalizeOrigin } = require('../utils/frontendOrigin');
const { ForbiddenError } = require('../utils/errors');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isUnsafeMethod(method) {
  return UNSAFE_METHODS.has(String(method || '').toUpperCase());
}

function getOriginFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

function originGuardMiddleware(req, _res, next) {
  if (!isUnsafeMethod(req.method)) {
    return next();
  }

  if (req.path === '/api/billing/webhook') {
    return next();
  }

  const origin = typeof req.headers.origin === 'string' ? normalizeOrigin(req.headers.origin) : '';
  const refererOrigin = typeof req.headers.referer === 'string' ? getOriginFromReferer(req.headers.referer) : '';
  const candidate = origin || refererOrigin;

  if (!candidate) {
    return next();
  }

  if (!isAllowedFrontendOrigin(candidate, { allowLoopback: true })) {
    return next(new ForbiddenError('Request origin is not allowed'));
  }

  return next();
}

module.exports = { originGuardMiddleware, isUnsafeMethod };
