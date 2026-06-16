const rateLimit = require('express-rate-limit');
const { getClientIp, writeAuditLog } = require('../services/audit/auditService');

function buildRateLimitHandler(action, riskLevel = 'medium') {
  return (req, res) => {
    writeAuditLog({
      userId: req.user?.userId || null,
      sessionId: req.authSessionId || null,
      eventType: 'rate_limit',
      action,
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode: 429,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      requestId: req.id || '',
      metadata: {
        limit: req.rateLimit?.limit,
        remaining: req.rateLimit?.remaining,
        resetTime: req.rateLimit?.resetTime,
      },
      riskLevel,
      success: false,
      errorMessage: 'Rate limit exceeded',
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      requestId: req.id,
    });
  };
}

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('auth_rate_limit_exceeded', 'high'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('api_rate_limit_exceeded'),
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('password_reset_rate_limit_exceeded', 'high'),
});

const publicPortalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('public_portal_rate_limit_exceeded', 'medium'),
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('upload_rate_limit_exceeded', 'medium'),
});

const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('generation_rate_limit_exceeded', 'high'),
});

const adminExportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('admin_export_rate_limit_exceeded', 'high'),
});

module.exports = {
  adminExportLimiter,
  apiLimiter,
  authLimiter,
  generationLimiter,
  passwordResetLimiter,
  publicPortalLimiter,
  uploadLimiter,
};
