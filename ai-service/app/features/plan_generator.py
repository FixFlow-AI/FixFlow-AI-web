"""AI-008 — Deep execution-plan generation (Week 2).

Turns a v1 ``Proposal`` into a v2 ``ExecutionPlan``. This module is the
**orchestrator** of the plan pipeline, and it always has a floor to stand on:
``derive_execution_plan_from_proposal`` is a deterministic derivation from the
proposal's own structure that produces a schema-valid, validator-clean plan with
no LLM dependency.

``generate_execution_plan`` builds that baseline *first*, then optionally runs
the authoring pipeline in front of it — ``plan_authoring`` (one bounded Gemini
call for content only) → ``plan_assembly`` (mints ids, computes every number) →
``timeline_validation`` → at most one subtractive ``plan_repair`` pass →
re-validate. The authored candidate is only returned when it is validator-clean
*and* substantive (see ``_is_substantive``); otherwise the baseline is returned
untouched. An authoring timeout therefore costs latency and nothing else
(R9.3, R9.4, R9.5).

Numbers (hours, capacity, severity, coverage) are never taken from the LLM —
they are computed here, in ``plan_assembly``, or validated by
``timeline_validation.py``.
"""
from __future__ import annotations

import logging
import math
import re
from typing import Dict, List, Optional

from ..config import get_settings
from ..schemas.execution_plan import (
    ArchitectureComponent,
    ArchitectureDocument,
    Assumption,
    Checkpoint,
    Deliverable,
    ExecutionPlan,
    PlanDiagnostics,
    PlanRiskLink,
    PlanTask,
    PlanWeek,
    Requirement,
    ScopeModule,
    TeamCapacity,
    Workstream,
)
from ..schemas.proposal import Proposal
from .fallback_logger import log_fallback
from .plan_assembly import assemble_plan
from .plan_authoring import author_plan_draft
from .plan_repair import repair_plan
from .timeline_validation import HIGH_RISK_SEVERITY, validate_execution_plan

logger = logging.getLogger(__name__)

_COMPLEXITY_HOURS = {"High": 24, "Medium": 16, "Low": 8}
_DEFAULT_CAPACITY_FLOOR = 40.0


def _slug(text: str, fallback: str = "item") -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or fallback


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) >= 4}


