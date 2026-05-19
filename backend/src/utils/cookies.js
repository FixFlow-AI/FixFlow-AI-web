function parseCookies(header = '') {
  return String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index === -1) return cookies;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!key) return cookies;
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) segments.push(`Domain=${options.domain}`);
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) segments.push('HttpOnly');
  if (options.secure) segments.push('Secure');
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);

  return segments.join('; ');
}

function cookieMiddleware(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie || '');
  next();
}

module.exports = {
  cookieMiddleware,
  parseCookies,
  serializeCookie,
};
