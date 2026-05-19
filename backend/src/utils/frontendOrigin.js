const { env } = require('../config/env');

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

function isLoopbackOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const isLoopbackHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    return isHttp && isLoopbackHost;
  } catch {
    return false;
  }
}

function getAllowedFrontendOrigins() {
  return new Set(
    [...parseOriginList(env.FRONTEND_ALLOWED_ORIGINS), env.FRONTEND_URL]
      .filter(Boolean)
      .map((origin) => normalizeOrigin(origin))
  );
}

function isAllowedFrontendOrigin(origin, { allowLoopback = env.NODE_ENV === 'development' } = {}) {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (getAllowedFrontendOrigins().has(normalizedOrigin)) {
    return true;
  }

  return allowLoopback && isLoopbackOrigin(normalizedOrigin);
}

function buildFrontendUrl(path, params = {}, { baseUrl = env.FRONTEND_URL } = {}) {
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

module.exports = {
  buildFrontendUrl,
  getAllowedFrontendOrigins,
  isAllowedFrontendOrigin,
  isLoopbackOrigin,
  normalizeOrigin,
};
