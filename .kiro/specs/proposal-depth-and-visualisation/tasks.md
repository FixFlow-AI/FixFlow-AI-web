# Implementation Plan — Proposal Depth & Visualisation

## Overview

The work follows the design's spine — **depth is authored on the server, numbers stay derived, the browser only projects** — and is sequenced so each layer is verifiable before the next one depends on it:

1. **Python schemas** (`schemas/depth.py`, `schemas/plan_draft.py`, additive optional fields on `proposal.py` / `execution_plan.py`) — nothing else can be typed until these exist.
2. **Depth policy + brief parser** — targets, the deepened prompt, `ScoreBasis`, one bounded re-ask.
3. **Critical path** in `timeline_validation.py` — the plan pipeline and the Gantt both read it.
4. **Authoring pipeline** (`plan_authoring` → `plan_assembly` → `plan_repair` → async `plan_generator`).
5. **Route + config** (`main.py`, `config.py`).
6. **Node contract mirrors** (`backend/src/types/ai.ts`).
7. **Frontend pure layer** (`lib/plan/*.js`, `usePrefersReducedMotion`) — pure functions first, so the property tests land before any JSX.
8. **Diagram components** — shared primitives, then the six diagrams.
9. **Surface integration** — `ProposalGenerator.jsx`, `ExecutionPlanPanel.jsx`.

Test infrastructure is task 1 rather than last, because every property test that follows depends on it and each property test is placed directly beside the code it validates (catch errors at the point of introduction). Cross-cutting checks (bundle isolation, end-to-end depth run, authoring budget) stay near the end where their inputs all exist.

## Tasks

