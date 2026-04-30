const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixflowai-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-12345';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-12345';

const {
  buildHeuristicBriefScore,
  buildTooShortBriefScore,
} = require('../services/brief/briefScoreService');

test('buildHeuristicBriefScore rewards detailed briefs', () => {
  const score = buildHeuristicBriefScore(`
    We need a web platform and mobile app for our field sales team.
    The system should include dashboards, admin workflows, API integrations with Salesforce and Stripe,
    role-based access, analytics, and a launch deadline in eight weeks.
    Budget is between $40,000 and $60,000.
    Stakeholders include the CTO, sales operations lead, and end users in the field.
    Success will be measured through conversion rate, time saved, and monthly active users.
  `);

  assert.equal(score.dimensions.length, 6);
  assert.equal(score.readyToGenerate, true);
  assert.ok(score.overallScore >= 70);
  assert.ok(score.improvementSuggestions.length <= 4);
});

test('buildHeuristicBriefScore flags weak briefs', () => {
  const score = buildHeuristicBriefScore('Need a better app for our company as soon as possible.');

  assert.equal(score.readyToGenerate, false);
  assert.ok(score.overallScore < 70);
  assert.ok(score.missingSections.length >= 3);
});

test('buildTooShortBriefScore returns a blocked state', () => {
  const score = buildTooShortBriefScore();

  assert.equal(score.overallScore, 0);
  assert.equal(score.readyToGenerate, false);
  assert.equal(score.dimensions.every((dimension) => dimension.score === 0), true);
});
