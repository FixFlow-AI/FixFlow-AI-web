/**
 * HTTP client for the Python AI service (`ai-service/`).
 *
 * The TypeScript backend is the gateway: it authenticates the request, calls
 * this client to run the LLM feature in Python, then persists / returns the
 * result. All four AI features (AI-001..004) live behind these calls.
 *
 * Config:
 *   AI_SERVICE_URL   - base URL of the Python service (e.g. http://localhost:8000)
 *   AI_SERVICE_TOKEN - optional shared secret; sent as `x-ai-service-token`
 */
import type {
  ConfidenceGridResult,
  ContractExtensionsOutput,
  InterviewOutput,
  Proposal,
  ParseBriefResponse,
  DiscoveryTurn,
  DiscoveryAnswer,
  ExecutionPlan,
  PlanDiagnostics,
} from '../types/ai.js';
import type { GithubScanResult } from '../types/github.js';

export function getAiServiceUrl(): string {
  let raw = (process.env.AI_SERVICE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    raw = `http://${raw}`;
  }
  return raw;
}

export function getPublicAiServiceUrl(): string {
  let raw = (process.env.PUBLIC_AI_SERVICE_URL || '').trim().replace(/\/+$/, '');
  if (raw) {
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    return raw;
  }
  // Auto-derive on Render if AI_SERVICE_URL contains fixflowai-ai-service or internal host:port
  const primary = getAiServiceUrl();
  if (primary.includes('fixflowai-ai-service')) {
    return 'https://fixflowai-ai-service.onrender.com';
  }
  return '';
}

const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';

/** True when the AI service base URL is configured. */
export function isAiServiceConfigured(): boolean {
  return Boolean(getAiServiceUrl() || getPublicAiServiceUrl());
}

/** Error carrying the upstream HTTP status so routes can propagate it. */
export class AiServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 4,
  delayMs = 1000,
  maxDelayMs = 3000,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // If 502/503/504 (e.g. Render container cold start / spin-down waking up), retry
      if ([502, 503, 504].includes(res.status) && i < retries - 1) {
        console.warn(`[AIClient] Upstream ${url} returned ${res.status}. Cold start warming up (${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, Math.min(maxDelayMs, delayMs * (1 + i * 0.5))));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        console.warn(`[AIClient] Fetch error on ${url}: ${err instanceof Error ? err.message : String(err)}. Retrying (${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, Math.min(maxDelayMs, delayMs * (1 + i * 0.5))));
      }
    }
  }
  if (lastErr) throw lastErr;
  throw new Error(`Fetch to ${url} failed after ${retries} retries.`);
}

/**
 * Retry budget for a given attempt index against the ordered list of
 * candidate base URLs. Render's private network CANNOT deliver inbound
 * traffic to a free-tier web service at all (confirmed in Render's docs:
 * "Free web services can send private network requests, but they can't
 * receive them") — so when `AI_SERVICE_URL` points at a private hostport,
 * that attempt is not slow, it is guaranteed to fail. We give it a cheap,
 * fast-fail budget instead of burning real time on it.
 *
 * The public HTTPS URL is the only path that can actually wake a sleeping
 * free instance (it goes through Render's edge). Render's own dashboard
 * warns free instances "can delay requests by 50 seconds or more" — so the
 * FINAL candidate in the list gets a retry budget sized to survive that.
 */
