const { createDynamoModel } = require('../db/dynamoModel');

const Session = createDynamoModel({
  modelName: 'Session',
  defaults: () => ({
    userId: '',
    refreshTokenHash: '',
    userAgent: '',
    ipAddress: '',
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    replayDetectedAt: null,
  }),
  hiddenFields: ['refreshTokenHash'],
});

module.exports = Session;
