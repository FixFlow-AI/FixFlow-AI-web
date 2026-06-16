const { createDynamoModel } = require('../db/dynamoModel');

function buildSectionMetrics() {
  return {
    summary: { views: 0, dwellMs: 0 },
    features: { views: 0, dwellMs: 0 },
    risks: { views: 0, dwellMs: 0 },
    timeline: { views: 0, dwellMs: 0 },
    effort: { views: 0, dwellMs: 0 },
    market: { views: 0, dwellMs: 0 },
    impact: { views: 0, dwellMs: 0 },
  };
}

function buildTierSelectionDefaults() {
  return {
    proposalId: '',
    strategy: '',
    clientEmail: '',
    selectedAt: null,
  };
}

const Portal = createDynamoModel({
  modelName: 'Portal',
  defaults: () => ({
    proposalId: '',
    workspaceId: null,
    portalType: 'single',
    tripId: '',
    proposalIds: [],
    strategySelection: [],
    expiryAt: null,
    pinHash: '',
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    sectionMetrics: buildSectionMetrics(),
    feedback: [],
    dealRoomTierSelection: buildTierSelectionDefaults(),
  }),
});

module.exports = Portal;
