# AIA-04 — AI-005 Discovery Automation (Connectors + Cron)

> **Role**: AI Automation Engineer · **Priority**: 🟡 High · **Effort**: ~4–5 days
> **✅ Verified status (2026-07-05): 🔴 Not started.** Confirmed in code: no `app/automation/opportunity/`; no connectors/scheduler. Design contract comes from AIE-06. **Also see the dedicated microservice design** in [`../../core_subsystems/opportunity_ingestion_microservice.md`](../../core_subsystems/opportunity_ingestion_microservice.md). **Priority: 🟡 P3.** See [status board](../IMPLEMENTATION_STATUS.md).

---

## Story Identity

| Field | Value |
|:---|:---|
| **Story ID** | `AIA-04` |
| **Owner** | AI Automation Engineer |
| **Files** | new `ai-service/app/automation/opportunity/` (connectors, scheduler); board API via TS gateway |
| **Depends on** | [AIE-06 Scoring Design](./AIE-06-opportunity-intelligence-scoring.md) |

---

## 1. Current Problem

AI-005 has no ingestion pipeline. There is no scheduled discovery, no source connectors, no normalize/dedupe stage, and nothing to feed the opportunity board. The [build guide](../opportunity_intelligence_build_guide.md) lays out a 7-stage flow and a source-policy gate, but none of it is implemented.

```mermaid
flowchart LR
    SRC[external sources] -.-> X[no connectors ❌]
    X -.-> NORM[no normalize/dedupe ❌]
    NORM -.-> EX[no extraction call ❌]
    EX -.-> BOARD[empty opportunity board]
```

This story builds the **plumbing**; the extraction schema + scoring rubric are designed in [AIE-06](./AIE-06-opportunity-intelligence-scoring.md).

---

## 2. Why It Matters

- Turns AI-005 from a doc into a working inbound-demand engine feeding AI-006.
- Source-policy compliance and dedupe must be engineered carefully — automation/ops territory.

---

## 3. Step-Wise Solution

### Step 3.1 — Source-policy gate first
Before any connector runs, enforce the build guide's policy gate: only ingest from sources whose terms permit it. Encode allowed sources in config; log/skip disallowed ones. (See go-live Phase 8 data-compliance note.)

### Step 3.2 — Build free connectors behind a protocol
Define a `SourceConnector` protocol (`fetch_recent() -> list[RawPost]`) in `app/automation/opportunity/`. Implement the free/permitted connectors from the build guide. New sources plug in without touching the pipeline.

### Step 3.3 — Normalize + dedupe
Map each `RawPost` to a common shape, then drop duplicates using the canonical dedupe key defined in AIE-06 (normalized title + source domain + posted week). Persist a `seen` set to avoid re-ingesting across runs.

### Step 3.4 — Call extraction + scoring
For each new, deduped post: call `extract_opportunity()` (AIE-06) → run the deterministic scoring rubric → persist the scored `Opportunity`. Route extraction through the AIA-02 cache and AIA-05 resilience in `app/llm/gemini.py`.

### Step 3.5 — Schedule it
Run on a schedule (local `apscheduler` / prod EventBridge → worker, per serverless plan). Make the interval configurable; process in batches to respect Gemini and source rate limits.

### Step 3.6 — Expose the board API
The TS gateway exposes `GET /api/opportunities` (ranked by score, filterable by skill/domain/freshness) for the frontend board and as an inbound feed to AI-006; it reads the opportunities the Python pipeline persisted (via a shared store or a Python read endpoint).

```mermaid
flowchart TD
    CRON[scheduler tick] --> GATE[source-policy gate]
    GATE --> CONN[connectors fetch_recent]
    CONN --> NORM[normalize]
    NORM --> DEDUP[dedupe vs seen-set]
    DEDUP --> EX[extract_opportunity cached]
    EX --> SC[deterministic scoring]
    SC --> DB[persist Opportunity]
    DB --> API["GET /api/opportunities → board / AI-006"]
```

---

## 4. Done When

- [ ] A source-policy gate blocks disallowed sources before fetch.
- [ ] At least the build-guide free connectors are implemented behind a `SourceConnector` protocol.
- [ ] Normalize + dedupe (with a persisted seen-set) prevents duplicates across runs.
- [ ] New posts are extracted (cached + resilient) and scored, then persisted.
- [ ] A configurable scheduler runs the pipeline in batches.
- [ ] `GET /api/opportunities` returns a ranked board; `python -m compileall app` passes.

---

## 5. Cross-References

| Document | Relevance |
|:---|:---|
| [Opportunity Intelligence Build Guide](../opportunity_intelligence_build_guide.md) | Source policy + 7-stage order |
| [AIE-06 Scoring Design](./AIE-06-opportunity-intelligence-scoring.md) | Extraction schema + scoring + dedupe key |
| [AIA-02 Cache](./AIA-02-gemini-result-cache.md) | Extraction caching |
| [AIA-05 Resilience](./AIA-05-gemini-call-resilience.md) | Retry/timeout for extraction calls |
