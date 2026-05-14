const { createDynamoModel } = require('../db/dynamoModel');

const ProposalEval = createDynamoModel({
  modelName: 'ProposalEval',
  defaults: () => ({
    workspaceId: null,
    generatedAt: new Date().toISOString(),
    modelUsed: '',
    briefScoreAtGeneration: null,
    evalScores: {},
    totalEvalScore: 0,
    briefLength: 0,
    generationTimeMs: null,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
  }),
});

module.exports = ProposalEval;