function retryBudgetFor(index: number, total: number): { retries: number; maxDelayMs: number } {
  const isFinalCandidate = index === total - 1;
  return isFinalCandidate ? { retries: 14, maxDelayMs: 6000 } : { retries: 2, maxDelayMs: 1500 };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const primaryUrl = getAiServiceUrl();
  const publicUrl = getPublicAiServiceUrl();

  if (!primaryUrl && !publicUrl) {
    throw new AiServiceError(503, 'AI_SERVICE_URL is not configured on the server.');
  }

  const urlsToTry = [primaryUrl, publicUrl].filter((u, idx, self) => Boolean(u) && self.indexOf(u) === idx);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['x-ai-service-token'] = AI_SERVICE_TOKEN;

  let lastError: Error | null = null;

  for (let idx = 0; idx < urlsToTry.length; idx++) {
    const baseUrl = urlsToTry[idx];
    try {
      const { retries, maxDelayMs } = retryBudgetFor(idx, urlsToTry.length);
      const res = await fetchWithRetry(
        `${baseUrl}${path}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        retries,
        1000,
        maxDelayMs,
      );

      const text = await res.text();
      let payload: any = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { detail: text };
        }
      }

      if (!res.ok) {
        const detail = payload?.detail || payload?.error || res.statusText;
        throw new AiServiceError(res.status, `AI service error (${res.status}): ${detail}`);
      }

      return payload as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AIClient] Call to ${baseUrl}${path} failed: ${lastError.message}. Trying next endpoint...`);
    }
  }

  throw new AiServiceError(
    502,
    `AI service is unreachable at ${urlsToTry.join(' / ')}: ${lastError?.message || 'fetch failed'}`,
  );
}

function getFallbackProposal(briefText: string): Proposal {
  return {
    project_summary: briefText.trim() || 'Custom Technical Project Proposal',
    features: [
      {
        title: 'Core Module Deployment',
        description: 'Primary system features and architectural components based on your project description.',
        technical_approach: 'Implement modular TypeScript/Node.js microservices with clean API boundaries.',
        complexity: 'Medium',
        confidence: 'High',
        confidence_pct: 85,
        area: 'Engineering',
      },
      {
        title: 'Security & Access Control',
        description: 'Authentication, role-based authorization, and token verification.',
        technical_approach: 'Configure OAuth 2.0 / JWT session verification with input sanitization.',
        complexity: 'Low',
        confidence: 'High',
        confidence_pct: 90,
        area: 'Security Operations',
      },
      {
        title: 'Integration & Testing',
        description: 'End-to-end testing, API integration verification, and deployment pipeline.',
        technical_approach: 'Automated test suites with continuous integration checks before release.',
        complexity: 'Medium',
        confidence: 'High',
        confidence_pct: 80,
        area: 'Quality Assurance',
      },
    ],
    risks: [
      {
        label: 'Under-specified API edge cases',
        severity: 45,
        mitigation: 'Conduct early architecture review and enforce strict schema validation.',
        category: 'Scope Management',
      },
      {
        label: 'Upstream service latency',
        severity: 40,
        mitigation: 'Implement exponential backoff retries and circuit-breaker fallbacks.',
        category: 'Technical Integration',
      },
    ],
    timeline: [
      {
        phase: 'Phase 1: Architecture & Setup',
        duration: '1 Week',
        tasks: ['Establish codebase structure', 'Configure database schemas', 'Verify API contracts'],
        dependencies: [],
      },
      {
        phase: 'Phase 2: Core Development',
        duration: '2 Weeks',
        tasks: ['Build feature handlers', 'Implement state machines', 'Connect UI components'],
        dependencies: ['Phase 1'],
      },
      {
        phase: 'Phase 3: QA & Final Delivery',
        duration: '1 Week',
        tasks: ['Execute integration test suite', 'Security audit', 'Production deployment'],
        dependencies: ['Phase 2'],
      },
    ],
    delivery_plan: {
      mode: 'weekly',
      generatedFrom: 'derived',
      weeks: [
        {
          id: 'week-1',
          label: 'Week 1: Setup & Core',
          startWeek: 1,
          endWeek: 1,
          sourcePhase: 'Phase 1',
          goals: ['Initial system setup and schema verification'],
          tasks: [
            {
              id: 'task-1',
              title: 'Establish repository structure and environment variables',
              owner: 'team',
              status: 'planned',
              notify: false,
            },
          ],
          deliverables: ['Configured environment', 'Verified backend endpoints'],
          dependencies: [],
        },
        {
          id: 'week-2',
          label: 'Week 2-3: Development',
          startWeek: 2,
          endWeek: 3,
          sourcePhase: 'Phase 2',
          goals: ['Feature implementation and UI connection'],
          tasks: [
            {
              id: 'task-2',
              title: 'Develop core API routes and database models',
              owner: 'team',
              status: 'planned',
              notify: false,
            },
          ],
          deliverables: ['Working feature endpoints', 'Connected React dashboard'],
          dependencies: ['week-1'],
        },
        {
          id: 'week-4',
          label: 'Week 4: Delivery',
          startWeek: 4,
          endWeek: 4,
          sourcePhase: 'Phase 3',
          goals: ['Final testing and launch'],
          tasks: [
            {
              id: 'task-3',
              title: 'Perform end-to-end verification and deployment',
              owner: 'team',
              status: 'planned',
              notify: false,
            },
          ],
          deliverables: ['Deploys live in production', 'Passing test suite'],
          dependencies: ['week-2'],
        },
      ],
      roadmap: [
        {
          id: 'rm-1',
          title: 'MVP Release',
          targetWeek: 4,
          sourceWeekIds: ['week-4'],
          status: 'planned',
        },
      ],
      backlog: [],
      notificationDefaults: {
        enabled: true,
        channels: ['in_app'],
        events: ['goal_completed'],
      },
    },
    effort: [
      {
        label: 'Development & Testing',
        percentage: 70,
        timeframe: '3 Weeks',
        description: 'Full stack development, unit testing, and component integration.',
      },
      {
        label: 'Architecture & Ops',
        percentage: 30,
        timeframe: '1 Week',
        description: 'System design, security verification, and deployment configuration.',
      },
    ],
    market: [
      {
        title: 'Modern Architecture Best Practices',
        description: 'Alignment with modern event-driven serverless & API-first standards.',
        trend: 'up',
        relevance: 90,
      },
    ],
    impact: [
      {
        title: 'Workflow Automation',
        description: 'Reduces manual overhead and speeds up overall time-to-market.',
        impact_score: 85,
        category: 'Operational Efficiency',
      },
    ],
  };
}

