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
} from '../types/ai.js';
import type { GithubScanResult } from '../types/github.js';

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || '').replace(/\/+$/, '');
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';

/** True when the AI service base URL is configured. */
export function isAiServiceConfigured(): boolean {
  return Boolean(AI_SERVICE_URL);
}

/** Error carrying the upstream HTTP status so routes can propagate it. */
export class AiServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!AI_SERVICE_URL) {
    throw new AiServiceError(503, 'AI_SERVICE_URL is not configured on the server.');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['x-ai-service-token'] = AI_SERVICE_TOKEN;

  let res: Response;
  try {
    res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiServiceError(
      502,
      `AI service is unreachable at ${AI_SERVICE_URL}: ${err instanceof Error ? err.message : String(err)}`,
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
export async function parseBrief(briefText: string): Promise<Proposal> {
  const data = await postJson<{ proposal: Proposal }>('/ai/brief/parse', { briefText });
  return data.proposal;
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

export interface GithubScanRequestBody {
  githubUsername: string;
  accessToken?: string;
  topN?: number;
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
  if (!AI_SERVICE_URL) {
    throw new AiServiceError(503, 'AI_SERVICE_URL is not configured on the server.');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['x-ai-service-token'] = AI_SERVICE_TOKEN;

  let res: Response;
  try {
    res = await fetch(`${AI_SERVICE_URL}/ai/github/scan/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiServiceError(
      502,
      `AI service is unreachable at ${AI_SERVICE_URL}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok || !res.body) {
    throw new AiServiceError(res.status || 502, `AI scan stream failed (${res.status}).`);
  }
  return res;
}
