const { GoogleGenAI } = require('@google/genai');
const { env } = require('../../config/env');
const { RESPONSE_JSON_SCHEMA } = require('./promptBuilder');
const {
  createGeminiGuard,
  getGeminiModelCandidates,
  isGeminiAuthError,
  isGeminiModelError,
  isGeminiQuotaError,
} = require('./geminiGuard');

let geminiClient = null;
const geminiGuard = createGeminiGuard({ cooldownMs: env.GEMINI_KEY_GUARD_MS });

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  return geminiClient;
}

function buildGeminiAuthError(error) {
  const message = 'Gemini API key was rejected or does not have access to the selected model.';
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

async function* streamGeminiModel(system, userMessage, model, retryCount = 0) {
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
    if (isGeminiQuotaError(error) && retryCount < 3) {
      const waitMs = Math.pow(2, retryCount) * 1000;
      console.log(
        JSON.stringify({
          event: 'LLM_RETRY',
          model,
          attempt: retryCount + 1,
          waitMs,
        })
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      yield* streamGeminiModel(system, userMessage, model, retryCount + 1);
      return;
    }

    if (error?.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${env.STREAM_TIMEOUT_MS}ms.`);
    }

    if (isGeminiAuthError(error)) {
      geminiGuard.markHardFailure(error);
      throw buildGeminiAuthError(error);
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

async function* streamProposal(system, userMessage) {
  if (env.USE_FAKE_LLM) {
    yield* streamMockProposal(userMessage);
    return;
  }

  geminiGuard.assertAvailable();

  const models = getGeminiModelCandidates(env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL);
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    let emittedChunk = false;

    try {
      for await (const chunk of streamGeminiModel(system, userMessage, model)) {
        emittedChunk = true;
        yield chunk;
      }
      return;
    } catch (error) {
      lastError = error;

      if (error?.code === 'GEMINI_AUTH_ERROR') {
        throw error;
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

  if (lastError) {
    throw lastError;
  }
}

module.exports = { streamProposal, buildMockProposal };
