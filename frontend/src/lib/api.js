/**
 * Thin client for the FixFlowAI backend API.
 *
 * In development, requests go to `/api/*` and Vite proxies them to the backend
 * (see vite.config.js). To point at a deployed backend instead, set
 * VITE_API_BASE_URL (e.g. "https://api.fixflow.ai").
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkError) {
    // Backend unreachable (not running, wrong port, etc.)
    throw new ApiError(
      "Could not reach the backend. Is the API server running on port 4000?",
      0,
    );
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error || `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return payload;
}

export { ApiError };

export const api = {
  health: () => request("/health"),

  // Subsystem 1: semantic brief parsing -> structured proposal
  parseBrief: (briefText, signal) =>
    request("/proposals/parse", { method: "POST", body: { briefText }, signal }),

  // Subsystem 2: multi-agent confidence grid evaluation + self-correction
  evaluateProposal: (briefText, proposal, signal) =>
    request("/proposals/evaluate", {
      method: "POST",
      body: { briefText, proposal },
      signal,
    }),

  interviewQuestions: (briefText, githubScan, missingSkills, signal) =>
    request("/interview-questions", {
      method: "POST",
      body: { briefText, githubScan, missingSkills },
      signal,
    }),

  contractExtensions: (completedDeliverables, chatSummary, signal) =>
    request("/contract-extensions", {
      method: "POST",
      body: { completedDeliverables, chatSummary },
      signal,
    }),

  // Deterministic calculators (work without a Gemini key)
  earnings: (grossAmount, platformPlan, taxCountryCode, signal) =>
    request("/earnings", {
      method: "POST",
      body: { grossAmount, platformPlan, taxCountryCode },
      signal,
    }),

  reputation: (escrowHistory, freelancerDid, signal) =>
    request("/reputation", {
      method: "POST",
      body: { escrowHistory, freelancerDid },
      signal,
    }),

  clientScore: (clientHistory, signal) =>
    request("/client-score", {
      method: "POST",
      body: { clientHistory },
      signal,
    }),
};
