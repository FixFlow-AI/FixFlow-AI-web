const Anthropic = require('@anthropic-ai/sdk');
const { env } = require('../../config/env');

let anthropicClient = null;

function getAnthropicClient() {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  return anthropicClient;
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

async function* streamProposal(system, userMessage, retryCount = 0) {
  if (env.USE_FAKE_LLM) {
    yield* streamMockProposal(userMessage);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.STREAM_TIMEOUT_MS);

  try {
    const anthropic = getAnthropicClient();
    const stream = anthropic.messages.stream(
      {
        model: env.ANTHROPIC_MODEL,
        max_tokens: 8000,
        temperature: 0.3,
        system,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    );

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  } catch (error) {
    if (error?.status === 429 && retryCount < 3) {
      const waitMs = Math.pow(2, retryCount) * 1000;
      console.log(JSON.stringify({ event: 'LLM_RETRY', attempt: retryCount + 1, waitMs }));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      yield* streamProposal(system, userMessage, retryCount + 1);
      return;
    }

    if (error?.name === 'AbortError' || error?.name === 'APIUserAbortError') {
      throw new Error(`LLM request timed out after ${env.STREAM_TIMEOUT_MS}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { streamProposal, buildMockProposal };
