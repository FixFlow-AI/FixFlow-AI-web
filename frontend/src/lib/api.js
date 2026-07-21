/**
 * Thin client for the FixFlowAI backend API.
 *
 * In development, requests go to `/api/*` and Vite proxies them to the backend
 * (see vite.config.js). To point at a deployed backend instead, set
 * VITE_API_BASE_URL (e.g. "https://api.fixflow.ai").
 */

import {
  getAccessToken,
  refreshAccessToken,
  clearSession,
} from "./auth.js";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function doFetch(path, { method, body, signal, token }) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
}

async function request(path, { method = "GET", body, signal } = {}) {
  console.log(`[API] ${method} /api${path}`, body ? '| body keys: ' + Object.keys(body).join(', ') : '');
  let response;
  try {
    response = await doFetch(path, { method, body, signal, token: getAccessToken() });

    // Access token expired → try one silent refresh, then retry once.
    if (response.status === 401 && getAccessToken()) {
      console.log(`[API]   ⚠️ 401 on ${path} — attempting silent token refresh...`);
      const newToken = await refreshAccessToken();
      if (newToken) {
        console.log('[API]   ✅ Token refreshed. Retrying request...');
        response = await doFetch(path, { method, body, signal, token: newToken });
      } else {
        console.error('[API]   ❌ Token refresh failed. Clearing session (user will be logged out).');
        clearSession();
      }
    }
  } catch (networkError) {
    console.error(
      `[API] ❌ Network error on ${method} /api${path}.`,
      'Error:', networkError?.message || networkError,
      '| Is the backend running? Check http://localhost:4000/api/health',
    );
    throw new ApiError(
      "Could not reach the backend. Is the API server running?",
      0,
    );
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      console.error(`[API] ❌ Response from ${path} is not valid JSON. Raw text:`, text.slice(0, 200));
      const isHtml = text.trim().startsWith("<");
      payload = {
        error: isHtml
          ? `Backend service endpoint not reachable (${response.status}). Please ensure the backend server is running on port 4000.`
          : text.slice(0, 200),
      };
    }
  }

  if (!response.ok) {
    const message = payload?.error || `Request failed (${response.status}).`;
    console.error(
      `[API] ❌ ${method} /api${path} failed.`,
      'Status:', response.status,
      '| Error:', message,
      payload?.detail ? '| Detail: ' + payload.detail : '',
      payload?.code ? '| Code: ' + payload.code : '',
    );
    throw new ApiError(message, response.status);
  }

  console.log(`[API] ✅ ${method} /api${path} — ${response.status}`);
  return payload;
}

export { ApiError };

export const api = {
  health: () => request("/health"),

  // Auth
  googleLogin: (idToken, intendedRole) =>
    request("/auth/google", { method: "POST", body: { idToken, intendedRole } }),
  githubLogin: (code, intendedRole, redirectUri) =>
    request("/auth/github", {
      method: "POST",
      body: { code, intendedRole, redirectUri },
    }),
  devLogin: (email, name) =>
    request("/auth/dev-login", { method: "POST", body: { email, name } }),
  me: () => request("/auth/me"),
  setRole: (role) => request("/auth/me/role", { method: "PATCH", body: { role } }),

  // Freelancer GitHub onboarding (roles/01)
  freelancerProfile: () => request("/freelancer/profile"),
  // A client viewing a matched candidate's analytics dashboard (read-only).
  candidateProfile: (id, signal) =>
    request(`/freelancers/${encodeURIComponent(id)}/profile`, { signal }),
  // On-demand re-analysis — the ONLY caller that re-invokes the GitHub API for
  // a returning freelancer. Returns { scanJobId } to stream live segments.
  rescanGithub: () => request("/freelancer/scan/rescan", { method: "POST" }),
  scanStatus: (jobId) => request(`/freelancer/scan/${encodeURIComponent(jobId)}`),
  // EventSource can't set headers, so the access token rides as a query param.
  scanStreamUrl: (jobId) =>
    `${BASE_URL}/api/freelancer/scan/${encodeURIComponent(jobId)}/stream?token=${encodeURIComponent(
      getAccessToken() || "",
    )}`,
  logout: (refreshToken, userId) =>
    request("/auth/logout", { method: "POST", body: { refreshToken, userId } }),
  overview: () => request("/overview"),
  listProposals: () => request("/proposals"),
  getProposal: (id) => request(`/proposals/${encodeURIComponent(id)}`),

  // Persist the sequential step/approval state for a proposal so the builder
  // restores where the user left off. Best-effort; server sanitizes the input.
  saveProposalWorkflow: (id, activeStep, approvedSteps, updatedAt, signal) =>
    request(`/proposals/${encodeURIComponent(id)}/workflow`, {
      method: "PUT",
      body: { activeStep, approvedSteps, updatedAt },
      signal,
    }),

  // Requirement Discovery Agent (Talent section): one adaptive Q&A turn.
  // Returns { status, confidence, next_question, brief, missing_information }.
  discoveryNext: (initialRequest, answers, signal) =>
    request("/discovery/next", {
      method: "POST",
      body: { initialRequest, answers },
      signal,
    }),

  // Subsystem 1: semantic brief parsing -> structured proposal
  parseBrief: (briefText, signal) =>
    request("/proposals/parse", { method: "POST", body: { briefText }, signal }),

  // Subsystem 2: multi-agent confidence grid evaluation + self-correction
  evaluateProposal: (briefText, proposal, proposalId, signal) =>
    request("/proposals/evaluate", {
      method: "POST",
      body: { briefText, proposal, proposalId },
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

  // Escrow state machine (milestones + cryptographic audit trail)
  createMilestone: (proposalId, title, amount, signal) =>
    request("/escrow/milestones", {
      method: "POST",
      body: { proposalId, title, amount },
      signal,
    }),

  listMilestones: (proposalId, signal) =>
    request(
      `/escrow/milestones${proposalId ? `?proposalId=${encodeURIComponent(proposalId)}` : ""}`,
      { signal },
    ),

  getMilestone: (id, signal) => request(`/escrow/milestones/${id}`, { signal }),

  getMilestoneAudit: (id, signal) =>
    request(`/escrow/milestones/${id}/audit`, { signal }),

  transitionMilestone: (id, payload, signal) =>
    request(`/escrow/milestones/${id}/transition`, {
      method: "POST",
      body: payload,
      signal,
    }),

  getSyncRoom: (proposalId, signal) =>
    request(`/sync/rooms/${encodeURIComponent(proposalId)}`, { signal }),

  // AI-006: freelancer ↔ client matching shortlist
  matchFreelancers: (requiredSkills, budget, domains, limit, signal) =>
    request("/leads/match", {
      method: "POST",
      body: { requiredSkills, budget, domains, limit },
      signal,
    }),

  // Razorpay payment integration
  fundMilestone: (id, signal) =>
    request(`/escrow/milestones/${id}/fund`, { method: "POST", signal }),

  verifyMilestonePayment: (id, payload, signal) =>
    request(`/escrow/milestones/${id}/verify-payment`, {
      method: "POST",
      body: payload,
      signal,
    }),
};
