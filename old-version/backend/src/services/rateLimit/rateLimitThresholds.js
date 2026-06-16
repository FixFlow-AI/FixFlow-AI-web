const { env } = require('../../config/env');

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
}

function getRateLimitConfig() {
  return {
    enabled: parseBoolean(env.RATE_LIMIT_MONITOR_ENABLED, true),
    nearThreshold: Math.min(0.99, Math.max(0.01, parseNumber(env.RATE_LIMIT_NEAR_THRESHOLD, 0.85))),
    alertCooldownMs: Math.max(5_000, parseNumber(env.RATE_LIMIT_ALERT_COOLDOWN_SEC, 10 * 60) * 1000),
    restoreCooldownMs: Math.max(5_000, parseNumber(env.RATE_LIMIT_RESTORE_COOLDOWN_SEC, 60) * 1000),
    adminRecipients: String(env.ADMIN_ALERT_EMAIL || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    adminRetryMaxAttempts: Math.max(0, Math.floor(parseNumber(env.RATE_LIMIT_RETRY_MAX_ATTEMPTS, 5))),
    adminRetryBaseDelayMs: Math.max(250, parseNumber(env.RATE_LIMIT_RETRY_BASE_DELAY_MS, 1500)),
  };
}

module.exports = {
  getRateLimitConfig,
};