- [x] 1. Test infrastructure for property-based testing
  - [x] 1.1 Add Hypothesis to the Python dev dependencies
    - Add `hypothesis>=6.100` to `ai-service/requirements-dev.txt` with a comment matching the file's existing explanatory style
    - Confirm `pytest` discovers a trivial `@given` test in the repo-root-style flat layout the existing suites use (`ai-service/test_*.py`)
    - _Requirements: 9.1_

  - [x] 1.2 Add a frontend test runner and generator library
    - Add `vitest`, `fast-check`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` as **devDependencies only** in `frontend/package.json` (pinned with `^`, no production dependency added)
    - Add `"test": "vitest --run"` to `frontend/package.json` scripts
    - Create `frontend/vitest.config.js` with the `jsdom` environment, the existing `@vitejs/plugin-react` plugin, and `include` covering `src/**/__tests__/**/*.{test,prop.test}.{js,jsx}`
    - Create `frontend/src/test/setup.js` registering `@testing-library/jest-dom` and a default `matchMedia` stub
    - _Requirements: 12.3, 12.4_

- [ ] 2. Python schema foundations
  - [x] 2.1 Create the depth and score-basis schemas
    - Create `ai-service/app/schemas/depth.py` with `BriefSubstance`, `DepthTargets`, `SectionDepth`, `DepthReport`, and `ScoreBasis` exactly as specified in the design's Data Models section
    - `DepthReport.depthLimited` defaults `False`; `limitReason` is `Optional[Literal["brief_too_short", "model_shortfall", "degraded"]]`; `note` carries the user-facing sentence; `reaskUsed` defaults `False`
    - `ScoreBasis` carries `inputs: List[str]` and `rule: str`
    - _Requirements: 1.3, 2.4, 9.4, 9.6_

  - [x] 2.2 Create the plan authoring draft schema
    - Create `ai-service/app/schemas/plan_draft.py` with `DraftRequirement`, `DraftScopeModule`, `DraftComponent`, `DraftEdge`, `DraftTask`, `DraftClientAction`, `DraftWeek`, `DraftCheckpoint`, `DraftRiskLink`, and `PlanAuthoringDraft`
    - Reuse `Workstream`, `Assumption`, `OpenQuestion`, `QualComplexity`, `Priority`, `CheckpointType` from `ai-service/app/schemas/execution_plan.py`
    - **No numeric field may exist anywhere in this module** except ordinal `weekNumber` / `startWeek` / `endWeek` (`ge=1`) — no hours, no severity, no percentages, so the model structurally cannot supply a figure
    - `DraftComponent.openDecisions` and `DraftClientAction.required` are present as the design specifies
    - _Requirements: 3.5, 4.4, 9.2_

  - [x] 2.3 Add additive optional fields and the generation-only draft to the proposal schema
    - In `ai-service/app/schemas/proposal.py`: add `Feature.source: Literal["brief","discovery","inferred"] = "brief"`, and `score_basis: Optional[ScoreBasis] = None` to `Feature`, `Risk`, `MarketItem`, `ImpactItem`
    - Add `Proposal.depth_report: Optional[DepthReport] = None` and `ParseBriefResponse.depthReport: Optional[DepthReport] = None`
    - Leave every existing `min_length` on `Proposal` **unchanged** — it is the inbound contract for `/ai/plan/generate` and `/ai/confidence/evaluate`
    - Add `class ProposalDraft(Proposal)` with the raised minimums (features 6–12, risks ≥5, timeline ≥3, effort ≥3, market ≥3, impact ≥3) and a docstring stating it is a Gemini `response_schema` only, never used to validate stored proposals
    - _Requirements: 1.1, 1.4, 2.2, 2.4, 11.3_

  - [x] 2.4 Add additive optional fields to the execution plan schema
    - In `ai-service/app/schemas/execution_plan.py`: add `PlanTask.estimateBasis: Optional[str] = None`, `PlanDiagnostics.criticalPathTaskIds: List[str] = Field(default_factory=list)`, and `ExecutionPlan.authoringSource: Optional[Literal["authored","repaired","derived","degraded"]] = None`
    - _Requirements: 5.5, 9.6, 11.3_

  - [ ]* 2.5 Write property test for schema backward compatibility
    - **Property 15 (backward-compatibility clause): Historical records keep parsing**
    - Create `ai-service/test_schema_compat_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 15: Historical records keep parsing and progressive disclosure loses nothing`
    - Hypothesis strategy emits JSON payloads valid under the pre-feature `Proposal` shape (single-item collections, unicode and whitespace-only strings, absent optionals); assert validation still succeeds, re-serialisation round-trips, and every field this feature adds is optional or defaulted
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 11.1, 11.3**

- [ ] 3. Depth policy and brief-parser depth
  - [x] 3.1 Implement the pure depth policy module
    - Create `ai-service/app/features/depth_policy.py` with `FULL_TARGETS`, `REDUCED_TARGETS`, `SUBSTANCE_WORD_THRESHOLD = 40`, `brief_substance()`, `targets_for()`, `assess_depth()`, `shortfall_instruction()`
    - LLM-free and pure; `assess_depth` must not mutate the proposal and must never construct a `Feature`/`Risk`/`MarketItem`/`ImpactItem`
    - `assess_depth` reports an `over_cap` note when features exceed `maxFeatures` without truncating anything
    - `shortfall_instruction` returns `None` when nothing is short
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 9.4_

  - [ ]* 3.2 Write property test for depth assessment
    - **Property 6: Depth is assessed, never padded**
    - Create `ai-service/test_depth_policy_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 6: Depth is assessed, never padded`
    - Assert `targets_for` returns full targets exactly when the substance threshold is cleared; `assess_depth` reports each section's actual count, sets `depthLimited` with a `limitReason` exactly when a target is unmet, and leaves every item count unchanged
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 1.1, 1.3, 2.2, 2.5, 9.4**

  - [x] 3.3 Add score-basis explanation functions to the brief parser
    - In `ai-service/app/features/brief_parser.py`: add `explain_confidence`, `explain_severity`, `explain_impact`, `explain_relevance`, each mirroring its existing `derive_*` sibling and returning a `ScoreBasis` whose `inputs` name the qualitative signals consumed and whose `rule` reads back to the derived number
    - Populate `score_basis` inside `apply_deterministic_scores` alongside every figure it already overwrites
    - Do not change any existing derivation arithmetic
    - _Requirements: 2.3, 2.4, 9.6_

  - [ ]* 3.4 Write property test for deterministic score independence
    - **Property 4: Deterministic scores are independent of model-supplied numbers and idempotent**
    - Create `ai-service/test_scoring_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 4: Deterministic scores are independent of model-supplied numbers and idempotent`
    - Strategy replaces every `confidence_pct`, `risk.severity`, `impact_score`, `market.relevance` with arbitrary values; assert `apply_deterministic_scores` output is unchanged and applying it twice equals applying it once
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 2.3, 9.2**

  - [ ]* 3.5 Write property test for score basis explainability
    - **Property 5: Every score carries a basis that explains it**
    - Add to `ai-service/test_scoring_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 5: Every score carries a basis that explains it`
    - Over all combinations of qualitative inputs, assert the attached `ScoreBasis.inputs` names each signal the `derive_*` function consumed and that its stated `rule` evaluates to the derived number
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 2.4, 9.6**

  - [x] 3.6 Deepen the brief-parser prompt and wire the depth flow
    - In `ai-service/app/features/brief_parser.py`: extend `SYSTEM_PROMPT` with the explicit depth targets, the per-module acceptance-criteria requirement, inferred-vs-stated sourcing for `Feature.source`, and an explicit no-padding rule — preserving the existing "do NOT invent numeric scores" instruction verbatim
    - Rework `parse_brief` to: compute substance → targets, generate against `ProposalDraft` for full targets and plain `Proposal` for reduced targets, apply deterministic scores, `assess_depth`, perform **at most one** shortfall re-ask using `shortfall_instruction`, then attach the `DepthReport` (setting `reaskUsed`)
    - On the degraded/`sanitize_and_patch_brief` path set `limitReason="degraded"` and synthesise nothing extra
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.5, 9.4, 9.5_

  - [ ]* 3.7 Write unit tests for the bounded re-ask and degraded depth path
    - Add to `ai-service/test_brief_parser_scoring.py`: a shortfall response triggers exactly one re-ask (assert call count), a second shortfall is accepted with `limitReason="model_shortfall"` and a user-facing note, a sub-threshold brief generates against `Proposal` with `limitReason="brief_too_short"`, and the degraded path adds no risks or market items
    - _Requirements: 1.3, 2.5, 9.4_

- [x] 4. Checkpoint — Python schemas and depth policy
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Critical path in the deterministic validator
  - [x] 5.1 Implement compute_critical_path and expose it on diagnostics
    - In `ai-service/app/features/timeline_validation.py`: add `compute_critical_path(plan) -> list[str]` returning the longest dependency chain by summed `estimateHours`, `[]` when a cycle exists, with a deterministic tie-break on task id
    - Set `criticalPathTaskIds` on the `PlanDiagnostics` returned by `validate_execution_plan`; leave every existing check unchanged
    - _Requirements: 5.5, 6.5, 9.2_

  - [ ]* 5.2 Write property test for the critical path
    - **Property 12: The critical path is a real maximal chain**
    - Create `ai-service/test_plan_properties.py` with shared Hypothesis strategies `proposals()`, `plan_drafts()`, `execution_plans()` (covering empty and single-item collections, unicode/whitespace strings, zero and null capacity, boundary week spans, and adversarial drafts with dangling keys, cycles, duplicate keys, out-of-range spans)
    - Tag with `# Feature: proposal-depth-and-visualisation, Property 12: The critical path is a real maximal chain`
    - Assert the returned ids form a chain where each element is a dependency of its successor, its summed hours are ≥ every other chain, and a cycle yields `[]`
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 5.1, 5.2, 5.5**

  - [ ]* 5.3 Write property test for structural defect detection
    - **Property 2: Injected structural defects are always detected**
    - Add to `ai-service/test_plan_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 2: Injected structural defects are always detected`
    - Inject a dangling identifier reference or a dependency cycle into a clean plan; assert at least one `error`-severity issue and that a cycle yields empty `criticalPathTaskIds`
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 5.4, 9.1**

  - [ ]* 5.4 Write property test for diagnostics purity
    - **Property 3: Diagnostics recomputation is pure and ignores supplied diagnostics**
    - Add to `ai-service/test_plan_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 3: Diagnostics recomputation is pure and ignores supplied diagnostics`
    - Assert repeated invocation returns the same result ignoring `computedAt`, and that pre-attaching arbitrary `diagnostics` to the input plan does not change the output
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 6.5, 9.2**

