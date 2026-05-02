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

async function generateStructuredJSON({
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

module.exports = {
  generateStructuredJSON,
};
