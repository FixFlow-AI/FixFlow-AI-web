const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-12345';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const Proposal = require('../models/Proposal');
const s3Service = require('../services/storage/s3');
const { createSectionMetrics, buildShareUrl } = require('../services/portal/portalService');
const { buildMockWonOutcome, buildMockLostOutcome } = require('../services/proposal/outcomeService');
const {
  getProposalJSONForRecord,
  upsertEmbeddedProposalVersion,
} = require('../services/proposal/proposalAccess');
const { getAnalytics } = require('../services/analytics/analyticsService');

test('createSectionMetrics initializes all tracked portal sections', () => {
  const metrics = createSectionMetrics();

  assert.deepEqual(Object.keys(metrics), ['summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact']);
  assert.equal(metrics.features.views, 0);
  assert.equal(metrics.timeline.dwellMs, 0);
});

test('buildShareUrl returns a public portal link', () => {
  const url = buildShareUrl('sample-token');
  assert.match(url, /\/p\/sample-token$/);
});

test('buildMockWonOutcome returns a kickoff package with 10 checklist items', () => {
  const outcome = buildMockWonOutcome({
    timeline: [{ phase: 'Discovery' }],
    features: [{ title: 'Client portal' }],
  });

  assert.equal(outcome.checklist.length, 10);
  assert.match(outcome.kickoffEmail.subject, /Client portal/i);
});

test('buildMockLostOutcome returns a three-email sequence', () => {
  const outcome = buildMockLostOutcome(
    {
      project_summary: 'The proposal focuses on a phased platform launch.',
      risks: [{ label: 'Timeline risk', mitigation: 'Validate dependencies early.' }],
    },
    'Budget was tight'
  );

  assert.match(outcome.email1.body, /budget was tight/i);
  assert.match(outcome.email2.body, /Timeline risk/);
  assert.equal(outcome.email3.sendTiming, 'One month later');
});

test('getAnalytics aggregates deal outcomes and proposal detail signals', async (t) => {
  t.mock.method(Proposal, 'find', () => ({
    sort: () => ({
      lean: async () => ([
        {
          proposalId: 'won-1',
          dealStatus: 'won',
          briefScore: { overallScore: 86 },
          createdAt: '2026-04-01T00:00:00.000Z',
          dealStatusUpdatedAt: '2026-04-06T00:00:00.000Z',
          s3Key: 'won-1.json',
        },
        {
          proposalId: 'lost-1',
          dealStatus: 'lost',
          briefScore: { overallScore: 54 },
          createdAt: '2026-04-02T00:00:00.000Z',
          dealStatusUpdatedAt: '2026-04-10T00:00:00.000Z',
          s3Key: 'lost-1.json',
        },
        {
          proposalId: 'pending-1',
          dealStatus: 'pending',
          briefScore: null,
          createdAt: '2026-04-03T00:00:00.000Z',
          dealStatusUpdatedAt: null,
          s3Key: 'pending-1.json',
        },
      ]),
    }),
  }));

  t.mock.method(s3Service, 'getProposalJSON', async (key) => {
    if (key === 'won-1.json') {
      return {
        features: [{ title: 'Portal', confidence_pct: 90 }, { title: 'Analytics', confidence_pct: 80 }],
      };
    }

    if (key === 'lost-1.json') {
      return {
        features: [{ title: 'Portal', confidence_pct: 45 }],
      };
    }

    return {
      features: [{ title: 'BriefScore', confidence_pct: 70 }],
    };
  });

  const analytics = await getAnalytics('user-1');

  assert.equal(analytics.totalProposals, 3);
  assert.equal(analytics.statusBreakdown.won, 1);
  assert.equal(analytics.statusBreakdown.lost, 1);
  assert.equal(analytics.winRate, 50);
  assert.equal(analytics.confidenceComparison.won, 85);
  assert.equal(analytics.confidenceComparison.lost, 45);
  assert.equal(analytics.briefScoreComparison.won, 86);
  assert.equal(analytics.briefScoreComparison.lost, 54);
  assert.equal(analytics.topWinningFeatures[0].title, 'Portal');
});

test('getProposalJSONForRecord falls back to embedded MongoDB data when S3 bucket is missing', async (t) => {
  t.mock.method(s3Service, 'getProposalJSON', async () => {
    const error = new Error('The specified bucket does not exist');
    error.Code = 'NoSuchBucket';
    throw error;
  });

  const proposal = {
    s3Key: 'output/user-1/proposal-1/v1.json',
    versionCount: 1,
    proposalData: {
      project_summary: 'Fallback proposal',
      features: [{ title: 'Portal', confidence_pct: 91 }],
      timeline: [],
    },
    proposalVersions: [],
  };

  const data = await getProposalJSONForRecord(proposal);

  assert.equal(data.project_summary, 'Fallback proposal');
  assert.equal(data.features[0].title, 'Portal');
  assert.equal(data.storage_unavailable, undefined);
  assert.ok(data.delivery_plan);
});

test('getProposalJSONForRecord returns safe unavailable payload for legacy S3-only records', async (t) => {
  t.mock.method(s3Service, 'getProposalJSON', async () => {
    const error = new Error('The specified bucket does not exist');
    error.Code = 'NoSuchBucket';
    throw error;
  });

  const proposal = {
    s3Key: 'output/user-1/proposal-legacy/v2.json',
    versionCount: 2,
    projectSummary: 'Legacy proposal summary',
    proposalData: null,
    proposalVersions: [],
  };

  const data = await getProposalJSONForRecord(proposal);

  assert.equal(data.project_summary, 'Legacy proposal summary');
  assert.equal(data.storage_unavailable, true);
  assert.equal(data.requested_version, 2);
  assert.ok(data.delivery_plan);
});

test('upsertEmbeddedProposalVersion stores latest and versioned proposal data', () => {
  const proposal = {
    proposalVersions: [],
    markModified() {},
  };

  upsertEmbeddedProposalVersion(
    proposal,
    1,
    { project_summary: 'Version one' },
    'output/user-1/proposal-1/v1.json'
  );

  upsertEmbeddedProposalVersion(
    proposal,
    2,
    { project_summary: 'Version two' },
    'output/user-1/proposal-1/v2.json'
  );

  assert.equal(proposal.proposalData.project_summary, 'Version two');
  assert.equal(proposal.proposalVersions.length, 2);
  assert.equal(proposal.proposalVersions[0].data.project_summary, 'Version one');
  assert.equal(proposal.proposalVersions[1].s3Key, 'output/user-1/proposal-1/v2.json');
});
