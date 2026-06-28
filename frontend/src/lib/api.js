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
  let response;
  try {
    response = await doFetch(path, { method, body, signal, token: getAccessToken() });

    // Access token expired → try one silent refresh, then retry once.
    if (response.status === 401 && getAccessToken()) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await doFetch(path, { method, body, signal, token: newToken });
      } else {
        clearSession();
      }
    }
  } catch (networkError) {
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

  // Auth
  googleLogin: (idToken) =>
    request("/auth/google", { method: "POST", body: { idToken } }),
  me: () => request("/auth/me"),
  setRole: (role) => request("/auth/me/role", { method: "PATCH", body: { role } }),
  logout: (refreshToken, userId) =>
    request("/auth/logout", { method: "POST", body: { refreshToken, userId } }),
  overview: () => request("/overview"),
  listProposals: () => request("/proposals"),
  getProposal: (id) => request(`/proposals/${encodeURIComponent(id)}`),

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
};
