const { SQLI_PATTERN, XSS_PATTERN } = require('./sanitizeInput');
const { buildRequestMetadata, getClientIp, writeAuditLog } = require('../services/audit/auditService');

function stringifySmall(value) {
  try {
    return JSON.stringify(value || {}).slice(0, 5000);
  } catch {
    return '';
  }
}

function suspiciousActivityMiddleware(req, res, next) {
  const sample = stringifySmall({ body: req.body, query: req.query, params: req.params });
  if (sample && (SQLI_PATTERN.test(sample) || XSS_PATTERN.test(sample))) {
    writeAuditLog({
      userId: req.user?.userId || null,
      sessionId: req.authSessionId || null,
      eventType: 'suspicious_activity',
      action: 'unsafe_input_pattern_detected',
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode: 0,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      requestId: req.id || '',
      metadata: buildRequestMetadata(req),
      riskLevel: 'high',
      success: false,
    });
  }

  res.on('finish', () => {
    if ((res.statusCode === 401 || res.statusCode === 403) && req.path?.startsWith('/api')) {
      writeAuditLog({
        userId: req.user?.userId || null,
        sessionId: req.authSessionId || null,
        eventType: 'authorization_failure',
        action: res.statusCode === 403 ? 'access_denied' : 'authentication_failed',
        method: req.method,
        endpoint: req.originalUrl || req.url,
        statusCode: res.statusCode,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        requestId: req.id || '',
        metadata: { path: req.path },
        riskLevel: req.path?.includes('/admin') ? 'high' : 'medium',
        success: false,
      });
    }
  });

  next();
}

module.exports = { suspiciousActivityMiddleware };
