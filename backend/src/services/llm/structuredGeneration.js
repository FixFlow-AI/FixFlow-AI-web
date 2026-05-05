const { env } = require('../../config/env');
const {
  createGeminiGuard,
  extractRetryDelayMs,
  getGeminiAuthErrorMessage,
  getGeminiModelCandidates,
  getErrorStatus,
  isGeminiAuthError,
  isGeminiModelError,
  isGeminiQuotaError,
} = require('./geminiGuard');
const { geminiModelCoordinator } = require('./modelCoordinator');
const { getGeminiClient } = require('./provider');
const { getConfiguredLlmProviders } = require('./providerRegistry');
const {
  completeOllamaProvider,
  completeOpenAiCompatibleProvider,
  isAuthProviderError,
  isRetryableProviderError,
} = require('./providerRequests');
const { reportProviderError, reportProviderSuccess } = require('../rateLimit/rateLimitMonitor');
const { fingerprintApiKey } = require('../rateLimit/rateLimitStateStore');

const geminiGuard = createGeminiGuard({ cooldownMs: env.GEMINI_KEY_GUARD_MS });
const geminiKeyFingerprint = fingerprintApiKey(env.GEMINI_API_KEY);

function extractJsonText(response) {
  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  return String(response?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function runStructuredRequest({ model, system, user, jsonSchema, temperature, maxOutputTokens }) {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model,
    contents: user,
    config: {
      temperature,
      maxOutputTokens,
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema,
    },
  });

  return extractJsonText(response);
}

async function generateGeminiStructuredJSON({
  system,
  user,
  jsonSchema,
  temperature = 0.2,
  maxOutputTokens = 4000,
  context = {},
}) {
  geminiGuard.assertAvailable();

  const models = getGeminiModelCandidates(
    env.GEMINI_STRUCTURED_MODEL || env.GEMINI_FALLBACK_MODEL,
    env.GEMINI_STRUCTURED_FALLBACKS,
    env.GEMINI_MODEL_FALLBACKS
  );
  let lastError = null;
  let waitCycles = 0;

  while (waitCycles <= models.length) {
    let attemptedModel = false;

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      const reservation = await geminiModelCoordinator.acquire(model);

      if (!reservation.ok) {
        continue;
      }

      attemptedModel = true;

      if (reservation.waitMs > 0) {
        console.log(
          JSON.stringify({
            event: 'LLM_MODEL_WAIT',
            model,
            waitMs: reservation.waitMs,
          })
        );
      }

      try {
        const result = await runStructuredRequest({
          model,
          system,
          user,
          jsonSchema,
          temperature,
          maxOutputTokens,
        });
        reportProviderSuccess({
          provider: 'gemini',
          apiKeyFingerprint: geminiKeyFingerprint,
          userId: context.userId,
          model,
          requestId: context.requestId || null,
          metadata: { path: 'generateStructuredJSON' },
        });
        return result;
      } catch (error) {
        lastError = error;

        if (isGeminiAuthError(error)) {
          geminiGuard.markHardFailure(error);
          throw new Error(getGeminiAuthErrorMessage(error, { model }));
        }

        if (isGeminiQuotaError(error)) {
          const retryMs = geminiModelCoordinator.markQuotaError(model, error);
          reportProviderError({
            provider: 'gemini',
            apiKeyFingerprint: geminiKeyFingerprint,
            userId: context.userId,
            statusCode: getErrorStatus(error) || 429,
            isQuotaError: true,
            retryAfterSec: Math.ceil((extractRetryDelayMs(error) || retryMs || 0) / 1000) || null,
            message: error?.message || '',
            model,
            requestId: context.requestId || null,
            metadata: { path: 'generateStructuredJSON' },
          });
          console.log(
            JSON.stringify({
              event: 'LLM_MODEL_COOLDOWN',
              model,
              retryMs,
            })
          );
        }

        if (index < models.length - 1 && (isGeminiQuotaError(error) || isGeminiModelError(error))) {
          continue;
        }

        throw error;
      }
    }

    if (!attemptedModel) {
      const waitMs = geminiModelCoordinator.getEarliestAvailabilityDelayMs(models);
      if (waitMs > 0 && waitMs <= env.GEMINI_MAX_QUEUE_WAIT_MS) {
        console.log(
          JSON.stringify({
            event: 'LLM_GLOBAL_WAIT',
            waitMs,
            models,
          })
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        waitCycles += 1;
        continue;
      }
    }

    break;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Structured Gemini generation failed without an explicit error.');
}

function buildProviderAttempts(provider) {
  if (provider.id === 'gemini') {
    return [provider];
  }

  return (provider.models.length ? provider.models : [provider.primaryModel])
    .filter(Boolean)
    .map((model) => ({ ...provider, model }));
}

async function runProviderStructuredJSON(provider, request) {
  if (provider.id === 'gemini') {
    return generateGeminiStructuredJSON(request);
  }

  const payload = {
    system: request.system,
    user: request.user,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    jsonMode: true,
  };

  if (provider.kind === 'ollama') {
    return completeOllamaProvider(provider, payload);
  }

  return completeOpenAiCompatibleProvider(provider, payload);
}

async function generateStructuredJSON({
  system,
  user,
  jsonSchema,
  temperature = 0.2,
  maxOutputTokens = 4000,
  context = {},
}) {
  const providers = getConfiguredLlmProviders();
  if (!providers.length) {
    throw new Error('No LLM provider is configured. Set GEMINI_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_API_KEY.');
  }

  const request = { system, user, jsonSchema, temperature, maxOutputTokens, context };
  let lastError = null;
  let lastProvider = null;

  for (const provider of providers) {
    for (const attempt of buildProviderAttempts(provider)) {
      try {
        const result = await runProviderStructuredJSON(attempt, request);

        if (attempt.id !== 'gemini') {
          reportProviderSuccess({
            provider: attempt.id,
            apiKeyFingerprint: fingerprintApiKey(attempt.apiKey),
            userId: context.userId,
            model: attempt.model || attempt.primaryModel,
            requestId: context.requestId || null,
            metadata: { path: 'generateStructuredJSON' },
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        lastProvider = attempt;

        if (attempt.id !== 'gemini') {
          reportProviderError({
            provider: attempt.id,
            apiKeyFingerprint: fingerprintApiKey(attempt.apiKey),
            userId: context.userId,
            statusCode: Number(error?.status || 500),
            isQuotaError: Number(error?.status) === 429,
            message: error?.message || '',
            model: attempt.model || attempt.primaryModel,
            requestId: context.requestId || null,
            metadata: { path: 'generateStructuredJSON' },
          });
        }

        const shouldTryNext =
          attempt.id === 'gemini' ||
          isAuthProviderError(error) ||
          isRetryableProviderError(error);

        console.log(
          JSON.stringify({
            event: 'LLM_PROVIDER_FALLBACK',
            from: attempt.id,
            model: attempt.model || attempt.primaryModel,
            reason: error?.message || 'provider failed',
            nextAllowed: shouldTryNext,
          })
        );

        if (shouldTryNext) {
          continue;
        }

        throw error;
      }
    }
  }

  throw new Error(
    `All configured structured LLM providers failed. Last provider: ${lastProvider?.label || lastProvider?.id || 'unknown'}. Last error: ${lastError?.message || 'unknown error'}`
  );
}

module.exports = {
  generateStructuredJSON,
};