- [ ] 6. Plan authoring pipeline
  - [x] 6.1 Implement the plan authoring LLM pass
    - Create `ai-service/app/features/plan_authoring.py` with `PLAN_SYSTEM_PROMPT` and `async def author_plan_draft(proposal, brief_text, *, timeout_sec) -> PlanAuthoringDraft | None`
    - One bounded Gemini call constrained to `PlanAuthoringDraft`; the prompt asks only for content and states that no numeric estimate, severity, or percentage may be supplied
    - Catch every exception (timeout, missing key, validation failure) and return `None` — must never raise into the request path
    - _Requirements: 3.1, 3.2, 4.1, 4.3, 4.4, 5.2, 5.3, 9.4_

  - [x] 6.2 Implement plan assembly from draft to execution plan
    - Create `ai-service/app/features/plan_assembly.py` with `assemble_plan(draft, proposal, *, baseline)` and `estimate_hours(complexity) -> tuple[float, str]`
    - Resolve draft-local keys to stable minted ids, **drop** any reference that cannot be resolved, clamp ordinal week spans into `1..N`
    - Compute every numeric field in code: `estimateHours`/`estimateBasis` from the unchanged `_COMPLEXITY_HOURS` table, `risks[].severity` inherited from the matched v1 `Risk`, `teamCapacity[].hoursPerWeek` from the baseline's existing peak-demand sizing
    - Never read a numeric field from the draft
    - _Requirements: 3.1, 3.2, 3.5, 4.1, 5.1, 5.3, 9.1, 9.2, 9.6_

  - [ ]* 6.3 Write property test for task estimate derivation
    - **Property 7: Every task estimate is derived from its complexity and states its basis**
    - Add to `ai-service/test_plan_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 7: Every task estimate is derived from its complexity and states its basis`
    - For any draft, assert each emitted `PlanTask.estimateHours` equals the complexity table entry and `estimateBasis` is non-empty and names that complexity
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 5.3, 9.6**

  - [x] 6.4 Implement the subtractive plan repair pass
    - Create `ai-service/app/features/plan_repair.py` with `repair_plan(plan, diagnostics) -> ExecutionPlan` — pure, returns a new plan, exactly one pass
    - Handle the diagnostic codes `dangling_ref`, `week_discontinuity`, `span_out_of_range`, `dependency_cycle` (drop the reported back-edge), `module_no_task` (add a covering task), `high_risk_unmitigated` (attach to `cp-risk-review`), `orphan_deliverable`
    - Repair removes bad references; it must not invent descriptive content
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 6.5 Make the plan generator an async orchestrator
    - In `ai-service/app/features/plan_generator.py`: change `generate_execution_plan` to `async`, build the deterministic baseline **first**, then author → assemble → validate → repair → re-validate
    - Return the candidate only when `errorCount == 0`, otherwise the baseline; set `authoringSource` to `"authored"` / `"repaired"` / `"derived"` (and `"degraded"` on the `degraded_execution_plan` path)
    - Leave `derive_execution_plan_from_proposal` synchronous and unchanged; keep `_merge_section` and `degraded_execution_plan` behaviour including the post-merge validate
    - Update the existing call sites in `ai-service/test_plan_generator.py` to await the coroutine so the regression suite passes unchanged otherwise
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

  - [ ]* 6.6 Write property test for the validator-clean guarantee
    - **Property 1: The emitted plan is always validator-clean**
    - Add to `ai-service/test_plan_properties.py`; tag with `# Feature: proposal-depth-and-visualisation, Property 1: The emitted plan is always validator-clean`
    - Drive `generate_execution_plan` with adversarial drafts (dangling keys, cycles, duplicate keys, out-of-range spans, empty sections); assert `errorCount == 0` always, and that the result is exactly the deterministic baseline whenever the candidate cannot be repaired clean
    - `@settings(max_examples=100)` minimum
    - **Validates: Requirements 1.2, 1.5, 2.1, 9.1, 9.3**

  - [ ]* 6.7 Write integration test for the authoring budget
    - Create `ai-service/test_plan_budget.py` with a stubbed slow `author_plan_draft`: assert exactly one authoring attempt, that it is wrapped in the configured timeout, and that a timeout still returns a validator-clean plan promptly with `authoringSource="derived"`
    - _Requirements: 9.5_

