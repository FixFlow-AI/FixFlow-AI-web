const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, normalizeBriefText } = require('../services/llm/promptBuilder');

test('normalizeBriefText truncates oversized briefs with a marker', () => {
  const hugeBrief = 'a'.repeat(150005);
  const normalized = normalizeBriefText(hugeBrief);

  assert.equal(normalized.length, 150012);
  assert.ok(normalized.endsWith('\n[TRUNCATED]'));
});

test('buildPrompt includes schema instructions and the user brief', () => {
  const { system, user } = buildPrompt('Build a platform for restaurant ordering.');

  assert.match(system, /OUTPUT SCHEMA/);
  assert.match(system, /project_summary/);
  assert.match(user, /restaurant ordering/);
});
