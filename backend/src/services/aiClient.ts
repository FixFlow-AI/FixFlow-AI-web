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

const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';

/** True when the AI service base URL is configured. */
export function isAiServiceConfigured(): boolean {
  return Boolean(getAiServiceUrl());
}

/** Error carrying the upstream HTTP status so routes can propagate it. */
export class AiServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 6, delayMs = 1200): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // If 502/503/504 (e.g. Render container cold start / spin-down waking up), retry
      if ([502, 503, 504].includes(res.status) && i < retries - 1) {
        console.warn(`[AIClient] Upstream returned ${res.status}. Cold start warming up (${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, Math.min(4000, delayMs * (1 + i * 0.5))));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        console.warn(`[AIClient] Fetch error: ${err instanceof Error ? err.message : String(err)}. Retrying (${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, Math.min(4000, delayMs * (1 + i * 0.5))));
      }
    }
  }
  if (lastErr) throw lastErr;
  throw new Error(`Fetch to ${url} failed after ${retries} retries.`);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const aiUrl = getAiServiceUrl();
  if (!aiUrl) {
    throw new AiServiceError(503, 'AI_SERVICE_URL is not configured on the server.');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['x-ai-service-token'] = AI_SERVICE_TOKEN;

  let res: Response;
  try {
    res = await fetchWithRetry(`${aiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiServiceError(
      502,
      `AI service is unreachable at ${aiUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

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
}

/** AI-001 — parse an unstructured brief into a structured proposal. */
export async function parseBrief(
  briefText: string,
): Promise<ParseBriefResponse> {
  return postJson<ParseBriefResponse>('/ai/brief/parse', { briefText });
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

/**
 * Requirement Discovery Agent (Talent section) — one adaptive turn. Given the
 * initial request and the answers gathered so far, returns the next
 * multiple-choice question or the finished structured brief.
 */
export async function runDiscoveryTurn(
  initialRequest: string,
  answers: DiscoveryAnswer[],
): Promise<DiscoveryTurn> {
  return postJson<DiscoveryTurn>('/ai/discovery/next', { initialRequest, answers });
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
  const aiUrl = getAiServiceUrl();
  if (!aiUrl) {
    throw new AiServiceError(503, 'AI_SERVICE_URL is not configured on the server.');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['x-ai-service-token'] = AI_SERVICE_TOKEN;

  let res: Response;
  try {
    res = await fetchWithRetry(`${aiUrl}/ai/github/scan/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiServiceError(
      502,
      `AI service is unreachable at ${aiUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok || !res.body) {
    throw new AiServiceError(res.status || 502, `AI scan stream failed (${res.status}).`);
  }
  return res;
}
