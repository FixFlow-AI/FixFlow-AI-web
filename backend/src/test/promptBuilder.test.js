const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPrompt,
  buildStrategyDirective,
  buildCalibrationDirective,
  normalizeBriefText,
} = require('../services/llm/promptBuilder');

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

test('buildStrategyDirective reflects lean and premium proposal posture', () => {
  const lean = buildStrategyDirective('lean');
  const premium = buildStrategyDirective('premium');

  assert.match(lean, /minimum viable scope proposal/i);
  assert.match(lean, /Keep only the core outcomes/i);
  assert.match(premium, /expanded strategic proposal/i);
  assert.match(premium, /proactively extend it/i);
});

test('buildCalibrationDirective omits empty input and wraps provided context', () => {
  assert.equal(buildCalibrationDirective('   '), '');

  const calibration = buildCalibrationDirective('React wins 2.3x more often than Python.');
  assert.match(calibration, /AGENCY CALIBRATION CONTEXT/);
  assert.match(calibration, /React wins 2\.3x more often than Python\./);
});

test('buildPrompt injects strategy and calibration context into the system prompt', () => {
  const { system } = buildPrompt('Create a healthcare analytics portal.', {
    strategy: 'premium',
    calibrationContext: 'Healthcare projects with QA phases win more often.',
  });

  assert.match(system, /STRATEGY DIRECTIVE/);
  assert.match(system, /expanded strategic proposal/i);
  assert.match(system, /AGENCY CALIBRATION CONTEXT/);
  assert.match(system, /Healthcare projects with QA phases win more often\./);
});