- [ ] 7. Route and configuration changes
  - [x] 7.1 Add the plan authoring timeout setting
    - Add `GEMINI_PLAN_TIMEOUT_SEC` (default `20`) to `ai-service/app/config.py` following the existing `gemini_timeout_sec` pattern, and mirror it in `ai-service/.env.example`
    - _Requirements: 9.5_

  - [x] 7.2 Strip inbound diagnostics and expose authoringSource on the routes
    - In `ai-service/app/main.py`: clear `body.executionPlan.diagnostics` and `body.existingPlan.diagnostics` before use on both `/ai/plan/generate` and `/ai/plan/validate`, so a caller cannot smuggle diagnostics in
    - Await the now-async `generate_execution_plan` and pass the configured plan timeout
    - Add `authoringSource: Literal["authored","repaired","derived","degraded"]` to `PlanGenerateResponse` and return the freshly computed diagnostics
    - _Requirements: 2.3, 6.5, 9.2, 9.5_

  - [ ]* 7.3 Write end-to-end depth test
    - Create `ai-service/test_depth_end_to_end.py`: run a recorded brief through `parse_brief` → `generate_execution_plan` → `validate_execution_plan` with stubbed model responses; assert the plan is validator-clean, the `depthReport` is attached, and `authoringSource` is set
    - _Requirements: 1.1, 2.1, 2.2, 9.1, 9.5_

- [x] 8. Checkpoint — server-side authoring pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Node contract mirrors
  - [x] 9.1 Mirror the new Pydantic fields in the gateway types
    - In `backend/src/types/ai.ts` add, all optional (`?:`): `Feature.source`, `Feature.score_basis`, `Risk.score_basis`, `MarketItem.score_basis`, `ImpactItem.score_basis`, `Proposal.depth_report`, `PlanTask.estimateBasis`, `ExecutionPlan.authoringSource`, `PlanDiagnostics.criticalPathTaskIds`, plus a `ScoreBasis` and `DepthReport` interface
    - Do not add or change any Zod schema, `sanitizeWorkflow`, or `TransitionSchema` — the plan routes proxy the AI service's already-validated payload
    - Verify with `npm run typecheck` in `backend/`
    - _Requirements: 11.1, 11.3_

