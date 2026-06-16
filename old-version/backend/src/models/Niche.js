const { createDynamoModel } = require('../db/dynamoModel');

const Niche = createDynamoModel({
  modelName: 'Niche',
  defaults: () => ({
    depth: 0,
    rateCeiling: 0,
    evidence: [],
    reasoning: '',
    tags: [],
    accepted: false,
  }),
});

module.exports = Niche;
