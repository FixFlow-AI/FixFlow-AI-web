const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '12345678901234567';

const {
  buildGenerationHeuristic,
  buildChatHeuristic,
  buildRange,
  getHistorySummary,
  blendEstimate,
} = require('../services/eta/etaService');

test('buildGenerationHeuristic increases estimate for larger briefs and premium strategy', () => {
  const shortStandard = buildGenerationHeuristic({
    inputType: 'text',
    strategy: 'standard',
    wordCount: 120,
  });
  const longPremium = buildGenerationHeuristic({
    inputType: 'text',
    strategy: 'premium',
    wordCount: 2200,
  });

  assert.ok(longPremium > shortStandard);
});

test('buildChatHeuristic makes mutation estimates longer than short questions', () => {
  const questionEta = buildChatHeuristic({
    message: 'Why did we choose this stack?',
    intent: 'question',
  });
  const mutateEta = buildChatHeuristic({
    message: 'Rewrite the timeline and expand the feature list with more detail for integrations.',
    intent: 'mutate',
    targetSection: 'timeline',
  });

  assert.ok(mutateEta > questionEta);
});

test('buildRange widens lower-confidence estimates', () => {
  const high = buildRange(20, 'high');
  const low = buildRange(20, 'low');

  assert.ok((low.maxSeconds - low.minSeconds) > (high.maxSeconds - high.minSeconds));
});

test('blendEstimate prefers history when enough samples exist', () => {
  const history = getHistorySummary([18000, 22000, 21000, 20000, 19000, 20500, 21500, 19800]);
  const blended = blendEstimate({
    heuristicSeconds: 35,
    historySummary: history,
  });

  assert.equal(blended.confidence, 'high');
  assert.equal(blended.basis, 'history');
  assert.ok(blended.estimatedSeconds < 30);
});
