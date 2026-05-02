const { publishRateLimitEvent } = require('./rateLimitEventBus');
const { rateLimitStateStore, fingerprintApiKey } = require('./rateLimitStateStore');
const { getRateLimitConfig } = require('./rateLimitThresholds');

function parseRetryAfterSec(headers = {}) {
  const headerValue =
    headers['retry-after'] ??
    headers['Retry-After'] ??
    headers['x-retry-after'] ??
    headers['X-Retry-After'];
  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseQuotaRatioFromHeaders(headers = {}) {
  const remaining = headers['x-ratelimit-remaining'] ?? headers['X-RateLimit-Remaining'];
  const limit = headers['x-ratelimit-limit'] ?? headers['X-RateLimit-Limit'];
  const remainingNum = Number(remaining);
  const limitNum = Number(limit);
  if (!Number.isFinite(remainingNum) || !Number.isFinite(limitNum) || limitNum <= 0) {
    return null;
  }
  const usedRatio = Math.max(0, Math.min(1, 1 - remainingNum / limitNum));
  return { usedRatio, remaining: remainingNum, limit: limitNum };
}

function normalizeUserId(userId) {
  return userId ? String(userId) : 'system';
}

function publishIfAllowed({ provider, apiKeyFingerprint, userId, eventType, payload }) {
  const cfg = getRateLimitConfig();
  if (!cfg.enabled) {
    return;
  }

  const { state } = rateLimitStateStore.getState({ provider, apiKeyFingerprint, userId });
  if (!rateLimitStateStore.shouldEmit(state, eventType)) {
    return;
  }

  rateLimitStateStore.markEmitted(state, eventType);
  publishRateLimitEvent({
    eventType,
    provider,
    apiKeyFingerprint,
    userId,
    occurredAt: new Date().toISOString(),
    ...payload,
  });
}

function reportProviderError({
  provider,
  apiKey,
  apiKeyFingerprint: providedFingerprint,
  userId,
  statusCode,
  isQuotaError = false,
  message = '',
  retryAfterSec = null,
  headers = null,
  requestId = null,
  model = null,
  metadata = {},
} = {}) {
  const apiKeyFingerprint = providedFingerprint || fingerprintApiKey(apiKey);
  const normalizedUserId = normalizeUserId(userId);
  const retryAfter =
    retryAfterSec ??
    (headers ? parseRetryAfterSec(headers) : null);

  if (isQuotaError || statusCode === 429) {
    rateLimitStateStore.updateStatus({
      provider,
      apiKeyFingerprint,
      userId: normalizedUserId,
      status: 'exceeded',
    });

    publishIfAllowed({
      provider,
      apiKeyFingerprint,
      userId: normalizedUserId,
      eventType: 'limit_exceeded',
      payload: {
        statusCode: statusCode || 429,
        retryAfterSec: retryAfter,
        model,
        requestId,
        message,
        metadata,
      },
    });

    return { apiKeyFingerprint, eventType: 'limit_exceeded' };
  }

  return { apiKeyFingerprint, eventType: null };
}

function reportProviderSuccess({
  provider,
  apiKey,
  apiKeyFingerprint: providedFingerprint,
  userId,
  headers = null,
  requestId = null,
  model = null,
  metadata = {},
} = {}) {
  const cfg = getRateLimitConfig();
  const apiKeyFingerprint = providedFingerprint || fingerprintApiKey(apiKey);
  const normalizedUserId = normalizeUserId(userId);
  const { state } = rateLimitStateStore.getState({ provider, apiKeyFingerprint, userId: normalizedUserId });

  const quotaRatio = headers ? parseQuotaRatioFromHeaders(headers) : null;
  if (quotaRatio && quotaRatio.usedRatio >= cfg.nearThreshold) {
    publishIfAllowed({
      provider,
      apiKeyFingerprint,
      userId: normalizedUserId,
      eventType: 'near_limit',
      payload: {
        model,
        requestId,
        message: `Provider quota is nearing limit (${Math.round(quotaRatio.usedRatio * 100)}% used).`,
        metadata: { ...metadata, quota: quotaRatio },
      },
    });
  }

  if (state.status === 'exceeded') {
    rateLimitStateStore.updateStatus({
      provider,
      apiKeyFingerprint,
      userId: normalizedUserId,
      status: 'ok',
    });

    publishIfAllowed({
      provider,
      apiKeyFingerprint,
      userId: normalizedUserId,
      eventType: 'limit_restored',
      payload: {
        model,
        requestId,
        message: 'Service restored. You can continue.',
        metadata,
      },
    });

    return { apiKeyFingerprint, eventType: 'limit_restored' };
  }

  return { apiKeyFingerprint, eventType: null };
}

module.exports = {
  reportProviderError,
  reportProviderSuccess,
  handleApiKeyRotation,
};

function handleApiKeyRotation({ provider, oldFingerprint, newFingerprint }) {
  const cfg = getRateLimitConfig();
  if (!cfg.enabled) {
    return;
  }

  rateLimitStateStore.resetProvider(provider);

  publishRateLimitEvent({
    eventType: 'limit_restored',
    provider,
    apiKeyFingerprint: newFingerprint || 'unknown',
    userId: 'system',
    occurredAt: new Date().toISOString(),
    message: 'Service restored after API key rotation.',
    metadata: {
      keyRotated: true,
      oldFingerprint: oldFingerprint || null,
      newFingerprint: newFingerprint || null,
    },
  });
}

