const { createDynamoModel } = require('../db/dynamoModel');

function buildBriefSignals() {
  return {
    industries: [],
    tech: [],
    keywords: [],
  };
}

function buildChatTimingStats() {
  return {
    question: { count: 0, totalMs: 0, lastMs: null },
    mutate: { count: 0, totalMs: 0, lastMs: null },
    sections: {},
  };
}

const Proposal = createDynamoModel({
  modelName: 'Proposal',
  defaults: () => ({
    s3Key: '',
    proposalData: null,
    proposalVersions: [],
    projectSummary: '',
    briefSnapshot: '',
    briefSignals: buildBriefSignals(),
    status: 'generating',
    strategy: 'standard',
    tripId: '',
    workspaceId: null,
    createdBy: null,
    assignedTo: null,
    dealStatus: 'pending',
    dealStatusUpdatedAt: null,
    lossReason: '',
    briefScore: null,
    wonOutcome: null,
    lostOutcome: null,
    versionCount: 1,
    inputType: 'text',
    generationTimeMs: null,
    generationError: '',
    sourceFileKey: '',
    comments: [],
    chatTimingStats: buildChatTimingStats(),
  }),
});

module.exports = Proposal;
