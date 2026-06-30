# AIA-01 — Convert Blocking AI-002 Evaluation to Async Job + Poll

> **Role**: AI Automation Engineer · **Priority**: 🔴 Critical · **Effort**: ~3 days

---

## Story Identity

| Field | Value |
|:---|:---|
| **Story ID** | `AIA-01` |
| **Owner** | AI Automation Engineer |
| **Backend files** | [index.ts](../../../backend/src/index.ts), [confidenceGrid.ts](../../../backend/src/skills/confidenceGrid.ts), new jobs layer |
| **Depends on** | [AIA-05 Resilience](./AIA-05-gemini-call-resilience.md) |

---

## 1. Current Problem

`POST /api/proposals/evaluate` runs `processConfidenceGrid()` **synchronously inside the request**. That call makes two parallel Gemini requests (Auditor + Feasibility) and, when the score is low, an additional `optimizeProposal()` call — then potentially loops. On `gemini-2.5-pro` this can take tens of seconds.

```ts
const result = await processConfidenceGrid(briefText, proposal, GEMINI_API_KEY, GEMINI_MODEL);
res.json(result);
```

The [serverless migration plan](../../architecture/serverless_migration_plan.md) and go-live Phase 5 both flag this: on API Gateway/Lambda the request will hit the 29–30s timeout and the client gets a 5xx even though work may still be running. There's also no way to retry or de-duplicate an evaluation.

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as Express (Lambda)
    participant G as Gemini
    FE->>API: POST /evaluate
    API->>G: Auditor ‖ Feasibility (+ optimize)
    Note over API,G: 20–40s...
    API--xFE: ⏱️ timeout / 5xx ❌
```

---

## 2. Why It Matters

- Blocking evaluation is incompatible with the planned serverless deployment.
- No job model means no retries, no idempotency, and no progress visibility for a multi-cycle correction.

---

## 3. Step-Wise Solution

### Step 3.1 — Add a jobs store
Create a `jobs` table/repository: `{ jobId, type, status: 'queued'|'running'|'done'|'failed', inputHash, result?, error?, createdAt, updatedAt }`. `inputHash` (brief + proposal + model) enables idempotency.

### Step 3.2 — Enqueue instead of execute
`POST /api/proposals/evaluate` becomes:
1. Validate input (as today).
2. Compute `inputHash`; if a recent `done` job exists, return it (idempotent short-circuit).
3. Create a `queued` job, enqueue it, return `202 { jobId }`.

### Step 3.3 — Worker executes the grid
A worker (BullMQ locally / SQS+Lambda in prod, per serverless plan §3.7) pulls the job, sets `running`, calls `processConfidenceGrid()` (now using the resilient wrapper), then writes `done` + `result` or `failed` + `error`.

### Step 3.4 — Poll endpoint
`GET /api/jobs/:jobId` returns status and, when `done`, the `ConfidenceGridResult`. The frontend polls (or subscribes) instead of holding a long request.

### Step 3.5 — Idempotency + retry policy
Use `inputHash` as the queue job key to coalesce duplicate submissions. Configure bounded retries for transient failures (delegated to AIA-05's classification); permanent failures fail fast.

### Step 3.6 — Persist evaluation on completion
On `done`, if a `proposalId` was supplied, call `getProposalRepository().setEvaluation(proposalId, result)` from the worker (same effect the route has today, moved to the worker).

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as API
    participant Q as Queue
    participant W as Worker
    participant G as Gemini
    FE->>API: POST /evaluate
    API->>Q: enqueue(job, key=inputHash)
    API-->>FE: 202 { jobId }
    W->>Q: pull job (running)
    W->>G: Auditor ‖ Feasibility (+optimize)
    G-->>W: scores
    W->>W: persist evaluation + status=done
    loop poll
        FE->>API: GET /jobs/{jobId}
        API-->>FE: status / result
    end
```

---

## 4. Done When

- [ ] `POST /api/proposals/evaluate` returns `202 { jobId }` and never blocks on Gemini.
- [ ] A worker executes the grid and writes `done`/`failed` with result/error.
- [ ] `GET /api/jobs/:jobId` returns status and final result.
- [ ] Duplicate submissions coalesce via `inputHash`.
- [ ] Evaluation persistence happens in the worker; `npm run build` passes.

---

## 5. Cross-References

| Document | Relevance |
|:---|:---|
| [Serverless Migration Plan §3.7](../../architecture/serverless_migration_plan.md) | Async AI job pattern |
| [Go-Live Roadmap Phase 5](../../go_live_roadmap.md) | Long-running AI-002 task |
| [AIE-03 Self-Correction](./AIE-03-confidence-grid-self-correction.md) | The logic this job runs |
| [AIA-05 Resilience](./AIA-05-gemini-call-resilience.md) | Retry classification |
