const { env } = require('../../config/env');
const { RESPONSE_JSON_SCHEMA } = require('./promptBuilder');
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
  isAuthProviderError,
  isRetryableProviderError,
  streamOllamaProvider,
  streamOpenAiCompatibleProvider,
} = require('./providerRequests');
const { reportProviderError, reportProviderSuccess } = require('../rateLimit/rateLimitMonitor');
const { fingerprintApiKey } = require('../rateLimit/rateLimitStateStore');

const geminiGuard = createGeminiGuard({ cooldownMs: env.GEMINI_KEY_GUARD_MS });
const geminiKeyFingerprint = fingerprintApiKey(env.GEMINI_API_KEY);

function buildGeminiAuthError(error, model) {
  const message = getGeminiAuthErrorMessage(error, { model });
  const wrappedError = new Error(message);
  wrappedError.code = 'GEMINI_AUTH_ERROR';
  wrappedError.status = 503;
  wrappedError.cause = error;
  return wrappedError;
}

function buildGeminiRequest(system, userMessage, model) {
  return {
    model,
    contents: userMessage,
    config: {
      temperature: 0.3,
      maxOutputTokens: 8000,
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  };
}

async function* streamGeminiModel(system, userMessage, model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.STREAM_TIMEOUT_MS);

  try {
    const gemini = getGeminiClient();
    const request = buildGeminiRequest(system, userMessage, model);
    const stream = await gemini.models.generateContentStream({
      ...request,
      config: { ...request.config, abortSignal: controller.signal },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      event: 'GEMINI_STREAM_ERROR',
      model,
      message: error.message,
      stack: error.stack,
    }, null, 2));

    if (error?.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${env.STREAM_TIMEOUT_MS}ms.`);
    }

    if (isGeminiAuthError(error)) {
      geminiGuard.markHardFailure(error);
      throw buildGeminiAuthError(error, model);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildMockProposal(userMessage) {
  const brief = userMessage.split('\n\n').slice(1).join('\n\n').trim();
  const summarySeed = brief
    .replace(/\s+/g, ' ')
    .split('.')
    .find(Boolean)
    ?.slice(0, 160) || 'This brief describes a custom digital product initiative.';

  return JSON.stringify(
    {
      project_summary: `${summarySeed}. The recommended delivery approach balances product discovery, platform hardening, and phased rollout to reduce execution risk.`,
      features: [
        {
          title: 'Discovery and Requirements Mapping',
          description: 'Clarify target users, workflows, and must-have success metrics before implementation begins.',
          technical_approach: 'Run a short discovery sprint, model the core flows, and produce an implementation backlog with acceptance criteria.',
          complexity: 'Low',
          confidence: 'High',
          confidence_pct: 91,
          area: 'Product Strategy',
        },
        {
          title: 'Core Platform Build',
          description: 'Implement the core application flows, admin controls, and data integrations required by the brief.',
          technical_approach: 'Build modular services and responsive frontend flows with API contracts, validation, and observability baked in.',
          complexity: 'Medium',
          confidence: 'High',
          confidence_pct: 84,
          area: 'Application Engineering',
        },
        {
          title: 'Analytics and Operational Visibility',
          description: 'Instrument the product so the team can measure adoption, reliability, and performance after launch.',
          technical_approach: 'Add event tracking, structured logging, alerting, and a lightweight reporting layer tied to product KPIs.',
          complexity: 'Medium',
          confidence: 'Medium',
          confidence_pct: 76,
          area: 'Analytics',
        },
      ],
      risks: [
        {
          label: 'Requirements drift during delivery',
          severity: 67,
          mitigation: 'Time-box discovery decisions and gate new feature requests behind explicit scope review.',
          category: 'Scope',
        },
        {
          label: 'Integration unknowns',
          severity: 58,
          mitigation: 'Validate third-party contracts early with proof-of-concept work before the core build locks in.',
          category: 'Integration',
        },
      ],
      timeline: [
        {
          phase: 'Discovery',
          duration: '2 weeks',
          tasks: ['Stakeholder interviews', 'Requirements mapping', 'Architecture outline'],
          dependencies: [],
        },
        {
          phase: 'Implementation',
          duration: '6 weeks',
          tasks: ['Core frontend and backend delivery', 'Data model setup', 'Integration work'],
          dependencies: ['Discovery'],
        },
        {
          phase: 'QA and Launch',
          duration: '2 weeks',
          tasks: ['End-to-end validation', 'Bug fixing', 'Launch checklist'],
          dependencies: ['Implementation'],
        },
      ],
      effort: [
        {
          label: 'Planning',
          percentage: 20,
          timeframe: '1-2 weeks',
          description: 'Discovery, architecture shaping, and backlog definition.',
        },
        {
          label: 'Build',
          percentage: 60,
          timeframe: '4-6 weeks',
          description: 'Core engineering work across frontend, backend, and integrations.',
        },
        {
          label: 'QA and Launch',
          percentage: 20,
          timeframe: '1-2 weeks',
          description: 'Verification, release readiness, and rollout support.',
        },
      ],
      market: [
        {
          title: 'Expectation for fast iteration',
          description: 'Teams increasingly expect products to ship in small, validated increments instead of one large release.',
          trend: 'up',
          relevance: 82,
        },
      ],
      impact: [
        {
          title: 'Faster path to launch',
          description: 'A phased delivery plan reduces uncertainty and gets user feedback earlier.',
          impact_score: 86,
          category: 'Delivery',
        },
      ],
    },
    null,
    2
  );
}

async function* streamMockProposal(userMessage) {
  const mockJson = buildMockProposal(userMessage);

  for (let index = 0; index < mockJson.length; index += 120) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    yield mockJson.slice(index, index + 120);
  }
}

async function* streamGeminiWithFallback(system, userMessage, context = {}) {
  geminiGuard.assertAvailable();

  const models = getGeminiModelCandidates(
    env.GEMINI_MODEL,
    env.GEMINI_FALLBACK_MODEL,
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
      let emittedChunk = false;

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
        for await (const chunk of streamGeminiModel(system, userMessage, model)) {
          emittedChunk = true;
          yield chunk;
        }
        reportProviderSuccess({
          provider: 'gemini',
          apiKeyFingerprint: geminiKeyFingerprint,
          userId: context.userId,
          model,
          requestId: context.requestId || null,
          metadata: { path: 'streamProposal' },
        });
        return;
      } catch (error) {
        lastError = error;

        if (error?.code === 'GEMINI_AUTH_ERROR') {
          throw error;
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
            metadata: { path: 'streamProposal' },
          });
          console.log(
            JSON.stringify({
              event: 'LLM_MODEL_COOLDOWN',
              model,
              retryMs,
            })
          );
        }

        if (!emittedChunk && index < models.length - 1 && (isGeminiQuotaError(error) || isGeminiModelError(error))) {
          console.log(
            JSON.stringify({
              event: 'LLM_MODEL_FALLBACK',
              from: model,
              to: models[index + 1],
              reason: error.message,
            })
          );
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

  throw new Error(
    `All configured Gemini models are currently rate-limited beyond the local queue window (${env.GEMINI_MAX_QUEUE_WAIT_MS}ms). Try again shortly or enable billing in Google AI Studio.`
  );
}

function buildProviderAttempts(provider) {
  if (provider.id === 'gemini') {
    return [provider];
  }

  return (provider.models.length ? provider.models : [provider.primaryModel])
    .filter(Boolean)
    .map((model) => ({ ...provider, model }));
}

async function* streamProviderAttempt(provider, system, userMessage, options = {}) {
  if (provider.id === 'gemini') {
    yield* streamGeminiWithFallback(system, userMessage, options.context || {});
    return;
  }

  if (provider.kind === 'ollama') {
    yield* streamOllamaProvider(provider, {
      system,
      user: userMessage,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      jsonMode: options.jsonMode,
    });
    return;
  }

  yield* streamOpenAiCompatibleProvider(provider, {
    system,
    user: userMessage,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    jsonMode: options.jsonMode,
  });
}

async function* streamLlmChat(system, userMessage, options = {}) {
  const providers = getConfiguredLlmProviders();

  if (!providers.length) {
    throw new Error('No LLM provider is configured. Set GEMINI_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_API_KEY.');
  }

  let lastError = null;
  let lastProvider = null;

  for (const provider of providers) {
    const attempts = buildProviderAttempts(provider);

    for (const attempt of attempts) {
      let emittedChunk = false;
      try {
        for await (const chunk of streamProviderAttempt(attempt, system, userMessage, options)) {
          emittedChunk = true;
          yield chunk;
        }

        if (attempt.id !== 'gemini') {
          reportProviderSuccess({
            provider: attempt.id,
            apiKeyFingerprint: fingerprintApiKey(attempt.apiKey),
            userId: options.context?.userId,
            model: attempt.model || attempt.primaryModel,
            requestId: options.context?.requestId || null,
            metadata: { path: options.path || 'streamLlmChat' },
          });
        }
        return;
      } catch (error) {
        lastError = error;
        lastProvider = attempt;

        console.error(JSON.stringify({
          level: 'ERROR',
          timestamp: new Date().toISOString(),
          event: 'LLM_PROVIDER_ATTEMPT_FAILED',
          provider: attempt.id,
          model: attempt.model || attempt.primaryModel,
          message: error.message,
          stack: error.stack,
        }, null, 2));

        if (attempt.id !== 'gemini') {
          reportProviderError({
            provider: attempt.id,
            apiKeyFingerprint: fingerprintApiKey(attempt.apiKey),
            userId: options.context?.userId,
            statusCode: Number(error?.status || 500),
            isQuotaError: Number(error?.status) === 429,
            message: error?.message || '',
            model: attempt.model || attempt.primaryModel,
            requestId: options.context?.requestId || null,
            metadata: { path: options.path || 'streamLlmChat' },
          });
        }

        if (emittedChunk) {
          throw error;
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
    `All configured LLM providers failed before streaming a complete response. Last provider: ${lastProvider?.label || lastProvider?.id || 'unknown'}. Last error: ${lastError?.message || 'unknown error'}`
  );
}

async function* streamProposal(system, userMessage, context = {}) {
  if (env.USE_FAKE_LLM) {
    yield* streamMockProposal(userMessage);
    return;
  }

  yield* streamLlmChat(system, userMessage, {
    context,
    jsonMode: true,
    maxOutputTokens: 8000,
    path: 'streamProposal',
    temperature: 0.3,
  });
}

module.exports = {
  buildMockProposal,
  streamLlmChat,
  streamProposal,
};