- [ ] 10. Backend sequential-approval sanitisation
  - [x] 10.1 Export sanitizeWorkflow and add a test entry point
    - Export the existing `sanitizeWorkflow` function from `backend/src/index.ts` (no behaviour change) so it is testable
    - Add `backend/src/test/testProposalWorkflow.ts` following the hand-rolled assertion style of `backend/src/test/testPlan.ts`, and wire it into the `test` script in `backend/package.json` alongside `testSkills.js`
    - _Requirements: 10.2, 10.4_

  - [ ]* 10.2 Write property test for sequential approval sanitisation
    - **Property 16: Sequential approval stays a contiguous prefix**
    - In `backend/src/test/testProposalWorkflow.ts`, tag with `// Feature: proposal-depth-and-visualisation, Property 16: Sequential approval stays a contiguous prefix`
    - Drive `sanitizeWorkflow` with a generated matrix of at least 100 hostile `activeStep` / `approvedSteps` payloads (negatives, floats, duplicates, gaps, out-of-range, non-arrays, nulls); assert the result is a contiguous prefix starting at 1, `activeStep ∈ [1, min(maxApproved + 1, totalSteps)]`, and that save-then-load of a valid workflow returns an equal workflow
    - **Validates: Requirements 10.2, 10.4**

- [ ] 11. Frontend pure projection layer
  - [x] 11.1 Implement the plan selectors
    - Create `frontend/src/lib/plan/selectors.js` (pure, no React import) exporting `indexPlan`, `buildWeekRollups`, `buildCapacityMatrix`, `tasksForCapacityCell`, `buildTraceabilityRows`, `dependencyIssuesByTask`, `hasBlockingPlanError`, and `sectionAvailability` (per-section `{ available, reason }` backing the empty states)
    - Read the gap flag from `empty_week` issues; keep server `CapacityCell` objects verbatim with `null` for absent `(roleId, weekNumber)`; drop dangling ids rather than rendering `undefined`; perform no arithmetic on any server figure
    - Add the JSDoc typedefs for `WeekRollup`, `CapacityMatrix`, `TraceabilityRow` from the design
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.3, 5.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5, 10.5, 11.4_

  - [ ]* 11.2 Write property test for the week rollup projection
    - **Property 8: The week rollup is a faithful projection of the plan**
    - Create `frontend/src/lib/plan/__tests__/selectors.prop.test.js` with fast-check arbitraries for plans and diagnostics; tag with `// Feature: proposal-depth-and-visualisation, Property 8: The week rollup is a faithful projection of the plan`
    - Assert one rollup per plan week in ascending order carrying number/label/objective verbatim, entities exactly the resolvable ones (unresolvables dropped), `blockingClientActions` exactly those with `required` true, and `isGap` true exactly when an `empty_week` issue exists for that week
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [ ]* 11.3 Write property test for zero-arithmetic projection
    - **Property 9: The projection layer performs no arithmetic on server figures**
    - Add to `frontend/src/lib/plan/__tests__/selectors.prop.test.js`; tag with `// Feature: proposal-depth-and-visualisation, Property 9: The projection layer performs no arithmetic on server figures`
    - Assert the capacity matrix holds exactly the supplied cells keyed by `(roleId, weekNumber)` with absent combinations null, a cell with no declared capacity surfaces as unknown with no percentage, `tasksForCapacityCell` returns exactly the owner-role tasks whose span contains the week, traceability rows are one per requirement from the matching `scopeCoverage` with blocking questions joined by requirement id, and the covered/total counts equal the diagnostics' own counts even when a client-side recomputation would disagree
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 4.3, 5.3, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5**

  - [x] 11.4 Implement the architecture graph layout
    - Create `frontend/src/lib/plan/graphLayout.js` (pure) exporting `MAX_GRAPH_NODES = 60` and `layoutArchitectureGraph(components, edges, opts)` returning `{ nodes, edges, width, height, layers }`
    - Longest-path layering plus barycentre ordering, stable tie-break on `id` so output is deterministic; emit an edge only when both endpoints resolve; mark back-edges; return early without laying out above the cap
    - _Requirements: 4.1, 12.6_

  - [ ]* 11.5 Write property test for the architecture layout
    - **Property 11: The architecture layout is sound and capped**
    - Create `frontend/src/lib/plan/__tests__/graphLayout.prop.test.js`; tag with `// Feature: proposal-depth-and-visualisation, Property 11: The architecture layout is sound and capped`
    - Assert every component gets exactly one node, no two nodes share `(layer, order)`, `layer(from) < layer(to)` for every non-back edge, only resolvable edges are emitted, output is deterministic for a given input, and no layout is computed above the cap
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 4.1, 12.6**

  - [x] 11.6 Implement the lifecycle derivation
    - Create `frontend/src/lib/plan/lifecycle.js` (pure) exporting `LIFECYCLE_STAGES` (brief → proposal → plan → agreement → invite → freelancer accepts → hired → funded → in review → client accepts → funds released) and `deriveLifecycle({ workflow, planStatus, matchWorkflow, milestones })`
    - Each stage carries `what`, `owner`, `advancedBy`, optional `gate: { holder, rule }`, and `state: 'done' | 'current' | 'upcoming' | 'blocked'`
    - Encode the two named gates from the real FSMs: `invited → accepted` is freelancer-only (`ACTION_ROLES.accept` in `backend/src/skills/clientMatchWorkflow.ts`), and `Approved → Funds_Released` follows client acceptance (`ALLOWED_TRANSITIONS` in `backend/src/skills/escrowStateMachine.ts`)
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [ ]* 11.7 Write property test for lifecycle derivation
    - **Property 13: Lifecycle derivation is ordered and gate-respecting**
    - Create `frontend/src/lib/plan/__tests__/lifecycle.prop.test.js`; tag with `// Feature: proposal-depth-and-visualisation, Property 13: Lifecycle derivation is ordered and gate-respecting`
    - Assert the full ordered stage list with exactly one `current`, all earlier stages `done`, all later stages `upcoming` or `blocked` (never `done`), non-empty `what`/`owner`/`advancedBy` on every stage, hiring `done` only on the freelancer's own recorded acceptance, and funds-released `done` only when a milestone reached client approval
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.6**

  - [x] 11.8 Implement the progressive disclosure helper
    - Create `frontend/src/lib/plan/disclosure.js` (pure) exporting `discloseSlice(items, pageSize, pagesShown)` returning `{ visible, remaining, total, hasMore }` — the shared basis for every "show more" affordance so nothing is silently truncated
    - _Requirements: 10.3_

  - [ ]* 11.9 Write property test for progressive disclosure and section emptiness
    - **Property 15 (progressive-disclosure clause): Progressive disclosure loses nothing**
    - Create `frontend/src/lib/plan/__tests__/disclosure.prop.test.js`; tag with `// Feature: proposal-depth-and-visualisation, Property 15: Historical records keep parsing and progressive disclosure loses nothing`
    - Assert for any list and page size that `visible.length + remaining === total` and repeated disclosure eventually reveals every item in order; and for any plan with an arbitrary subset of sections emptied that `sectionAvailability` reports every remaining section available and every emptied section unavailable with a stated reason
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 10.3, 11.4**

  - [x] 11.10 Implement the reduced-motion hook
    - Create `frontend/src/hooks/usePrefersReducedMotion.js` reading `matchMedia('(prefers-reduced-motion: reduce)')`, subscribing to changes, and defaulting to reduced when `matchMedia` is unavailable
    - _Requirements: 8.4_

