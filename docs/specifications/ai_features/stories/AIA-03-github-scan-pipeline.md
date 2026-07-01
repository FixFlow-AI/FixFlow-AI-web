# AIA-03 — Automate the GitHub Scan Pipeline Feeding AI-003

> **Role**: AI Automation Engineer · **Priority**: 🟡 High · **Effort**: ~3 days

---

## Story Identity

| Field | Value |
|:---|:---|
| **Story ID** | `AIA-03` |
| **Owner** | AI Automation Engineer |
| **Files** | new `ai-service/app/automation/github_scan.py`, `ai-service/app/features/interview.py`, `ai-service/app/main.py`; persistence via TS `backend/src` |
| **Feeds** | AI-003 interview generation, AIE-05 matching signal |

---

## 1. Current Problem

`generate_interview_questions(brief_text, github_scan, missing_skills)` (in `ai-service/app/features/interview.py`) expects two inputs that **nothing in the system produces**:

- `github_scan` — a summary of the candidate's GitHub (languages, topics, strengths).
- `missing_skills` — required skills not found in that scan.

The TS gateway route just forwards whatever the client sends (`githubScan = ''`, `missingSkills = []` by default) to the Python endpoint. So in practice AI-003 falls back to its generic question set, and the matching engine's `githubSignal` factor has no real backing data either.

```mermaid
flowchart LR
    REQ["/api/interview-questions (TS)"] --> PY["/ai/interview/generate (Python)"]
    PY -.->|github_scan = '' ❌| FB[generic fallback questions]
    PY -.->|missing_skills = [] ❌| FB
```

---

## 2. Why It Matters

- AI-003's entire value is *targeted* vetting based on real skill gaps; without the scan it degrades to boilerplate.
- The same scan output is a high-value signal for AIE-05 matching (`githubSignal`, `skillGaps`).
- This is automation work (rate limits, async fetch, caching) — squarely the automation engineer's lane.

---

## 3. Step-Wise Solution

### Step 3.1 — Build the scanner module
`ai-service/app/automation/github_scan.py` with `scan_github_profile(username|url)` that uses the GitHub REST API (via `httpx`) to gather: top repos, primary languages (bytes per language), repo topics, stars, and recent activity. Require a `GITHUB_TOKEN` env for higher rate limits; degrade gracefully without one.

### Step 3.2 — Summarize into a stable shape
Produce a compact, deterministic `GithubScan` Pydantic model (languages[], topics[], notableRepos[], activityLevel). Keep it small so it fits cleanly into the AI-003 prompt.

### Step 3.3 — Compute `missing_skills` deterministically
Given the proposal's required skills (from AI-001) and the scan's languages/topics, compute the set difference. Use a shared normalization/synonym map — note the canonical one currently lives in TS `matchingEngine.ts`; mirror it into a small Python helper (`app/automation/skill_norm.py`) and keep the two in sync (or expose it from the TS side). No LLM needed.

### Step 3.4 — Run it as a background job
GitHub scanning is I/O-bound and rate-limited — run it as a job (reuse the AIA-01 TS jobs layer, which calls a Python `POST /ai/github/scan` endpoint, or an internal Python task queue): the TS gateway exposes `POST /api/freelancer/:id/github-scan` which enqueues; the result is persisted on the freelancer record (TS system of record) and reused.

### Step 3.5 — Cache + refresh policy
Cache scans per username with a TTL (e.g., 7 days) and a manual refresh trigger. Respect GitHub rate limits with backoff (reuse AIA-05 patterns).

### Step 3.6 — Wire into AI-003 and matching
The interview route loads the persisted scan + computed `missing_skills` instead of trusting client input. AIE-05 (TS) reads the same persisted scan for its `githubSignal`.

```mermaid
flowchart TD
    TRIG["POST /api/freelancer/:id/github-scan (TS)"] --> Q[enqueue scan job]
    Q --> W["worker → Python scan_github_profile + backoff"]
    W --> SUM[summarize → GithubScan]
    SUM --> STORE[persist on freelancer (TS) + cache TTL]
    STORE --> DIFF[missing_skills = required − scan skills]
    DIFF --> IG[AI-003 interview gen]
    STORE --> MATCH[AIE-05 githubSignal]
```

---

## 4. Done When

- [ ] `github_scan.py` returns a stable `GithubScan` summary from a username/URL.
- [ ] `missing_skills` is computed deterministically using a shared skill-normalization helper.
- [ ] Scanning runs as a background job and persists/caches results with a TTL.
- [ ] AI-003 and the matching engine consume the persisted scan (not raw client input).
- [ ] Rate-limit backoff is in place; `python -m compileall app` and `npm run build` pass.

---

## 5. Cross-References

| Document | Relevance |
|:---|:---|
| [AI-003 Spec](../ai_003_interview_vetting_generation.md) | Consumer of scan + missingSkills |
| [AIE-05 Reputation in Matching](./AIE-05-reputation-into-matching.md) | Shares the scan signal |
| [AIA-01 Async Jobs](./AIA-01-async-evaluation-jobs.md) | Job infrastructure to reuse |
| [matchingEngine.ts](../../../backend/src/services/matchingEngine.ts) | Source of the synonym/normalization helper |
