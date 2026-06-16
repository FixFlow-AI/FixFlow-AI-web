const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createGeminiGuard,
  extractRetryDelayMs,
  getGeminiAuthErrorMessage,
  getGeminiModelCandidates,
  isGeminiAuthError,
  isGeminiLeakedKeyError,
  isGeminiModelError,
  isGeminiQuotaError,
} = require('../services/llm/geminiGuard');

test('detects Gemini auth errors', () => {
  assert.equal(isGeminiAuthError({ status: 401, message: 'Unauthorized' }), true);
  assert.equal(isGeminiAuthError({ status: 403, message: 'Forbidden' }), true);
  assert.equal(isGeminiAuthError({ message: 'API key not valid. Please pass a valid API key.' }), true);
  assert.equal(isGeminiAuthError({ status: 403, message: 'model gemini-9 not found' }), false);
});

test('detects leaked Gemini API keys and returns an actionable message', () => {
  const leakedError = {
    status: 403,
    message: 'Your API key was reported as leaked. Please use another API key.',
  };

  assert.equal(isGeminiLeakedKeyError(leakedError), true);
  assert.match(getGeminiAuthErrorMessage(leakedError), /reported as leaked/i);
  assert.match(getGeminiAuthErrorMessage(leakedError), /backend\/\.env/i);
});

test('detects Gemini quota and model errors', () => {
  assert.equal(isGeminiQuotaError({ status: 429, message: 'Too many requests' }), true);
  assert.equal(isGeminiQuotaError({ message: 'RESOURCE_EXHAUSTED: quota exceeded' }), true);
  assert.equal(isGeminiModelError({ status: 404, message: 'models/gemini-9 not found' }), true);
});

test('builds a unique ordered model candidate list', () => {
  assert.deepEqual(
    getGeminiModelCandidates('gemini-2.5-flash', 'gemini-2.5-flash-lite'),
    ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
  );
  assert.deepEqual(getGeminiModelCandidates('gemini-2.5-flash', 'gemini-2.5-flash'), ['gemini-2.5-flash']);
  assert.deepEqual(
    getGeminiModelCandidates('gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview, gemini-2.5-flash'),
    ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash']
  );
});

test('extracts provider retry delays from Gemini quota errors', () => {
  assert.equal(
    extractRetryDelayMs({
      error: {
        details: [{ retryDelay: '14s' }],
      },
    }),
    14_000
  );

  assert.equal(
    extractRetryDelayMs({
      message: 'Quota exceeded. Please retry in 14.321563957s.',
    }),
    14_322
  );
});

test('gemini guard blocks repeated hard failures during cooldown', () => {
  let now = 1_000;
  const guard = createGeminiGuard({ cooldownMs: 60_000, now: () => now });

  guard.markHardFailure(new Error('API key disabled'));
  assert.equal(guard.isDisabled(), true);
  assert.throws(() => guard.assertAvailable(), /temporarily paused/);

  now += 60_001;
  assert.equal(guard.isDisabled(), false);
  assert.doesNotThrow(() => guard.assertAvailable());
});
