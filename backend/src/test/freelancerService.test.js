const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixflowai-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-12345';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-12345';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const {
  buildDemoSeed,
  buildGeneratedProfiles,
  buildOutreachDraft,
  countWords,
  extractPersonalizationTokens,
  normalizeAgentConfig,
} = require('../services/freelancer/freelancerService');

test('buildDemoSeed returns a complete deterministic freelancer workspace', () => {
  const seed = buildDemoSeed({ userId: 'user-1', email: 'founder@example.com', name: 'Founder' });

  assert.match(seed.profile.did, /^did:fixflow:0x/);
  assert.equal(seed.niches.length, 3);
  assert.equal(seed.leads.length, 4);
  assert.equal(seed.escrows[0].milestones.length, 3);
  assert.equal(seed.credentials.length, 2);
  assert.equal(seed.profile.githubScan.repos.length, 3);
});

test('normalizeAgentConfig preserves boolean updates and fills defaults', () => {
  const config = normalizeAgentConfig({
    leadHunter: false,
    escrowWatcher: false,
    ignored: 'nope',
  });

  assert.equal(config.leadHunter, false);
  assert.equal(config.outreachWriter, true);
  assert.equal(config.escrowWatcher, false);
  assert.equal(config.credentialMinter, false);
  assert.equal(config.ignored, undefined);
});

test('buildOutreachDraft keeps messages under the 150 word send limit', () => {
  const draft = buildOutreachDraft({
    company: {
      name: 'VectorForge Labs',
      stack: ['React', 'Node', 'Gemini'],
      mission: 'AI workflows for product teams',
    },
  });

  assert.equal(draft.tokens.includes('firstName'), true);
  assert.equal(draft.tokens.includes('repo'), true);
  assert.equal(draft.wordCount, countWords(draft.body));
  assert.equal(draft.wordCount <= 150, true);
});

test('extractPersonalizationTokens deduplicates valid handlebar tokens', () => {
  const tokens = extractPersonalizationTokens('Hi {{firstName}}, saw {{repo}} and {{repo}} at {{company_1}}.');

  assert.deepEqual(tokens, ['firstName', 'repo', 'company_1']);
});

test('buildGeneratedProfiles uses accepted niche positioning', () => {
  const profiles = buildGeneratedProfiles([
    { id: 'n1', name: 'AI workflow engineering', rateCeiling: 155, accepted: true },
    { id: 'n2', name: 'Freelancer dashboards', rateCeiling: 120, accepted: false },
  ]);

  assert.match(profiles.upwork.headline, /AI workflow engineering/i);
  assert.equal(profiles.upwork.rate, 155);
  assert.match(profiles.personal.tagline, /AI workflow engineering/i);
});
