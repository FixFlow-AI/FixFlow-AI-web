# AIE-06 — Design AI-005 Opportunity Intelligence Scoring

> **Role**: AI Engineer · **Priority**: 🟡 High · **Effort**: ~3–4 days (model/scoring design)

---

## Story Identity

| Field | Value |
|:---|:---|
| **Story ID** | `AIE-06` |
| **Owner** | AI Engineer |
| **Files** | new `ai-service/app/features/opportunity.py`, `ai-service/app/schemas/opportunity.py` |
| **Pairs with** | [AIA-04 Discovery Automation](./AIA-04-opportunity-discovery-automation.md) |

---

## 1. Current Problem

AI-005 is the only subsystem with **no implementation** — the registry marks it `❌ Not built`, and only the [build guide](../opportunity_intelligence_build_guide.md) exists. There is no extraction schema and no lead-scoring rubric, so:

- Raw external posts can't be turned into structured opportunities.
- There is nothing to rank discovered leads by relevance/quality.
- AI-006 matching has no inbound external lead source to score against (the dependency graph shows `AI-005 → AI-006` and `AI-005 → AI-001`).

This story covers the **intelligence design** (schema + extraction prompt + scoring). The ingestion/scheduling plumbing is [AIA-04](./AIA-04-opportunity-discovery-automation.md).

```mermaid
flowchart LR
    POSTS[raw external posts] -. no extractor .-x OPP[structured opportunity]
    OPP -. no scorer .-x RANK[ranked board]
    RANK --> AI006[AI-006 matching]
```

---

## 2. Why It Matters

- Opportunity discovery is a key growth lever (inbound demand) and a documented 🟡 High feature.
- Doing the schema + scoring design first (this story) lets the automation engineer build connectors against a stable contract.

---

## 3. Step-Wise Solution

### Step 3.1 — Define the extraction schema (Pydantic)
Model an `Opportunity` in `ai-service/app/schemas/opportunity.py`, mirroring the pattern in `app/schemas/proposal.py`:
```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

class Opportunity(BaseModel):
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    requiredSkills: list[str]
    domain: str
    budgetSignal: Literal["none", "low", "medium", "high"]
    budgetEstimate: Optional[float] = None
    urgency: Literal["low", "medium", "high"]
    sourceUrl: str
    postedAt: Optional[str] = None
    legitimacySignals: list[str]
    spamSignals: list[str]
```

### Step 3.2 — Write the extraction feature
`extract_opportunity(raw_post)` in `app/features/opportunity.py` using the same hardened pattern as the other features: `generate_structured(..., response_schema=Opportunity)` + an honest fallback marker (reuse the AIE-02 `source` convention — never emit a fabricated opportunity as real).

### Step 3.3 — Define the scoring rubric (deterministic)
Keep scoring **deterministic** (like `matchingEngine.ts`), not an LLM call, so it's cheap, explainable, and tunable via env weights:
| Factor | Signal |
|:---|:---|
| Skill relevance | overlap with the platform's freelancer skill inventory |
| Budget quality | `budgetSignal` / estimate vs platform floor |
| Urgency | maps to time-to-fill value |
| Legitimacy | legitimacy minus spam signals |
| Freshness | decay by `postedAt` age |

Output `opportunityScore` (0–100) + `factorBreakdown` + `scoreReasons` — the same shape as the matching engine for UI consistency. This scorer can live in Python (`app/features/opportunity.py`) since it feeds the Python discovery pipeline.

### Step 3.4 — Define dedupe key
Specify a canonical dedupe key (e.g., normalized title + source domain + posted week) so AIA-04 can drop duplicates deterministically.

### Step 3.5 — Provide a labeled mini-set
Add 10–15 example posts with expected extraction + score bands to the AIE-04 eval harness (`ai-service/eval/datasets/`) so AI-005 quality is gated like the others.

```mermaid
flowchart TD
    RAW[raw post] --> EX["extract_opportunity (Gemini + Pydantic)"]
    EX --> OPP[Opportunity object + source flag]
    OPP --> DK[compute dedupe key]
    OPP --> SC[deterministic scoring rubric]
    SC --> RES[opportunityScore + factorBreakdown + reasons]
    RES --> BOARD[opportunity board → AI-006]
```

---

## 4. Done When

- [ ] `Opportunity` Pydantic model is defined and documented.
- [ ] `extract_opportunity()` follows the project's hardened LLM pattern with an honest fallback marker.
- [ ] A deterministic, env-weighted scoring function returns score + breakdown + reasons.
- [ ] A canonical dedupe key is specified for AIA-04.
- [ ] A labeled mini-set is added to the eval harness.
- [ ] `python -m compileall app` passes.

---

## 5. Cross-References

| Document | Relevance |
|:---|:---|
| [AI-005 Spec](../ai_005_opportunity_intelligence_scoring.md) | Feature intent |
| [Opportunity Intelligence Build Guide](../opportunity_intelligence_build_guide.md) | Source policy + 7-stage build order |
| [AIA-04 Discovery Automation](./AIA-04-opportunity-discovery-automation.md) | Builds connectors/cron against this schema |
| [matchingEngine.ts](../../../backend/src/services/matchingEngine.ts) | Scoring shape to mirror |