- [x] 12. Checkpoint — pure projection layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Shared diagram primitives
  - [x] 13.1 Implement the state encoding maps
    - Create `frontend/src/components/plan/encoding.js` exporting the presentation maps for edge kinds (`sync` solid+filled arrow, `async` dashed+open arrow, `data` dotted+diamond, `event` dash-dot+hollow arrow), capacity states (`▲ Over / ● Near / ○ OK / ? Unknown`), task status, coverage state, and lifecycle state
    - Every entry carries a glyph or stroke pattern **and** a non-empty word; the non-colour channel must be unique per state within each map
    - _Requirements: 4.2, 6.2, 7.4, 12.3_

  - [x] 13.2 Implement the deferred visualisation wrapper
    - Create `frontend/src/components/plan/DeferredViz.jsx`: `IntersectionObserver` gate + `React.lazy` so each diagram becomes its own Vite chunk, a "Show diagram" button fallback when `IntersectionObserver` is unavailable, and an error boundary so one broken diagram cannot take down the proposal step
    - Container styling `overflow-x: auto; max-width: 100%` with `min-width` on the inner canvas only
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

  - [x] 13.3 Implement the empty state and legend components
    - Create `frontend/src/components/plan/EmptyDiagram.jsx` taking `{ reason, action }` so a missing section renders an explanation and an optional generate affordance rather than a blank container
    - Create `frontend/src/components/plan/DiagramLegend.jsx` rendering the `encoding.js` maps as glyph + word pairs
    - Match the existing `panel-*` classes and inline-style conventions used in `ExecutionPlanPanel.jsx`
    - _Requirements: 4.5, 10.5, 11.2, 11.4, 12.3_

  - [x] 13.4 Implement the shared selection inspector
    - Create `frontend/src/components/plan/DetailPanel.jsx` rendering the selected component or task: responsibility, served scope modules, interfaces, data boundary, failure impact, open decisions; owner role, estimate with its `estimateBasis` presented as an estimate, acceptance criteria, required evidence, served module
    - Substitute an explicit "not specified" for absent optional fields; close on `Escape`
    - _Requirements: 4.3, 4.4, 5.3, 9.6_

  - [ ]* 13.5 Write property test for state encoding
    - **Property 10: Diagram state is encoded distinctly and as text**
    - Create `frontend/src/components/plan/__tests__/encoding.prop.test.jsx`; tag with `// Feature: proposal-depth-and-visualisation, Property 10: Diagram state is encoded distinctly and as text`
    - Assert each presentation map is injective on its non-colour channel, provides a non-empty word for every state, and that a rendered stateful element exposes that word in its accessible name
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 4.2, 4.4, 6.2, 7.4, 12.3**

  - [ ]* 13.6 Write unit tests for DeferredViz and EmptyDiagram
    - Create `frontend/src/components/plan/__tests__/deferredViz.test.jsx`: the lazy chunk is not requested until intersection (12.2), the fallback button renders and loads the child when `IntersectionObserver` is absent, a throwing child is contained by the error boundary, and each `EmptyDiagram` reason renders its explanation (10.5)
    - _Requirements: 10.5, 12.2_

