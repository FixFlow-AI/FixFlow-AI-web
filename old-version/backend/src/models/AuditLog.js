const { createDynamoModel } = require('../db/dynamoModel');

const AuditLog = createDynamoModel({
  modelName: 'AuditLog',
  defaults: () => ({
    userId: null,
    sessionId: null,
    eventType: 'api_request',
    action: '',
    entityType: null,
    entityId: null,
    method: '',
    endpoint: '',
    statusCode: 0,
    ipAddress: '',
    userAgent: '',
    deviceInfo: null,
    browser: null,
    os: null,
    country: null,
    city: null,
    requestId: '',
    metadata: {},
    riskLevel: 'low',
    success: true,
    errorMessage: null,
    responseTimeMs: 0,
  }),
});

module.exports = AuditLog;
