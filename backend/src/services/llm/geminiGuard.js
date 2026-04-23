const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_GEMINI_KEY_GUARD_MS = 15 * 60 * 1000;

const AUTH_ERROR_PATTERNS = [
  /api key/i,
  /invalid key/i,
  /unauthorized/i,
  /billing/i,
  /not enabled/i,
  /not configured/i,
  /service disabled/i,
];

const QUOTA_ERROR_PATTERNS = [
  /rate limit/i,
  /quota/i,
  /resource exhausted/i,
  /too many requests/i,
];

const MODEL_ERROR_PATTERNS = [
  /model.*not found/i,
  /model.*not available/i,
  /model.*unsupported/i,
  /invalid model/i,
  /permission denied/i,
  /access denied/i,
  /not allowed/i,
];

function getErrorStatus(error) {
  return Number(error?.status ?? error?.response?.status ?? error?.cause?.status ?? NaN);
}

function getErrorMessage(error) {
  return [
    error?.message,
    error?.error?.message,
    error?.response?.data?.error?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function matchesAny(patterns, value) {
  return patterns.some((pattern) => pattern.test(value));
}

function isGeminiAuthError(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if (status === 401) {
    return true;
  }

  if (status === 403 && !matchesAny(MODEL_ERROR_PATTERNS, message)) {
    return true;
  }

  return matchesAny(AUTH_ERROR_PATTERNS, message);
}

function isGeminiQuotaError(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  return status === 429 || matchesAny(QUOTA_ERROR_PATTERNS, message);
}

function isGeminiModelError(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  return [400, 404].includes(status) || matchesAny(MODEL_ERROR_PATTERNS, message);
}

function getGeminiModelCandidates(primaryModel = DEFAULT_GEMINI_MODEL, fallbackModel = DEFAULT_GEMINI_FALLBACK_MODEL) {
  return [...new Set([primaryModel, fallbackModel].map((model) => String(model || '').trim()).filter(Boolean))];
}

function formatGuardMessage(lastFailureMessage, remainingMs) {
  const retryMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const suffix = lastFailureMessage ? ` Last provider error: ${lastFailureMessage}` : '';
  return `Gemini API key is temporarily paused after a hard failure. Retry in about ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'} or replace the key.${suffix}`;
}

function createGeminiGuard({ cooldownMs = DEFAULT_GEMINI_KEY_GUARD_MS, now = Date.now } = {}) {
  let disabledUntil = 0;
  let lastFailureMessage = '';

  return {
    isDisabled() {
      return now() < disabledUntil;
    },
    markHardFailure(error) {
      lastFailureMessage = getErrorMessage(error) || 'Gemini rejected the configured API key.';
      disabledUntil = now() + cooldownMs;
    },
    assertAvailable() {
      if (now() < disabledUntil) {
        throw new Error(formatGuardMessage(lastFailureMessage, disabledUntil - now()));
      }
    },
    getState() {
      return {
        disabledUntil,
        lastFailureMessage,
        remainingMs: Math.max(0, disabledUntil - now()),
      };
    },
  };
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_KEY_GUARD_MS,
  createGeminiGuard,
  getGeminiModelCandidates,
  getErrorMessage,
  getErrorStatus,
  isGeminiAuthError,
  isGeminiModelError,
  isGeminiQuotaError,
};
