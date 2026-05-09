const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixflowai-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-16';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SMTP_FROM = '';

const { ForbiddenError } = require('../utils/errors');
const { buildUsageSummary, assertCanCreateProposal, incrementProposalUsage } = require('../services/billing/planEnforcer');
const { buildEvalScores, totalScore } = require('../services/eval/proposalEvalService');
const { getPriceIdForPlan, getPlanForPriceId } = require('../services/billing/stripeService');
const { isSmtpConfigured, sendTransactionalMail } = require('../utils/mailer');

function fakeUser(overrides = {}) {
  return {
    plan: 'free',
    proposalsThisMonth: 0,
    usageCount: 0,
    resetDate: new Date(Date.now() + 86400000),
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
    ...overrides,
  };
}

test('plan enforcer blocks free users at the monthly proposal limit', async () => {
  const user = fakeUser({ proposalsThisMonth: 5 });
  assert.throws(
    () => {
      throw new ForbiddenError('x');
    },
    ForbiddenError
  );
  await assert.rejects(() => assertCanCreateProposal(user), ForbiddenError);
});

test('plan enforcer increments proposal usage after successful generation', async () => {
  const user = fakeUser({ plan: 'pro', proposalsThisMonth: 4 });
  await assertCanCreateProposal(user);
  const usage = await incrementProposalUsage(user);

  assert.equal(usage.proposalsThisMonth, 5);
  assert.equal(usage.proposalLimit, 50);
  assert.equal(user.saveCalls, 2);
});

test('billing price helpers map configured plan prices', () => {
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  process.env.STRIPE_AGENCY_PRICE_ID = 'price_agency';
  process.env.STRIPE_SOLO_PRICE_ID = 'price_solo';

  assert.equal(getPriceIdForPlan('free'), '');
  assert.equal(getPlanForPriceId('missing'), 'free');
});

test('email compatibility wrapper skips unconfigured SMTP without throwing', async () => {
  assert.equal(isSmtpConfigured(), false);
  const result = await sendTransactionalMail({
    to: 'client@example.com',
    subject: 'Hello',
    text: 'Body',
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'SMTP_NOT_CONFIGURED');
});

test('proposal eval scores complete structured proposals', () => {
  const proposal = {
    briefSnapshot: 'Build a React client portal with payments, analytics, and weekly delivery milestones.',
  };
  const proposalJSON = {
    project_summary: 'Build a React client portal with analytics and payments.',
    features: [
      { title: 'React portal', description: 'Client portal', technical_approach: 'React app', confidence_pct: 90 },
      { title: 'Analytics', description: 'Track engagement', technical_approach: 'Events', confidence_pct: 80 },
    ],
    risks: [{ label: 'Payments', mitigation: 'Validate provider early' }],
    effort: [{ label: 'Build', percentage: 70, timeframe: '4 weeks' }],
    timeline: [{ phase: 'Build' }, { phase: 'Launch' }],
    delivery_plan: { weeks: [{}, {}], roadmap: [{}] },
  };
  const scores = buildEvalScores(proposal, proposalJSON);

  assert.equal(scores.completenessScore, 100);
  assert.equal(scores.deliveryPlanQuality, 100);
  assert.ok(totalScore(scores) > 50);
  assert.deepEqual(buildUsageSummary(fakeUser({ plan: 'agency' })).unlimited, true);
});
