const express = require('express');
const { z } = require('zod');
const AuditLog = require('../models/AuditLog');
const { authMiddleware } = require('../middleware/auth');
const { adminOnlyMiddleware } = require('../middleware/adminOnly');
const { adminExportLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const auditQuerySchema = z.object({
  userId: z.string().trim().max(128).optional(),
  eventType: z.string().trim().max(80).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  ipAddress: z.string().trim().max(80).optional(),
  endpoint: z.string().trim().max(300).optional(),
  success: z.enum(['true', 'false']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
}).strict();

function buildFilter(query) {
  const filter = {};
  if (query.userId) filter.userId = query.userId;
  if (query.eventType) filter.eventType = query.eventType;
  if (query.riskLevel) filter.riskLevel = query.riskLevel;
  if (query.ipAddress) filter.ipAddress = query.ipAddress;
  if (query.success) filter.success = query.success === 'true';
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }
  return filter;
}

function matchesEndpoint(item, endpoint) {
  if (!endpoint) return true;
  return String(item.endpoint || '').toLowerCase().includes(endpoint.toLowerCase());
}

function toCsvValue(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function toCsv(logs) {
  const fields = [
    'createdAt',
    'requestId',
    'userId',
    'eventType',
    'action',
    'riskLevel',
    'success',
    'method',
    'endpoint',
    'statusCode',
    'ipAddress',
    'userAgent',
  ];
  const rows = logs.map((log) => fields.map((field) => toCsvValue(log[field])).join(','));
  return [fields.join(','), ...rows].join('\n');
}

router.use(authMiddleware, adminOnlyMiddleware);

router.get('/audit-logs', async (req, res, next) => {
  try {
    const query = auditQuerySchema.parse(req.query || {});
    const filter = buildFilter(query);
    const allLogs = (await AuditLog.find(filter).sort({ createdAt: -1 }).lean()).filter((log) =>
      matchesEndpoint(log, query.endpoint)
    );
    const start = (query.page - 1) * query.limit;
    const logs = allLogs.slice(start, start + query.limit);

    res.json({
      logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: allLogs.length,
        totalPages: Math.ceil(allLogs.length / query.limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs/export', adminExportLimiter, async (req, res, next) => {
  try {
    const query = auditQuerySchema.parse({ ...(req.query || {}), limit: '100' });
    const logs = (await AuditLog.find(buildFilter(query)).sort({ createdAt: -1 }).limit(1000).lean()).filter((log) =>
      matchesEndpoint(log, query.endpoint)
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(toCsv(logs));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
