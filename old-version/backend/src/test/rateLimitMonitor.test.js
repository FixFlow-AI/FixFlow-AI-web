const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '12345678901234567';
process.env.RATE_LIMIT_MONITOR_ENABLED = 'true';
process.env.RATE_LIMIT_ALERT_COOLDOWN_SEC = '600';
process.env.RATE_LIMIT_RESTORE_COOLDOWN_SEC = '60';

const { onRateLimitEvent } = require('../services/rateLimit/rateLimitEventBus');
const { reportProviderError, reportProviderSuccess } = require('../services/rateLimit/rateLimitMonitor');
const { fingerprintApiKey } = require('../services/rateLimit/rateLimitStateStore');

test('rate limit monitor emits exceeded then restored for same user/key', async () => {
  const events = [];
  const unsubscribe = onRateLimitEvent((event) => events.push(event));

  const apiKeyFingerprint = fingerprintApiKey('test-key');

  reportProviderError({
    provider: 'gemini',
    apiKeyFingerprint,
    userId: 'user-1',
    statusCode: 429,
    isQuotaError: true,
    message: 'rate limit',
  });

  reportProviderSuccess({
    provider: 'gemini',
    apiKeyFingerprint,
    userId: 'user-1',
    requestId: 'req-1',
  });

  unsubscribe();

  assert.equal(events[0]?.eventType, 'limit_exceeded');
  assert.equal(events[1]?.eventType, 'limit_restored');
});

test('rateLimitStateStore fingerprints keys safely', () => {
  const fp1 = fingerprintApiKey('abc');
  const fp2 = fingerprintApiKey('abc');
  const fp3 = fingerprintApiKey('abcd');

  assert.equal(fp1, fp2);
  assert.notEqual(fp1, fp3);
  assert.equal(fp1.length, 16);
});

