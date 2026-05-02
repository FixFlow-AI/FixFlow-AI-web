const crypto = require('node:crypto');
const { getRateLimitConfig } = require('./rateLimitThresholds');

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function stableKey(value) {
  return String(value || '');
}

function fingerprintApiKey(apiKey) {
  if (!apiKey) {
    return 'none';
  }
  const digest = crypto.createHash('sha256').update(String(apiKey)).digest('hex');
  return digest.slice(0, 16);
}

function buildStoreKey({ provider, apiKeyFingerprint, userId }) {
  return `${stableKey(provider)}:${stableKey(apiKeyFingerprint)}:${stableKey(userId)}`;
}

function createRateLimitStateStore({ now = Date.now, ttlMs = DEFAULT_TTL_MS } = {}) {
  const store = new Map();

  function getOrInit(key) {
    if (!store.has(key)) {
      store.set(key, {
        status: 'ok',
        lastEventAtByType: new Map(),
        lastTouchedAt: now(),
        lastFingerprint: '',
      });
    }
    return store.get(key);
  }

  function touch(state) {
    state.lastTouchedAt = now();
  }

  function shouldEmit(state, eventType) {
    const cfg = getRateLimitConfig();
    const last = state.lastEventAtByType.get(eventType) || 0;
    const cooldownMs = eventType === 'limit_restored' ? cfg.restoreCooldownMs : cfg.alertCooldownMs;
    return now() - last >= cooldownMs;
  }

  function markEmitted(state, eventType) {
    state.lastEventAtByType.set(eventType, now());
  }

  function getState({ provider, apiKeyFingerprint, userId }) {
    const key = buildStoreKey({ provider, apiKeyFingerprint, userId });
    const state = getOrInit(key);
    touch(state);
    return { key, state };
  }

  function updateStatus({ provider, apiKeyFingerprint, userId, status }) {
    const { key, state } = getState({ provider, apiKeyFingerprint, userId });
    state.status = status;
    state.lastFingerprint = apiKeyFingerprint || state.lastFingerprint;
    touch(state);
    return { key, state };
  }

  function cleanup() {
    const cutoff = now() - ttlMs;
    for (const [key, state] of store.entries()) {
      if ((state?.lastTouchedAt || 0) < cutoff) {
        store.delete(key);
      }
    }
  }

  function startCleanupInterval({ intervalMs = 60_000 } = {}) {
    const timer = setInterval(cleanup, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  function resetProvider(provider) {
    const prefix = `${stableKey(provider)}:`;
    for (const key of store.keys()) {
      if (String(key).startsWith(prefix)) {
        store.delete(key);
      }
    }
  }

  return {
    fingerprintApiKey,
    buildStoreKey,
    getState,
    updateStatus,
    shouldEmit,
    markEmitted,
    cleanup,
    startCleanupInterval,
    resetProvider,
  };
}

const rateLimitStateStore = createRateLimitStateStore();
rateLimitStateStore.startCleanupInterval();

module.exports = {
  createRateLimitStateStore,
  rateLimitStateStore,
  fingerprintApiKey,
};