/** AI-001 — parse an unstructured brief into a structured proposal. */
export async function parseBrief(
  briefText: string,
): Promise<ParseBriefResponse> {
  try {
    return await postJson<ParseBriefResponse>('/ai/brief/parse', { briefText });
  } catch (err) {
    console.warn('[AIClient] parseBrief call failed, using safe proposal fallback:', (err as Error).message);
    return {
      proposal: getFallbackProposal(briefText),
      source: 'fallback',
      degradedReason: 'ai_service_unreachable',
    };
  }
}

/** AI-002 — multi-agent evaluation + self-correction. */
export async function evaluateProposal(
  briefText: string,
  proposal: Proposal,
): Promise<ConfidenceGridResult> {
  return postJson<ConfidenceGridResult>('/ai/confidence/evaluate', { briefText, proposal });
}

/** AI-003 — generate targeted technical interview questions. */
export async function generateInterviewQuestions(
  briefText: string,
  githubScan: unknown,
  missingSkills: string[],
): Promise<InterviewOutput> {
  return postJson<InterviewOutput>('/ai/interview/generate', {
    briefText,
    githubScan,
    missingSkills,
  });
}

/** AI-004 — suggest contract extension milestones + a client offer draft. */
export async function generateContractExtensions(
  completedDeliverables: unknown,
  chatSummary: string,
): Promise<ContractExtensionsOutput> {
  return postJson<ContractExtensionsOutput>('/ai/extensions/generate', {
    completedDeliverables,
    chatSummary,
  });
}