def _unique(seq: List[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for s in seq:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def derive_execution_plan_from_proposal(proposal: Proposal) -> ExecutionPlan:
    """Deterministically build a valid ExecutionPlan from a v1 Proposal.

    Every ID is stable and every cross-reference resolves, so the deterministic
    validator returns zero errors for any well-formed v1 proposal.
    """
    assumptions: List[Assumption] = [
        Assumption(
            id="asm-weeks",
            statement="Weeks are relative (Week 1..N) until the client supplies a project start date.",
            category="scheduling",
        ),
        Assumption(
            id="asm-capacity",
            statement="Role capacity is assumed sufficient for the derived plan; adjust hours/week per role once staffing is confirmed.",
            category="capacity",
        ),
    ]

    # ── Requirements + scope modules (one module per feature) ──
    requirements: List[Requirement] = []
    modules: List[ScopeModule] = []
    area_of_module: Dict[str, str] = {}
    for i, feat in enumerate(proposal.features):
        rid = f"req-{i + 1}"
        mid = f"mod-{i + 1}"
        area = feat.area or "Engineering"
        requirements.append(
            Requirement(
                id=rid,
                statement=f"{feat.title}: {feat.description}".strip()[:400] or feat.title,
                source="brief",
                priority="must" if feat.complexity == "High" else "should",
            )
        )
        modules.append(
            ScopeModule(
                id=mid,
                name=feat.title,
                businessObjective=feat.description or f"Deliver {feat.title}.",
                actors=["Client", "End user"],
                inScope=[feat.description or feat.title],
                outOfScope=["Anything not described for this module in the brief."],
                acceptanceCriteria=[
                    f"{feat.title} behaves as described in the approved brief.",
                    f"The client verifies {feat.title} against an agreed walkthrough before sign-off.",
                ],
                requirementIds=[rid],
                dataEntities=[],
                integrations=[],
                securityControls=[],
                componentIds=[f"cmp-{_slug(area)}"],
                complexity=feat.complexity,
            )
        )
        area_of_module[mid] = area

    if not modules:  # guarantee at least one module for empty proposals
        requirements.append(Requirement(id="req-1", statement="Deliver the described project.", source="brief"))
        modules.append(
            ScopeModule(
                id="mod-1", name="Core delivery", businessObjective="Deliver the described project.",
                inScope=["Core scope"], outOfScope=["Undescribed work."],
                acceptanceCriteria=["Core scope is delivered.", "Client accepts the delivery."],
                requirementIds=["req-1"], componentIds=["cmp-core"],
            )
        )
        area_of_module["mod-1"] = "Engineering"

    # ── Workstreams + roles (one per distinct area) ──
    areas = _unique([area_of_module[m.id] for m in modules])
    workstreams: List[Workstream] = [
        Workstream(id=f"ws-{_slug(a)}", name=a, description=f"{a} workstream") for a in areas
    ]
    ws_of_area = {a: f"ws-{_slug(a)}" for a in areas}
    role_of_area = {a: f"role-{_slug(a)}" for a in areas}

    # ── Architecture: one component per area, linked to its modules ──
    components: List[ArchitectureComponent] = []
    for a in areas:
        comp_id = f"cmp-{_slug(a)}"
        linked = [m.id for m in modules if area_of_module[m.id] == a]
        components.append(
            ArchitectureComponent(
                id=comp_id,
                name=f"{a} Service",
                responsibility=f"Implements the {a} capabilities of the project.",
                moduleIds=linked,
                dataBoundary=f"Owns the data and state required for {a}.",
                interfaces=["Internal service API"],
                errorHandling="Validate inputs at the boundary; log, retry transient failures with backoff, and return safe errors.",
                observability="Structured logs and health checks.",
                security="AuthN/AuthZ at the boundary; least-privilege data access.",
                scaling="Stateless horizontal scaling behind the gateway.",
            )
        )
    architecture = ArchitectureDocument(
        summary=proposal.project_summary or "Project architecture derived from the proposal scope.",
        components=components,
        edges=[],
    )

    # ── Weeks + tasks + deliverables (from the v1 delivery plan) ──
    module_tokens = {m.id: (_tokens(m.name) | _tokens(area_of_module[m.id])) for m in modules}

    def match_module(text: str) -> str:
        toks = _tokens(text)
        best, best_score = modules[0].id, 0
        for m in modules:
            score = len(toks & module_tokens[m.id])
            if score > best_score:
                best, best_score = m.id, score
        return best

    weeks: List[PlanWeek] = []
    tasks: List[PlanTask] = []
    deliverables: List[Deliverable] = []
    checkpoints: List[Checkpoint] = []
    deliverable_seq = 0

    source_weeks = list(proposal.delivery_plan.weeks) if proposal.delivery_plan else []
    if not source_weeks:
        # Minimal single-week plan covering module 0.
        source_weeks = []

    default_role = role_of_area[areas[0]]

    if source_weeks:
        for i, dw in enumerate(source_weeks):
            wk = i + 1
            week_task_ids: List[str] = []
            for j, dt in enumerate(dw.tasks):
                tid = f"task-{wk}-{j + 1}"
                mid = match_module(dt.title)
                area = area_of_module[mid]
                comp = proposal.features[int(mid.split("-")[1]) - 1].complexity if mid.startswith("mod-") and mid.split("-")[1].isdigit() and int(mid.split("-")[1]) - 1 < len(proposal.features) else "Medium"
                tasks.append(
                    PlanTask(
                        id=tid,
                        title=dt.title,
                        description=f"{dt.title} (owner: {dt.owner}).",
                        moduleId=mid,
                        workstreamId=ws_of_area[area],
                        ownerRoleId=role_of_area[area],
                        estimateHours=float(_COMPLEXITY_HOURS.get(comp, 16)),
                        startWeek=wk,
                        endWeek=wk,
                        acceptanceCriteria=[f"'{dt.title}' is completed and verified."],
                        evidenceRequired=["Reviewed output or demo"],
                        status=dt.status if dt.status in ("planned", "done", "backlog") else "planned",
                        priority="must" if comp == "High" else "should",
                    )
                )
                week_task_ids.append(tid)

            week_deliverable_ids: List[str] = []
            for d in dw.deliverables:
                deliverable_seq += 1
                did = f"del-{deliverable_seq}"
                deliverables.append(Deliverable(id=did, title=d))
                week_deliverable_ids.append(did)

            # One demo checkpoint per week, covering that week's tasks.
            cp_id = f"cp-wk{wk}"
            checkpoints.append(
                Checkpoint(
                    id=cp_id,
                    title=f"Week {wk} review",
                    type="demo",
                    weekNumber=wk,
                    ownerRoleId=default_role,
                    blocking=False,
                    exitCriteria=[f"Week {wk} objectives met and demoed."],
                    evidenceRequired=["Demo recording or checklist"],
                    linkedTaskIds=week_task_ids,
                )
            )
            weeks.append(
                PlanWeek(
                    id=f"wk-{wk}",
                    weekNumber=wk,
                    label=dw.label or f"Week {wk}",
                    objective=(dw.goals[0] if dw.goals else f"Deliver week {wk} scope."),
                    workstreamIds=_unique([ws_of_area[area_of_module[t.moduleId]] for t in tasks if t.id in week_task_ids]),
                    taskIds=week_task_ids,
                    deliverableIds=week_deliverable_ids,
                    checkpointIds=[cp_id],
                )
            )

    # Ensure every module has at least one implementing task (traceability).
    covered_modules = {t.moduleId for t in tasks}
    if not weeks:
        weeks.append(PlanWeek(id="wk-1", weekNumber=1, label="Week 1", objective="Deliver initial scope.",
                              workstreamIds=[], taskIds=[], deliverableIds=[], checkpointIds=[]))
    last_wk = weeks[-1].weekNumber
    extra_seq = 0
    for m in modules:
        if m.id in covered_modules:
            continue
        extra_seq += 1
        tid = f"task-cover-{extra_seq}"
        area = area_of_module[m.id]
        tasks.append(
            PlanTask(
                id=tid, title=f"Implement {m.name}", description=f"Implement scope module '{m.name}'.",
                moduleId=m.id, workstreamId=ws_of_area[area], ownerRoleId=role_of_area[area],
                estimateHours=float(_COMPLEXITY_HOURS.get(m.complexity, 16)),
                startWeek=last_wk, endWeek=last_wk,
                acceptanceCriteria=[f"'{m.name}' meets its acceptance criteria."],
                evidenceRequired=["Reviewed output"], status="planned",
            )
        )
        weeks[-1].taskIds.append(tid)
        # attach to the last week's checkpoint (or create one)
        if weeks[-1].checkpointIds:
            for cp in checkpoints:
                if cp.id == weeks[-1].checkpointIds[0]:
                    cp.linkedTaskIds.append(tid)
                    break
        else:
            cp_id = f"cp-wk{last_wk}"
            checkpoints.append(Checkpoint(id=cp_id, title=f"Week {last_wk} review", type="demo",
                                          weekNumber=last_wk, ownerRoleId=default_role, blocking=False,
                                          exitCriteria=[f"Week {last_wk} objectives met."],
                                          evidenceRequired=["Demo"], linkedTaskIds=[tid]))
            weeks[-1].checkpointIds.append(cp_id)

    # ── Final approval + risk-review checkpoints ──
    final_wk = weeks[-1].weekNumber
    last_week_task_ids = weeks[-1].taskIds
    checkpoints.append(
        Checkpoint(
            id="cp-approval", title="Client approval", type="client_approval", weekNumber=final_wk,
            ownerRoleId=default_role, blocking=True,
            exitCriteria=["Client accepts all delivered scope."],
            evidenceRequired=["Signed approval or recorded confirmation"],
            linkedTaskIds=last_week_task_ids,
        )
    )
    weeks[-1].checkpointIds.append("cp-approval")
    checkpoints.append(
        Checkpoint(
            id="cp-risk-review", title="Risk & security review", type="security_review", weekNumber=final_wk,
            ownerRoleId=default_role, blocking=False,
            exitCriteria=["High-severity risks reviewed and mitigated."],
            evidenceRequired=["Review notes"], linkedTaskIds=[],
        )
    )
    weeks[-1].checkpointIds.append("cp-risk-review")

    # ── Risks (severity is already deterministic on the v1 proposal) ──
    risks: List[PlanRiskLink] = []
    for i, r in enumerate(proposal.risks):
        mitigation = ["cp-risk-review"] if r.severity >= HIGH_RISK_SEVERITY else []
        risks.append(
            PlanRiskLink(
                id=f"risk-{i + 1}", label=r.label, severity=r.severity, category=r.category,
                affectedModuleIds=[], affectedWeekNumbers=[],
                mitigationCheckpointIds=mitigation,
                status="mitigated" if mitigation else "open",
            )
        )

    # ── Team capacity: size each role so the derived plan never over-allocates ──
    demand: Dict[str, float] = {}
    for t in tasks:
        span = max(1, t.endWeek - t.startWeek + 1)
        per_week = t.estimateHours / span
        for wk in range(t.startWeek, t.endWeek + 1):
            demand[f"{t.ownerRoleId}#{wk}"] = demand.get(f"{t.ownerRoleId}#{wk}", 0.0) + per_week
    max_demand_by_role: Dict[str, float] = {}
    for key, hours in demand.items():
        role = key.split("#")[0]
        max_demand_by_role[role] = max(max_demand_by_role.get(role, 0.0), hours)

    team_capacity: List[TeamCapacity] = []
    for a in areas:
        role_id = role_of_area[a]
        peak = max_demand_by_role.get(role_id, 0.0)
        # keep utilization under 100% (validator errors at >=100%): add headroom
        cap = max(_DEFAULT_CAPACITY_FLOOR, math.ceil(peak + 1))
        team_capacity.append(TeamCapacity(roleId=role_id, roleName=f"{a} Specialist", hoursPerWeek=float(cap)))

    plan = ExecutionPlan(
        schemaVersion=2,
        projectStartDate=None,
        degraded=False,
        planningAssumptions=assumptions,
        openQuestions=[],
        requirements=requirements,
        scopeModules=modules,
        architecture=architecture,
        workstreams=workstreams,
        teamCapacity=team_capacity,
        deliverables=deliverables,
        tasks=tasks,
        weeks=weeks,
        checkpoints=checkpoints,
        risks=risks,
    )
    plan.diagnostics = validate_execution_plan(plan)
    return plan


def _merge_section(base: ExecutionPlan, fresh: ExecutionPlan, scope: str) -> ExecutionPlan:
    """Replace only the requested section of ``base`` with ``fresh`` content,
    preserving client-owned data elsewhere."""
    merged = base.model_copy(deep=True)
    if scope == "architecture":
        merged.architecture = fresh.architecture
    elif scope == "timeline":
        merged.workstreams = fresh.workstreams
        merged.teamCapacity = fresh.teamCapacity
        merged.deliverables = fresh.deliverables
        merged.tasks = fresh.tasks
        merged.weeks = fresh.weeks
        merged.checkpoints = fresh.checkpoints
    else:  # 'all'
        return fresh
    merged.diagnostics = validate_execution_plan(merged)
    return merged


_FEATURE = "plan_generator"


def _is_substantive(candidate: ExecutionPlan, baseline: ExecutionPlan) -> bool:
    """Is an authored candidate actually worth preferring over the baseline?

    ``errorCount == 0`` is deliberately *not* the whole gate. A degenerate draft
    — one where nothing survives key resolution in ``plan_assembly`` — assembles
    into a thin-but-perfectly-clean plan: no modules, no tasks, one placeholder
    week. Such a plan would pass a pure validity check and silently replace a
    good deterministic baseline with an empty one.

    So a candidate must also earn its place:

    * it carries real work — at least one scope module and one task;
    * it does not regress traceability — it covers at least as many
      requirements as the baseline it would replace.

    Coverage is compared by count rather than by identity because the authored
    plan mints its own requirement ids from the draft; the baseline's ids come
    from the proposal's features and the two sets are not comparable. What must
    not shrink is how much of the plan is actually traced (R9.1).
    """
    if not candidate.scopeModules or not candidate.tasks or not candidate.weeks:
        return False

    candidate_diagnostics = candidate.diagnostics
    if candidate_diagnostics is None:
        return False
    baseline_covered = baseline.diagnostics.coveredRequirementCount if baseline.diagnostics else 0
    return candidate_diagnostics.coveredRequirementCount >= baseline_covered


def _revalidate(plan: ExecutionPlan) -> PlanDiagnostics:
    """Recompute and attach diagnostics. Never trusts what the plan arrived with."""
    diagnostics = validate_execution_plan(plan)
    plan.diagnostics = diagnostics
    return diagnostics


async def _authored_candidate(
    proposal: Proposal,
    brief_text: Optional[str],
    baseline: ExecutionPlan,
    timeout_sec: float,
) -> Optional[ExecutionPlan]:
    """Run author → assemble → validate → repair → re-validate.

    Returns a plan with ``authoringSource`` set to ``"authored"`` (clean first
    time) or ``"repaired"`` (clean after one repair pass), or ``None`` when the
    pipeline produced nothing worth using — no draft, still invalid after
    repair, or clean but not substantive. ``None`` means "keep the baseline";
    nothing broken is ever surfaced (R9.3).
    """
    draft = await author_plan_draft(proposal, brief_text, timeout_sec=timeout_sec)
    if draft is None:
        return None

    try:
        candidate = assemble_plan(draft, proposal, baseline=baseline)
        diagnostics = candidate.diagnostics or _revalidate(candidate)
        source = "authored"

        if diagnostics.errorCount > 0:
            # One bounded, subtractive pass. ``repair_plan`` clears diagnostics
            # precisely because it cannot know whether it succeeded.
            candidate = repair_plan(candidate, diagnostics)
            diagnostics = _revalidate(candidate)
            source = "repaired"
    except Exception as error:  # noqa: BLE001 - authoring is optional enrichment
        log_fallback(_FEATURE, "assembly_failed", str(error))
        logger.warning(
            "Plan assembly/repair failed (%s); keeping the derived plan.",
            type(error).__name__,
        )
        return None

    if diagnostics.errorCount > 0:
        log_fallback(_FEATURE, "authored_plan_invalid", f"errorCount={diagnostics.errorCount}")
        logger.info("Authored plan still invalid after repair; keeping the derived plan.")
        return None

    if not _is_substantive(candidate, baseline):
        log_fallback(_FEATURE, "authored_plan_thin", f"tasks={len(candidate.tasks)}")
        logger.info("Authored plan is clean but not substantive; keeping the derived plan.")
        return None

    candidate.authoringSource = source
    return candidate


async def generate_execution_plan(
    proposal: Proposal,
    *,
    scope: str = "all",
    existing_plan: Optional[ExecutionPlan] = None,
    preserve_client_edits: bool = True,
    brief_text: Optional[str] = None,
    timeout_sec: Optional[float] = None,
) -> ExecutionPlan:
    """Generate or regenerate (a section of) an execution plan.

    The deterministic baseline is built first and is always the fallback, so
    this coroutine always resolves to a validator-clean plan with
    ``authoringSource`` set. ``scope`` may be 'all' | 'architecture' |
    'timeline'. When ``existing_plan`` is supplied and ``preserve_client_edits``
    is true, only the requested section is replaced.

    ``timeout_sec`` bounds the single authoring call; it defaults to
    ``GEMINI_PLAN_TIMEOUT_SEC`` (R9.5).
    """
    baseline = derive_execution_plan_from_proposal(proposal)
    baseline.authoringSource = "derived"

    merging_section = scope != "all" and existing_plan is not None and preserve_client_edits
    if merging_section:
        # A section merge splices ids into a plan derived from this same
        # proposal, so the incoming section must use baseline ids. Authored ids
        # are minted from the draft and would not resolve against the retained
        # sections, which is exactly the dangling-reference class R9.1 forbids —
        # so sectioned regeneration stays deterministic.
        merged = _merge_section(existing_plan, baseline, scope)
        merged.authoringSource = "derived"
        return merged

    budget = timeout_sec if timeout_sec and timeout_sec > 0 else get_settings().gemini_plan_timeout_sec
    candidate = await _authored_candidate(proposal, brief_text, baseline, float(budget))
    return candidate if candidate is not None else baseline


def degraded_execution_plan(reason: str) -> ExecutionPlan:
    """A minimal, clearly-flagged safe plan (spec §6.4). Contains only relative
    Week 1 and a visible notice — never invented detail."""
    plan = ExecutionPlan(
        schemaVersion=2,
        degraded=True,
        degradedReason=reason,
        authoringSource="degraded",
        planningAssumptions=[
            Assumption(id="asm-degraded", statement="AI plan details were unavailable; this is a minimal placeholder.")
        ],
        openQuestions=[],
        requirements=[Requirement(id="req-1", statement="Define the project scope.", source="inferred")],
        scopeModules=[
            ScopeModule(
                id="mod-1", name="Scope to be defined", businessObjective="Add or regenerate the plan.",
                inScope=["To be defined"], outOfScope=["To be defined"],
                acceptanceCriteria=["Scope is defined by the client.", "Plan is regenerated."],
                requirementIds=["req-1"], componentIds=[],
            )
        ],
        architecture=None,
        workstreams=[Workstream(id="ws-core", name="Core")],
        teamCapacity=[TeamCapacity(roleId="role-core", roleName="Core Specialist", hoursPerWeek=40.0)],
        deliverables=[],
        tasks=[
            PlanTask(
                id="task-1", title="Define and plan scope",
                description="Placeholder task — regenerate the plan or add real tasks.",
                moduleId="mod-1", workstreamId="ws-core", ownerRoleId="role-core",
                estimateHours=8.0, startWeek=1, endWeek=1,
                acceptanceCriteria=["Scope and plan are defined."], status="planned",
            )
        ],
        weeks=[PlanWeek(id="wk-1", weekNumber=1, label="Week 1",
                        objective="AI details unavailable — add or regenerate plan.",
                        taskIds=["task-1"], checkpointIds=["cp-1"])],
        checkpoints=[
            Checkpoint(id="cp-1", title="Plan defined", type="client_approval", weekNumber=1,
                       ownerRoleId="role-core", blocking=False,
                       exitCriteria=["Client defines or regenerates the plan."],
                       evidenceRequired=[], linkedTaskIds=["task-1"])
        ],
        risks=[],
    )
    plan.diagnostics = validate_execution_plan(plan)
    return plan
