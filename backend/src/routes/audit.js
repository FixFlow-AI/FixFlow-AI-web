const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const { writeAuditLog, getClientIp } = require('../services/audit/auditService');

const router = express.Router();

const clientEventSchema = z.object({
  eventName: z.string().trim().min(2).max(120),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
}).strict();

router.post('/client-event', authMiddleware, async (req, res, next) => {
  try {
    const payload = clientEventSchema.parse(req.body || {});
    await writeAuditLog({
      userId: req.user.userId,
      sessionId: req.authSessionId || null,
      eventType: 'client_event',
      action: payload.eventName,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: 202,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      requestId: req.id || '',
      metadata: payload.metadata,
      riskLevel: 'low',
      success: true,
    });

    res.status(202).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
