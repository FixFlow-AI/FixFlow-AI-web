const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixflowai-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || '1234567890123456';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '12345678901234567';

const { createGeminiModelCoordinator } = require('../services/llm/modelCoordinator');

test('model coordinator spaces calls based on model RPM', async () => {
  let currentTime = 1_000;
  const waits = [];
  const coordinator = createGeminiModelCoordinator({
    now: () => currentTime,
    wait: async (ms) => {
      waits.push(ms);
      currentTime += ms;
    },
    rpmByModel: { 'gemini-3-flash-preview': 5 },
    maxQueueWaitMs: 20_000,
  });

  const first = await coordinator.acquire('gemini-3-flash-preview');
  const second = await coordinator.acquire('gemini-3-flash-preview');

  assert.equal(first.ok, true);
  assert.equal(first.waitMs, 0);
  assert.equal(second.ok, true);
  assert.equal(second.waitMs, 12_000);
  assert.deepEqual(waits, [12_000]);
});

test('model coordinator marks quota cooldowns from retry delay metadata', () => {
  let currentTime = 5_000;
  const coordinator = createGeminiModelCoordinator({
    now: () => currentTime,
    wait: async () => {},
    rpmByModel: {},
    maxQueueWaitMs: 20_000,
  });

  const retryMs = coordinator.markQuotaError('gemini-3.1-flash-lite-preview', {
    error: {
      details: [{ retryDelay: '8s' }],
    },
  });

  assert.equal(retryMs, 8_000);
  assert.equal(coordinator.getAvailabilityDelayMs('gemini-3.1-flash-lite-preview'), 8_000);

  currentTime += 8_001;
  assert.equal(coordinator.getAvailabilityDelayMs('gemini-3.1-flash-lite-preview'), 0);
});
