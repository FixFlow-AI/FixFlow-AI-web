const AuditLog = require('../../models/AuditLog');

const SENSITIVE_KEY_PATTERN = /(password|token|secret|otp|authorization|cookie|credential|card|cvv|api[_-]?key|client[_-]?secret)/i;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const MAX_METADATA_CHARS = 8000;

function maskSensitive(value) {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : maskSensitive(entry);
      return acc;
    }, {});
  }

  if (typeof value === 'string') {
    return value.replace(CARD_PATTERN, '[REDACTED_CARD]').slice(0, 2000);
  }

  return value;
}

function clampMetadata(metadata = {}) {
  const masked = maskSensitive(metadata);
  const json = JSON.stringify(masked);
  if (json.length <= MAX_METADATA_CHARS) {
    return masked;
  }
  return {
    truncated: true,
    preview: json.slice(0, MAX_METADATA_CHARS),
  };
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function parseUserAgent(userAgent = '') {
  const ua = String(userAgent || '');
  const browser = /Chrome\//.test(ua)
    ? 'Chrome'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Edg\//.test(ua)
          ? 'Edge'
          : null;
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS X/i.test(ua)
      ? 'macOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad/i.test(ua)
          ? 'iOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : null;

  return { browser, os };
}

async function writeAuditLog(entry = {}) {
  try {
    const userAgent = entry.userAgent || '';
    const parsed = parseUserAgent(userAgent);
    return await AuditLog.create({
      ...entry,
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      metadata: clampMetadata(entry.metadata || {}),
      riskLevel: ['low', 'medium', 'high', 'critical'].includes(entry.riskLevel) ? entry.riskLevel : 'low',
      success: entry.success !== false,
      errorMessage: entry.errorMessage ? String(entry.errorMessage).slice(0, 1000) : null,
      browser: entry.browser || parsed.browser,
      os: entry.os || parsed.os,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Audit log write failed:', error.message);
    }
    return null;
  }
}

function buildRequestMetadata(req) {
  return {
    params: req.params,
    query: req.query,
    body: req.method === 'GET' ? undefined : req.body,
  };
}

module.exports = {
  buildRequestMetadata,
  getClientIp,
  maskSensitive,
  parseUserAgent,
  writeAuditLog,
};
