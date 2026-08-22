"""AI-008 — one bounded, subtractive repair pass over an ``ExecutionPlan``.

``repair_plan`` is the last chance an *authored* plan gets before the
orchestrator falls back to the deterministic baseline (spec §9.3). It is:

  * **pure** — the input plan is never mutated; a deep copy is returned;
  * **exactly one pass** — no loop-until-clean, no second validation;
  * **subtractive** — it removes references it cannot resolve rather than
    inventing content, which is what keeps Requirement 9.4 true.

It is driven by the diagnostic codes emitted by ``timeline_validation`` and
handles exactly these:

  ``dangling_ref``          prune every unresolvable cross-reference
  ``week_discontinuity``    renumber weeks to 1..N and remap week references
  ``span_out_of_range``     clamp task spans / checkpoint weeks into 1..N
  ``dependency_cycle``      drop the reported back-edge
  ``module_no_task``        add a covering task (additive exception)
  ``high_risk_unmitigated`` attach the risk to ``cp-risk-review`` (additive exception)
  ``orphan_deliverable``    drop the unscheduled deliverable

The two additive exceptions reuse content already in the plan (module name,
existing workstreams/roles) and derive every number from the same deterministic
tables the baseline generator uses — they never author prose.

The returned plan carries ``diagnostics = None``: repair does not know whether
it succeeded, so the caller MUST re-run ``validate_execution_plan`` and keep the
candidate only when it is clean.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from ..schemas.execution_plan import (
    Checkpoint,
    ExecutionPlan,
    PlanDiagnostics,
    PlanTask,
    PlanWeek,
    ScopeModule,
)
from .timeline_validation import HIGH_RISK_SEVERITY

# Mirrors ``plan_generator._COMPLEXITY_HOURS`` — a covering task must be priced
# from the same deterministic table as every other task, never invented.
_COMPLEXITY_HOURS: Dict[str, float] = {"High": 24.0, "Medium": 16.0, "Low": 8.0}
_DEFAULT_COMPLEXITY_HOURS = 16.0

# The checkpoint an unmitigated high-severity risk is attached to, matching the
# id the deterministic baseline always mints.
RISK_REVIEW_CHECKPOINT_ID = "cp-risk-review"

# "Task dependency cycle detected involving 'a' → 'b'." — the reported back edge.
_CYCLE_EDGE_RE = re.compile(r"involving '(.+?)'\s*\u2192\s*'(.+?)'")

_HANDLED_CODES = frozenset(
    {
        "dangling_ref",
        "week_discontinuity",
        "span_out_of_range",
        "dependency_cycle",
        "module_no_task",
        "high_risk_unmitigated",
        "orphan_deliverable",
    }
)


def repair_plan(plan: ExecutionPlan, diagnostics: PlanDiagnostics) -> ExecutionPlan:
    """Return a repaired copy of ``plan``; one pass, driven by ``diagnostics``.

    The input plan is never mutated. Diagnostics are cleared on the result —
    the caller re-validates.
    """
    working = plan.model_copy(deep=True)
    codes = {issue.code for issue in diagnostics.issues}

    if codes & _HANDLED_CODES:
        if "dependency_cycle" in codes:
            _break_reported_cycles(working, diagnostics)

        dropped_tasks = _prune_dangling_refs(working) if "dangling_ref" in codes else False

        if "week_discontinuity" in codes:
            _renumber_weeks(working)
        if "span_out_of_range" in codes or "week_discontinuity" in codes:
            _clamp_spans(working)

        if "module_no_task" in codes or dropped_tasks:
            _add_covering_tasks(working)
        if "high_risk_unmitigated" in codes:
            _attach_unmitigated_high_risks(working)
        if "orphan_deliverable" in codes:
            _drop_orphan_deliverables(working, _ids_for_code(diagnostics, "orphan_deliverable", "deliverables."))

    working.diagnostics = None
    return working


# ── diagnostic parsing ─────────────────────────────────────────────────────

def _ids_for_code(diagnostics: PlanDiagnostics, code: str, prefix: str) -> List[str]:
    """Ids carried by the ``path`` of every issue with ``code``, in report order."""
    out: List[str] = []
    for issue in diagnostics.issues:
        if issue.code != code or not issue.path or not issue.path.startswith(prefix):
            continue
        ident = issue.path[len(prefix) :]
        if ident and ident not in out:
            out.append(ident)
    return out


def _break_reported_cycles(working: ExecutionPlan, diagnostics: PlanDiagnostics) -> None:
    """Drop each reported back-edge — the minimum removal that breaks the cycle."""
    edges: List[Tuple[str, str]] = []
    for issue in diagnostics.issues:
        if issue.code != "dependency_cycle":
            continue
        match = _CYCLE_EDGE_RE.search(issue.message)
        if match:
            edges.append((match.group(1), match.group(2)))
    if not edges:
        return

    tasks_by_id = {t.id: t for t in working.tasks}
    for source_id, dependency_id in edges:
        task = tasks_by_id.get(source_id)
        if task and dependency_id in task.dependencyTaskIds:
            task.dependencyTaskIds = [d for d in task.dependencyTaskIds if d != dependency_id]


# ── subtractive fixes ──────────────────────────────────────────────────────

def _prune_dangling_refs(working: ExecutionPlan) -> bool:
    """Remove every cross-reference that does not resolve.

    Where the schema forbids an empty reference (a module needs ≥1 requirement,
    a task needs a module and a workstream) the *owner* is dropped instead —
    keeping it would require inventing the missing record. Returns whether any
    task was dropped, so the caller knows scope coverage may have regressed.
    """
    requirement_ids = {r.id for r in working.requirements}
    assumption_ids = {a.id for a in working.planningAssumptions}
    question_ids = {q.id for q in working.openQuestions}
    workstream_ids = {w.id for w in working.workstreams}
    component_ids = {
        c.id for c in (working.architecture.components if working.architecture else [])
    }

    kept_modules: List[ScopeModule] = []
    for module in working.scopeModules:
        resolved_requirements = [r for r in module.requirementIds if r in requirement_ids]
        if not resolved_requirements:
            continue  # schema demands ≥1; dropping is the only subtractive option
        module.requirementIds = resolved_requirements
        module.componentIds = [c for c in module.componentIds if c in component_ids]
        module.assumptionIds = [a for a in module.assumptionIds if a in assumption_ids]
        module.openQuestionIds = [q for q in module.openQuestionIds if q in question_ids]
        kept_modules.append(module)
    working.scopeModules = kept_modules

    module_ids = {m.id for m in kept_modules}
    for module in kept_modules:
        module.dependencyModuleIds = [d for d in module.dependencyModuleIds if d in module_ids]

    kept_tasks = [
        t for t in working.tasks if t.moduleId in module_ids and t.workstreamId in workstream_ids
    ]
    dropped_tasks = len(kept_tasks) != len(working.tasks)
    working.tasks = kept_tasks
    task_ids = {t.id for t in kept_tasks}
    for task in kept_tasks:
        task.dependencyTaskIds = [d for d in task.dependencyTaskIds if d in task_ids]

    for checkpoint in working.checkpoints:
        checkpoint.linkedTaskIds = [t for t in checkpoint.linkedTaskIds if t in task_ids]
    checkpoint_ids = {c.id for c in working.checkpoints}

    for deliverable in working.deliverables:
        if deliverable.moduleId is not None and deliverable.moduleId not in module_ids:
            deliverable.moduleId = None
    deliverable_ids = {d.id for d in working.deliverables}

    week_ids = {w.id for w in working.weeks}
    week_numbers = {w.weekNumber for w in working.weeks}
    for week in working.weeks:
        week.taskIds = [t for t in week.taskIds if t in task_ids]
        week.deliverableIds = [d for d in week.deliverableIds if d in deliverable_ids]
        week.checkpointIds = [c for c in week.checkpointIds if c in checkpoint_ids]
        week.dependencyWeekIds = [w for w in week.dependencyWeekIds if w in week_ids]
        week.workstreamIds = [w for w in week.workstreamIds if w in workstream_ids]

    for risk in working.risks:
        risk.affectedModuleIds = [m for m in risk.affectedModuleIds if m in module_ids]
        risk.affectedWeekNumbers = [n for n in risk.affectedWeekNumbers if n in week_numbers]
        risk.mitigationTaskIds = [t for t in risk.mitigationTaskIds if t in task_ids]
        risk.mitigationCheckpointIds = [
            c for c in risk.mitigationCheckpointIds if c in checkpoint_ids
        ]

    if working.architecture:
        for component in working.architecture.components:
            component.moduleIds = [m for m in component.moduleIds if m in module_ids]

    return dropped_tasks


def _renumber_weeks(working: ExecutionPlan) -> None:
    """Renumber weeks to a continuous 1..N and remap every week reference.

    Week labels and objectives are left untouched — rewriting them would be
    authoring, not repair.
    """
    if not working.weeks:
        return

    ordered = sorted(working.weeks, key=lambda w: (w.weekNumber, w.id))
    remap: Dict[int, int] = {}
    for new_number, week in enumerate(ordered, start=1):
        remap.setdefault(week.weekNumber, new_number)
        week.weekNumber = new_number
    working.weeks = ordered

    def mapped(number: int) -> int:
        return remap.get(number, number)

    for task in working.tasks:
        task.startWeek = mapped(task.startWeek)
        task.endWeek = mapped(task.endWeek)
    for checkpoint in working.checkpoints:
        checkpoint.weekNumber = mapped(checkpoint.weekNumber)
    for week in working.weeks:
        for action in week.clientActions:
            action.weekNumber = mapped(action.weekNumber)
    for risk in working.risks:
        risk.affectedWeekNumbers = [mapped(n) for n in risk.affectedWeekNumbers]


def _clamp_spans(working: ExecutionPlan) -> None:
    """Pull task spans and checkpoint weeks back inside 1..N."""
    if not working.weeks:
        return
    max_week = max(w.weekNumber for w in working.weeks)

    for task in working.tasks:
        start = min(max(task.startWeek, 1), max_week)
        end = min(max(task.endWeek, 1), max_week)
        task.startWeek = start
        task.endWeek = max(start, end)
    for checkpoint in working.checkpoints:
        checkpoint.weekNumber = min(max(checkpoint.weekNumber, 1), max_week)


def _drop_orphan_deliverables(working: ExecutionPlan, reported_ids: List[str]) -> None:
    """Remove reported deliverables that no week schedules."""
    if not reported_ids:
        return
    scheduled = {did for w in working.weeks for did in w.deliverableIds}
    drop = {d for d in reported_ids if d not in scheduled}
    if drop:
        working.deliverables = [d for d in working.deliverables if d.id not in drop]


# ── the two additive exceptions ────────────────────────────────────────────

def _last_week(working: ExecutionPlan) -> Optional[PlanWeek]:
    if not working.weeks:
        return None
    return max(working.weeks, key=lambda w: w.weekNumber)


def _planned_hours_by_role(working: ExecutionPlan, week_number: int) -> Dict[str, float]:
    planned: Dict[str, float] = {}
    for task in working.tasks:
        if not task.startWeek <= week_number <= task.endWeek:
            continue
        span = max(1, task.endWeek - task.startWeek + 1)
        planned[task.ownerRoleId] = planned.get(task.ownerRoleId, 0.0) + task.estimateHours / span
    return planned


def _owner_role_with_headroom(working: ExecutionPlan, week_number: int) -> str:
    """Existing role with the most free capacity in ``week_number``.

    Attribution only: it picks between roles the plan already declares so a
    covering task does not push a role over capacity. Ties break on roleId.
    """
    planned = _planned_hours_by_role(working, week_number)

    def headroom(role_id: str, capacity: Optional[float]) -> float:
        if capacity is None or capacity <= 0:
            return 0.0
        return capacity - planned.get(role_id, 0.0)

    ranked = sorted(
        working.teamCapacity,
        key=lambda c: (-headroom(c.roleId, c.hoursPerWeek), c.roleId),
    )
    return ranked[0].roleId


def _add_covering_tasks(working: ExecutionPlan) -> None:
    """Give every scope module at least one implementing task (traceability).

    Mirrors the deterministic baseline's covering task: ``task-cover-N``, hours
    from the complexity table, acceptance criterion phrased from the module's
    own name. Skipped entirely when the plan has no week, workstream, or role to
    hang the task on — repair will not invent those.
    """
    covered = {t.moduleId for t in working.tasks}
    missing = [m for m in working.scopeModules if m.id not in covered]
    week = _last_week(working)
    if not missing or week is None or not working.workstreams or not working.teamCapacity:
        return

    workstream_id = working.workstreams[0].id
    checkpoints_by_id = {c.id: c for c in working.checkpoints}
    used_ids = {t.id for t in working.tasks}
    sequence = 0

    for module in missing:
        sequence += 1
        task_id = f"task-cover-{sequence}"
        while task_id in used_ids:
            sequence += 1
            task_id = f"task-cover-{sequence}"
        used_ids.add(task_id)

        hours = _COMPLEXITY_HOURS.get(module.complexity, _DEFAULT_COMPLEXITY_HOURS)
        working.tasks.append(
            PlanTask(
                id=task_id,
                title=f"Implement {module.name}",
                description=f"Implement scope module '{module.name}'.",
                moduleId=module.id,
                workstreamId=workstream_id,
                ownerRoleId=_owner_role_with_headroom(working, week.weekNumber),
                estimateHours=hours,
                estimateBasis=f"{module.complexity} complexity → {hours:g}h baseline",
                startWeek=week.weekNumber,
                endWeek=week.weekNumber,
                acceptanceCriteria=[f"'{module.name}' meets its acceptance criteria."],
                evidenceRequired=["Reviewed output"],
                status="planned",
            )
        )
        week.taskIds.append(task_id)
        if workstream_id not in week.workstreamIds:
            week.workstreamIds.append(workstream_id)

        verifier = _verifying_checkpoint(week, checkpoints_by_id)
        if verifier is not None:
            verifier.linkedTaskIds.append(task_id)


def _verifying_checkpoint(
    week: PlanWeek, checkpoints_by_id: Dict[str, Checkpoint]
) -> Optional[Checkpoint]:
    """A checkpoint in ``week`` that can verify work finishing that week.

    Non-blocking checkpoints are preferred; a blocking one is only acceptable if
    it does not sit before the work completes.
    """
    candidates = [
        checkpoints_by_id[cid]
        for cid in week.checkpointIds
        if cid in checkpoints_by_id and checkpoints_by_id[cid].weekNumber >= week.weekNumber
    ]
    for checkpoint in candidates:
        if not checkpoint.blocking:
            return checkpoint
    return candidates[0] if candidates else None


def _attach_unmitigated_high_risks(working: ExecutionPlan) -> None:
    """Link every unmitigated high-severity risk to the risk-review checkpoint."""
    task_ids = {t.id for t in working.tasks}
    checkpoint_ids = {c.id for c in working.checkpoints}
    unmitigated = [
        r
        for r in working.risks
        if r.severity >= HIGH_RISK_SEVERITY
        and not any(t in task_ids for t in r.mitigationTaskIds)
        and not any(c in checkpoint_ids for c in r.mitigationCheckpointIds)
    ]
    if not unmitigated:
        return

    checkpoint_id = _risk_review_checkpoint_id(working)
    if checkpoint_id is None:
        return
    for risk in unmitigated:
        if checkpoint_id not in risk.mitigationCheckpointIds:
            risk.mitigationCheckpointIds = [*risk.mitigationCheckpointIds, checkpoint_id]
        risk.status = "mitigated"


def _risk_review_checkpoint_id(working: ExecutionPlan) -> Optional[str]:
    """Id of the checkpoint that reviews risk, minting the baseline one if absent.

    Prefers the baseline's ``cp-risk-review``, then any existing security
    review. Only mints when a week and a role already exist, and only with the
    baseline's fixed wording — never plan-specific prose.
    """
    for checkpoint in working.checkpoints:
        if checkpoint.id == RISK_REVIEW_CHECKPOINT_ID:
            return checkpoint.id
    for checkpoint in working.checkpoints:
        if checkpoint.type == "security_review":
            return checkpoint.id

    week = _last_week(working)
    if week is None or not working.teamCapacity:
        return None
    working.checkpoints.append(
        Checkpoint(
            id=RISK_REVIEW_CHECKPOINT_ID,
            title="Risk & security review",
            type="security_review",
            weekNumber=week.weekNumber,
            ownerRoleId=working.teamCapacity[0].roleId,
            blocking=False,
            exitCriteria=["High-severity risks reviewed and mitigated."],
            evidenceRequired=["Review notes"],
            linkedTaskIds=[],
        )
    )
    week.checkpointIds.append(RISK_REVIEW_CHECKPOINT_ID)
    return RISK_REVIEW_CHECKPOINT_ID