function getFallbackDiscoveryTurn(
  initialRequest: string,
  answers: DiscoveryAnswer[],
): DiscoveryTurn {
  const count = answers.length;

  if (count === 0) {
    return {
      status: 'questioning',
      confidence: 35,
      missing_information: ['Target Users', 'Platform', 'Timeline', 'Budget'],
      next_question: {
        category: 'Target Users',
        question: 'Who are the primary target users for this application?',
        options: [
          { key: 'A', label: 'Individual Consumers (B2C)' },
          { key: 'B', label: 'Businesses & Internal Teams (B2B)' },
          { key: 'C', label: 'Both Consumers and Businesses' },
          { key: 'D', label: 'Developers / Technical API Users' },
        ],
        allow_custom: true,
        multi_select: false,
      },
      brief: null,
    };
  }

  if (count === 1) {
    return {
      status: 'questioning',
      confidence: 55,
      missing_information: ['Platform', 'Timeline', 'Budget'],
      next_question: {
        category: 'Platform',
        question: 'What primary platform should be targeted first?',
        options: [
          { key: 'A', label: 'Web Application (Responsive Desktop & Mobile)' },
          { key: 'B', label: 'Native Mobile App (iOS & Android)' },
          { key: 'C', label: 'Backend API & Microservices' },
          { key: 'D', label: 'Cross-platform Web & Mobile Package' },
        ],
        allow_custom: true,
        multi_select: false,
      },
      brief: null,
    };
  }

  if (count === 2) {
    return {
      status: 'questioning',
      confidence: 75,
      missing_information: ['Timeline', 'Budget'],
      next_question: {
        category: 'Timeline',
        question: 'What is your target delivery timeline for the MVP?',
        options: [
          { key: 'A', label: '1-2 Weeks (Urgent MVP)' },
          { key: 'B', label: '1 Month (Standard Delivery)' },
          { key: 'C', label: '2-3 Months (Comprehensive Build)' },
          { key: 'D', label: 'Flexible / Quality First' },
        ],
        allow_custom: true,
        multi_select: false,
      },
      brief: null,
    };
  }

  if (count === 3) {
    return {
      status: 'questioning',
      confidence: 85,
      missing_information: ['Budget'],
      next_question: {
        category: 'Budget',
        question: 'What is your target budget range for this engagement?',
        options: [
          { key: 'A', label: '$1,000 - $3,000 USD' },
          { key: 'B', label: '$3,000 - $7,000 USD' },
          { key: 'C', label: '$7,000 - $15,000 USD' },
          { key: 'D', label: 'Flexible / Open for Proposal' },
        ],
        allow_custom: true,
        multi_select: false,
      },
      brief: null,
    };
  }

  return {
    status: 'complete',
    confidence: 95,
    missing_information: [],
    next_question: null,
    brief: {
      project_goal: initialRequest.slice(0, 100),
      target_users: answers.find((a) => a.question.toLowerCase().includes('users'))?.answer || 'General Users',
      platform: answers.find((a) => a.question.toLowerCase().includes('platform'))?.answer || 'Web Application',
      industry: 'Software Development',
      problem_statement: initialRequest,
      core_features: [
        'Core application features',
        'Responsive UI/UX design',
        'Secure API & backend services',
      ],
      nice_to_have_features: ['Analytics dashboard', 'Automated notifications'],
      integrations: ['Payment Gateway', 'OAuth authentication'],
      authentication: 'JWT / OAuth 2.0',
      admin_panel: true,
      ai_features: ['Smart recommendation engine'],
      timeline: answers.find((a) => a.question.toLowerCase().includes('timeline'))?.answer || '1 Month',
      budget: answers.find((a) => a.question.toLowerCase().includes('budget'))?.answer || '$3,000 - $7,000 USD',
      design_style: 'Modern Glassmorphic Dark Mode',
      technical_preferences: ['React', 'Node.js', 'PostgreSQL / DynamoDB'],
      existing_assets: ['Brand identity guidelines'],
      success_criteria: 'On-time MVP delivery with high code quality and secure payments',
    },
  };
}

/**
 * Requirement Discovery Agent (Talent section) — one adaptive turn. Given the
 * initial request and the answers gathered so far, returns the next
 * multiple-choice question or the finished structured brief.
 */
