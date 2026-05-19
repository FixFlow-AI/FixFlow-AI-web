const { buildRequestMetadata, getClientIp, writeAuditLog } = require('../services/audit/auditService');

function inferAction(req) {
  const method = String(req.method || '').toLowerCase();
  const route = req.route?.path || req.path || '';
  return `${method} ${route}`;
}

function auditLoggerMiddleware(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (!req.path?.startsWith('/api')) {
      return;
    }

    const statusCode = res.statusCode;
    const riskLevel = statusCode === 401 || statusCode === 403 ? 'medium' : statusCode >= 500 ? 'high' : 'low';

    writeAuditLog({
      userId: req.user?.userId || null,
      sessionId: req.authSessionId || null,
      eventType: 'api_request',
      action: inferAction(req),
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      requestId: req.id || '',
      metadata: buildRequestMetadata(req),
      riskLevel,
      success: statusCode < 400,
      errorMessage: res.locals?.errorMessage || null,
      responseTimeMs: Date.now() - startedAt,
    });
  });

  next();
}

module.exports = { auditLoggerMiddleware };