- [ ] 14. Diagram components
  - [x] 14.1 Implement the architecture graph
    - Create `frontend/src/components/plan/ArchitectureGraph.jsx`: SVG rendering of `layoutArchitectureGraph` output with per-kind stroke patterns and markers, a "View as table" toggle rendering the same data semantically, a single tab stop with roving `tabindex`, arrow-key traversal, `Enter`/`Space` selection into `DetailPanel`, one `aria-live="polite"` region, open-decision marking, and `EmptyDiagram` when `architecture` is null or has no components
    - Above `MAX_GRAPH_NODES` render the table view with a notice and never invoke the layout
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 14.2 Write property test for keyboard traversal
    - **Property 14: Interactive diagrams keep a single tab stop and reach every node**
    - Add to `frontend/src/components/plan/__tests__/encoding.prop.test.jsx`; tag with `// Feature: proposal-depth-and-visualisation, Property 14: Interactive diagrams keep a single tab stop and reach every node`
    - For any node set, assert exactly one node has `tabindex="0"` and all others `tabindex="-1"`, and that repeated arrow-key traversal visits every node exactly once per cycle
    - `{ numRuns: 100 }` minimum
    - **Validates: Requirements 12.4**

  - [ ]* 14.3 Write unit tests for the architecture graph empty state and containment
    - Create `frontend/src/components/plan/__tests__/architectureGraph.test.jsx`: `architecture: null` renders the empty state with a generate action (4.5), and an oversized diagram scrolls within its own container with no document-level horizontal overflow (12.5)
    - _Requirements: 4.5, 12.5_

  - [x] 14.4 Implement the schedule Gantt
    - Create `frontend/src/components/plan/ScheduleGantt.jsx`: a `<table>` of weeks × tasks positioning each task across its `startWeek`–`endWeek`, dependency relationships shown with the late-dependency case marked, critical-path rows distinguished from `diagnostics.criticalPathTaskIds`, task selection into `DetailPanel`
    - When `hasBlockingPlanError` reports a `dependency_cycle`, refuse to draw bars and render the validator findings instead
    - Above `MAX_GANTT_ROWS = 120` render the table view with a notice and per-workstream progressive disclosure via `discloseSlice`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.3, 12.3, 12.4, 12.5, 12.6_

  - [x] 14.5 Implement the capacity heatmap
    - Create `frontend/src/components/plan/CapacityHeatmap.jsx`: a `<table>` of roles × weeks driven by `buildCapacityMatrix`, each cell showing the `encoding.js` glyph **and** word, absent capacity rendered as unknown rather than zero, cell selection listing the contributing tasks from `tasksForCapacityCell`
    - Display server figures only — no recomputation in the browser
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.3, 12.4_

  - [x] 14.6 Implement the traceability matrix
    - Create `frontend/src/components/plan/TraceabilityMatrix.jsx` over `buildTraceabilityRows`: requirement → modules / tasks / checkpoints, uncovered requirements flagged, the diagnostics' own covered/total counts displayed, requirement `source` shown so inferred scope is distinguishable, and blocking open questions associated with the requirements they block
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 12.3, 12.4_

  - [x] 14.7 Implement the week detail view
    - Create `frontend/src/components/plan/WeekDetail.jsx` over `buildWeekRollups`: a vertical week sequence showing each week's number, label, and objective with its tasks, deliverables, checkpoints, and client actions; blocking client actions marked; `isGap` weeks surfaced as gaps
    - Phase/milestone rows expand into their constituent weeks in place without changing the active step; the vertical sequence is the layout at narrow widths rather than a clipped chart
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.3_

  - [ ]* 14.8 Write unit tests for the week detail view
    - Create `frontend/src/components/plan/__tests__/weekDetail.test.jsx`: expanding a phase leaves `activeStep` unchanged (3.4), and the vertical variant is used at narrow widths (3.6)
    - _Requirements: 3.4, 3.6_

  - [x] 14.9 Implement the project workflow map
    - Create `frontend/src/components/plan/ProjectWorkflowMap.jsx` over `deriveLifecycle`: stages with their state as glyph + word, the current stage indicated, stage selection showing `what` / `owner` / `advancedBy` / `gate`, transitions gated on `usePrefersReducedMotion`, roving `tabindex` keyboard traversal, and active-stage changes announced through an `aria-live="polite"` region
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 12.3, 12.4_

  - [ ]* 14.10 Write unit tests for the workflow map accessibility
    - Create `frontend/src/components/plan/__tests__/projectWorkflowMap.test.jsx` with `matchMedia` stubbed to `reduce`: no transitions applied and selection still works (8.4); keyboard traversal reaches every stage and announces the active stage through the live region (8.5)
    - _Requirements: 8.4, 8.5_