export async function runDiscoveryTurn(
  initialRequest: string,
  answers: DiscoveryAnswer[],
): Promise<DiscoveryTurn> {
  try {
    return await postJson<DiscoveryTurn>('/ai/discovery/next', { initialRequest, answers });
  } catch (err) {
    console.warn('[AIClient] runDiscoveryTurn call failed, using safe discovery turn fallback:', (err as Error).message);
    return getFallbackDiscoveryTurn(initialRequest, answers);
  }
}

// ---- AI-008: deep execution plan ----

export interface GeneratePlanResponse {
  executionPlan: ExecutionPlan;
  diagnostics: PlanDiagnostics;
}

/** AI-008 — build (or regenerate a section of) a deep v2 execution plan. */
export async function generateExecutionPlan(body: {
  proposal: Proposal;
  briefText?: string;
  scope?: 'all' | 'architecture' | 'timeline';
  existingPlan?: ExecutionPlan | null;
  preserveClientEdits?: boolean;
}): Promise<GeneratePlanResponse> {
  return postJson<GeneratePlanResponse>('/ai/plan/generate', {
    proposal: body.proposal,
    briefText: body.briefText ?? null,
    scope: body.scope ?? 'all',
    existingPlan: body.existingPlan ?? null,
    preserveClientEdits: body.preserveClientEdits ?? true,
  });
}

/** AI-008 — recompute deterministic diagnostics for a plan (validate-on-write). */
export async function validateExecutionPlan(executionPlan: ExecutionPlan): Promise<PlanDiagnostics> {
  return postJson<PlanDiagnostics>('/ai/plan/validate', { executionPlan });
}

export interface GithubScanRequestBody {
  githubUsername: string;
  accessToken?: string;
  topN?: number;
  /** Grounding context from the stored profile snapshot (roles/01a). */
  profileReadme?: string;
  profileBio?: string;
}

/** Roles/01 — full GitHub onboarding scan (blocking; returns the whole result). */
export async function scanGithub(body: GithubScanRequestBody): Promise<GithubScanResult> {
  return postJson<GithubScanResult>('/ai/github/scan', body);
}

/**
 * Roles/01 — open the streaming scan (Server-Sent Events). Returns the raw
 * `Response` so the caller can read the SSE body and persist/forward each
 * segment as it arrives. The GitHub access token is used only here.
 */
export async function openGithubScanStream(body: GithubScanRequestBody): Promise<Response> {
  // Mirror postJson's dual-URL fallback: on Render, the private hostport
  // (AI_SERVICE_URL) connects directly to the AI service container and fails
  // outright if it's asleep (free-tier spin-down), because private networking
  // bypasses the public edge that would otherwise wake it. The public HTTPS
  // URL goes through that edge and can wake a sleeping instance, so it must
  // be tried as a fallback rather than only as a config alternative.
  const primaryUrl = getAiServiceUrl();
  const publicUrl = getPublicAiServiceUrl();
  const urlsToTry = [primaryUrl, publicUrl].filter((u, idx, self) => Boolean(u) && self.indexOf(u) === idx);

  if (urlsToTry.length === 0) {
    throw new AiServiceError(503, 'AI_SERVICE_URL is not configured on the server.');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['x-ai-service-token'] = AI_SERVICE_TOKEN;

  let lastError: Error | null = null;

  for (let idx = 0; idx < urlsToTry.length; idx++) {
    const baseUrl = urlsToTry[idx];
    try {
      const { retries, maxDelayMs } = retryBudgetFor(idx, urlsToTry.length);
      const res = await fetchWithRetry(
        `${baseUrl}/ai/github/scan/stream`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        retries,
        1000,
        maxDelayMs,
      );
      if (!res.ok || !res.body) {
        throw new AiServiceError(res.status || 502, `AI scan stream failed (${res.status}).`);
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AIClient] Scan stream via ${baseUrl} failed: ${lastError.message}. Trying next endpoint...`);
    }
  }

  throw new AiServiceError(
    502,
    `AI service is unreachable at ${urlsToTry.join(' / ')}: ${lastError?.message || 'fetch failed'}`,
  );
}
