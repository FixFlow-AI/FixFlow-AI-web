const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_GEMINI_MODEL_FALLBACKS = 'gemini-2.5-flash,gemini-2.5-flash-lite';
const DEFAULT_GEMINI_STRUCTURED_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_GEMINI_STRUCTURED_FALLBACKS = 'gemini-2.5-flash-lite,gemini-3-flash-preview,gemini-2.5-flash';
const DEFAULT_GEMINI_KEY_GUARD_MS = 15 * 60 * 1000;
const DEFAULT_GEMINI_MAX_QUEUE_WAIT_MS = 20_000;
const DEFAULT_GEMINI_RPM_BY_MODEL = Object.freeze({
  'gemini-3-flash-preview': 5,
  'gemini-3.1-flash-lite-preview': 15,
  'gemini-2.5-flash': 5,
  'gemini-2.5-flash-lite': 10,
});

const AUTH_ERROR_PATTERNS = [
  /api key/i,
  /invalid key/i,
  /unauthorized/i,
  /billing/i,
  /not enabled/i,
  /not configured/i,
  /service disabled/i,
];

const LEAKED_KEY_PATTERNS = [
  /reported as leaked/i,
  /known leaked/i,
  /publicly exposed/i,
  /api key.*blocked/i,
  /blocked.*api key/i,
];

const QUOTA_ERROR_PATTERNS = [
  /rate limit/i,
  /quota/i,
  /resource exhausted/i,
  /too many requests/i,
  /service unavailable/i,
  /high demand/i,
  /overloaded/i,
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

function isGeminiLeakedKeyError(error) {
  const message = getErrorMessage(error);
  return matchesAny(LEAKED_KEY_PATTERNS, message);
}

function isGeminiQuotaError(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  return [429, 500, 503].includes(status) || matchesAny(QUOTA_ERROR_PATTERNS, message);
}

function isGeminiModelError(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  return [400, 404].includes(status) || matchesAny(MODEL_ERROR_PATTERNS, message);
}

function parseModelList(...sources) {
  return sources
    .flatMap((source) => {
      if (Array.isArray(source)) {
        return parseModelList(...source);
      }

      return String(source || '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
    });
}

function getGeminiModelCandidates(...sources) {
  return [...new Set(parseModelList(...sources))];
}

function parseRetryDelayValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const secondsMatch = value.match(/([\d.]+)\s*s/i);
  if (secondsMatch) {
    return Math.ceil(Number(secondsMatch[1]) * 1000);
  }

  const millisMatch = value.match(/(\d+)\s*ms/i);
  if (millisMatch) {
    return Number(millisMatch[1]);
  }

  return null;
}

function extractRetryDelayMs(error) {
  const details = [
    ...(Array.isArray(error?.details) ? error.details : []),
    ...(Array.isArray(error?.error?.details) ? error.error.details : []),
    ...(Array.isArray(error?.response?.data?.error?.details) ? error.response.data.error.details : []),
  ];

  for (const detail of details) {
    const retryDelay = parseRetryDelayValue(detail?.retryDelay);
    if (retryDelay != null) {
      return retryDelay;
    }
  }

  const message = getErrorMessage(error);
  const retryMatch = message.match(/retry in\s+([\d.]+)s/i);
  if (retryMatch) {
    return Math.ceil(Number(retryMatch[1]) * 1000);
  }

  return null;
}

function parseGeminiModelRpmOverrides(raw = '') {
  const overrides = { ...DEFAULT_GEMINI_RPM_BY_MODEL };

  for (const entry of String(raw || '').split(/[,\n;]/)) {
    const [model, rpm] = entry.split(':').map((item) => item?.trim());
    if (!model || !rpm) {
      continue;
    }

    const parsedRpm = Number(rpm);
    if (Number.isFinite(parsedRpm) && parsedRpm > 0) {
      overrides[model] = parsedRpm;
    }
  }

  return overrides;
}

function getGeminiAuthErrorMessage(error, { model } = {}) {
  const providerMessage = getErrorMessage(error);
  const modelSuffix = model ? ` for model "${model}"` : '';
  const providerSuffix = providerMessage ? ` Provider message: ${providerMessage}` : '';

  if (isGeminiLeakedKeyError(error)) {
    return `Gemini API key is blocked because it was reported as leaked. Create a new key in Google AI Studio, replace GEMINI_API_KEY in backend/.env, and restart the backend.${providerSuffix}`;
  }

  if (/api key/i.test(providerMessage) || getErrorStatus(error) === 401) {
    return `Gemini API key is invalid or revoked${modelSuffix}. Create a new key in Google AI Studio, replace GEMINI_API_KEY in backend/.env, and restart the backend.${providerSuffix}`;
  }

  return `Gemini API key was rejected or does not have access${modelSuffix}. Verify the key in Google AI Studio, make sure the Gemini API is enabled for that project, and replace GEMINI_API_KEY in backend/.env if needed.${providerSuffix}`;
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

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:the\s+)?previous\s+instructions/i,
  /ignore\s+(?:the\s+)?above\s+instructions/i,
  /system\s+prompt\s+override/i,
  /you\s+must\s+now\s+act\s+as/i,
  /disregard\s+(?:the\s+)?system/i,
  /stop\s+(?:following\s+)?instructions/i,
  /override\s+(?:the\s+)?instructions/i,
  /\bDAN\s+mode\b/i,
  /new\s+role\s*:/i,
  /translate\s+(?:the\s+)?above\s+and\s+ignore/i,
];

function detectPromptInjection(text) {
  if (typeof text !== 'string') {
    return false;
  }
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_MODEL_FALLBACKS,
  DEFAULT_GEMINI_STRUCTURED_MODEL,
  DEFAULT_GEMINI_STRUCTURED_FALLBACKS,
  DEFAULT_GEMINI_KEY_GUARD_MS,
  DEFAULT_GEMINI_MAX_QUEUE_WAIT_MS,
  DEFAULT_GEMINI_RPM_BY_MODEL,
  createGeminiGuard,
  detectPromptInjection,
  extractRetryDelayMs,
  getGeminiAuthErrorMessage,
  getGeminiModelCandidates,
  getErrorMessage,
  getErrorStatus,
  isGeminiAuthError,
  isGeminiLeakedKeyError,
  isGeminiModelError,
  isGeminiQuotaError,
  parseGeminiModelRpmOverrides,
};