- [x] 15. Checkpoint — diagram components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Surface integration
  - [x] 16.1 Implement the plan fetching hook
    - Create `frontend/src/hooks/usePlan.js` wrapping the existing `api.getExecutionPlan` from `frontend/src/lib/api.js`, returning `{ plan, diagnostics, status, revision, error, notGenerated, reload, generate }`
    - A 404 `PLAN_NOT_GENERATED` sets `notGenerated` rather than surfacing an error; any other error is returned so the caller can keep rendering the rest of the step
    - _Requirements: 11.2, 11.4_

  - [x] 16.2 Extend the AI Builder steps with the new diagrams
    - In `frontend/src/sections/dashboard/ProposalGenerator.jsx`: extend `STEP_TABS` to step 2 `["scope","architecture","traceability"]`, step 3 `["risks","competitors","impact"]`, step 4 `["weeks","schedule","capacity","roles"]`, and add the workflow map to step 5
    - Mount each diagram inside `DeferredViz`, wire `usePlan`, memoise selector results on `[plan, diagnostics]`, add section navigation that preserves the reviewer's position, surface the `depthReport` note and `score_basis` explanations, and keep the existing sequential approval gating and persisted `activeStep` / `approvedSteps` restore untouched
    - _Requirements: 1.3, 2.4, 3.4, 10.1, 10.2, 10.3, 10.4, 10.5, 11.2, 11.4, 12.2_

  - [ ]* 16.3 Write unit tests for the builder integration
    - Create `frontend/src/sections/dashboard/__tests__/proposalGenerator.test.jsx`: section navigation preserves the scroll anchor and the active step (10.1), a proposal with no plan renders the generate affordance rather than an error (11.2), and a null `diagnostics` record renders empty states for the dependent diagrams while scope and architecture still render (11.4)
    - _Requirements: 10.1, 11.2, 11.4_

  - [x] 16.4 Swap the project plan panel to the shared components
    - In `frontend/src/sections/dashboard/ExecutionPlanPanel.jsx`: replace the list renderings with `ArchitectureGraph`, `ScheduleGantt`, `CapacityHeatmap`, `TraceabilityMatrix`, and `WeekDetail`, keeping the existing tabs, inspector, revisions, and approve/reopen flow intact
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 7.1, 11.4_

- [ ] 17. Cross-cutting verification
  - [ ]* 17.1 Write the bundle isolation smoke test
    - Create `frontend/src/lib/plan/__tests__/bundleIsolation.test.js` asserting that no module under `frontend/src/lib/plan/` or `frontend/src/components/plan/` transitively imports `three`, `@react-three/fiber`, `@react-three/drei`, or `matter-js`
    - One execution is sufficient — this is a configuration fact, not a property
    - _Requirements: 12.1_

- [x] 18. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Test infrastructure is task 1 so each property test can sit beside the code it validates instead of being batched at the end.
- Property 15 is covered by two sub-tasks (2.5 and 11.9) because the design's Testing Strategy assigns its backward-compatibility clause to Python and its progressive-disclosure clause to the frontend.
- Every property test carries the tag comment `Feature: proposal-depth-and-visualisation, Property {number}: {property text}` and runs a minimum of 100 iterations (`@settings(max_examples=100)` in Hypothesis, `{ numRuns: 100 }` in fast-check, an explicit ≥100-case matrix for Property 16).
- `ai-service/test_plan_generator.py`, `test_timeline_validation.py`, and `test_brief_parser_scoring.py` are the regression net for the deterministic baseline and must keep passing; task 6.5 updates only their call sites for the async change.
- No task deploys, gathers metrics, or runs the application manually — every verification is an automated test.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "2.4", "7.1", "10.1", "11.10"] },
    { "id": 1, "tasks": ["2.3", "5.1", "6.1", "10.2", "11.1", "11.4", "11.6", "11.8", "13.1"] },
    { "id": 2, "tasks": ["2.5", "3.1", "3.3", "5.2", "6.2", "6.4", "9.1", "11.2", "11.5", "11.7", "11.9", "13.2", "13.3", "13.4"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "5.3", "6.5", "11.3", "13.5", "13.6", "14.1", "14.4", "14.5", "14.6", "14.7", "14.9"] },
    { "id": 4, "tasks": ["3.5", "3.7", "5.4", "7.2", "14.2", "14.3", "14.8", "14.10", "16.1", "16.4"] },
    { "id": 5, "tasks": ["6.3", "6.7", "7.3", "16.2"] },
    { "id": 6, "tasks": ["6.6", "16.3", "17.1"] }
  ]
}
```
