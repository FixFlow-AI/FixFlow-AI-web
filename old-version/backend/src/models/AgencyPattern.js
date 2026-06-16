const { createDynamoModel } = require('../db/dynamoModel');

const AgencyPattern = createDynamoModel({
  modelName: 'AgencyPattern',
  defaults: () => ({
    ownerUserId: null,
    workspaceId: null,
    sampleSize: 0,
    analyzedAt: new Date().toISOString(),
    patterns: {},
    insights: [],
  }),
});

module.exports = AgencyPattern;
