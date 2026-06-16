const { env } = require('../../config/env');
const {
  DEFAULT_GEMINI_MAX_QUEUE_WAIT_MS,
  parseGeminiModelRpmOverrides,
  extractRetryDelayMs,
} = require('./geminiGuard');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCoordinatorState() {
  return {
    cooldownUntil: 0,
    nextAllowedAt: 0,
  };
}

function createGeminiModelCoordinator({
  now = Date.now,
  wait = sleep,
  rpmByModel = parseGeminiModelRpmOverrides(env.GEMINI_MODEL_RPM_OVERRIDES),
  maxQueueWaitMs = env.GEMINI_MAX_QUEUE_WAIT_MS || DEFAULT_GEMINI_MAX_QUEUE_WAIT_MS,
} = {}) {
  const modelState = new Map();

  function getState(model) {
    if (!modelState.has(model)) {
      modelState.set(model, createCoordinatorState());
    }

    return modelState.get(model);
  }

  function getMinIntervalMs(model) {
    const rpm = Number(rpmByModel?.[model] || 0);
    if (!Number.isFinite(rpm) || rpm <= 0) {
      return 0;
    }

    return Math.ceil(60_000 / rpm);
  }

  function getAvailabilityDelayMs(model) {
    const state = getState(model);
    return Math.max(0, Math.max(state.cooldownUntil, state.nextAllowedAt) - now());
  }

  async function acquire(model) {
    const state = getState(model);
    const currentTime = now();
    const earliestStart = Math.max(currentTime, state.cooldownUntil, state.nextAllowedAt);
    const waitMs = Math.max(0, earliestStart - currentTime);

    if (waitMs > maxQueueWaitMs) {
      return { ok: false, waitMs };
    }

    state.nextAllowedAt = earliestStart + getMinIntervalMs(model);

    if (waitMs > 0) {
      await wait(waitMs);
    }

    return { ok: true, waitMs };
  }

  return {
    acquire,
    getAvailabilityDelayMs,
    getEarliestAvailabilityDelayMs(models = []) {
      const delays = models
        .map((model) => getAvailabilityDelayMs(model))
        .filter((delay) => Number.isFinite(delay));

      if (delays.length === 0) {
        return 0;
      }

      return Math.min(...delays);
    },
    markQuotaError(model, error) {
      const state = getState(model);
      const retryDelayMs = extractRetryDelayMs(error) || 5_000;
      state.cooldownUntil = Math.max(state.cooldownUntil, now() + retryDelayMs);
      return retryDelayMs;
    },
  };
}

const geminiModelCoordinator = createGeminiModelCoordinator();

module.exports = {
  createGeminiModelCoordinator,
  geminiModelCoordinator,
};
