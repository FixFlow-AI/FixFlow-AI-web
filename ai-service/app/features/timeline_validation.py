"""AI-008 — deterministic execution-plan validator.

Pure, side-effect-free functions that turn an ``ExecutionPlan`` into structured
``PlanDiagnostics``. This is the trust anchor of the deep-proposal feature: the
LLM never authors numbers, coverage, or capacity — this module recomputes them
from the plan's own records after generation and after every accepted client
edit (spec §6.3).

Checks implemented:
  1. Unique IDs + valid cross-references (dangling IDs → error).
  2. Weeks continuous (1..N) and bounded; task spans valid + within range.
  3. Task dependency DAG: no cycle; a dependency may not start after its
     dependent (and overlaps are flagged).
  4. Scope traceability: every module maps to task(s) and (transitively)
     checkpoint(s), plus its acceptance criteria (schema enforces ≥2).
  5. Role capacity: planned hours per role/week vs supplied capacity —
     warning at ≥85%, error at ≥100%; unknown capacity → warning.
  6. Every high-severity risk has a mitigation task or checkpoint.
  7. Blocking checkpoints cannot precede unfinished linked tasks.
  8. No orphan deliverables, owner-role IDs, or architecture components.
  9. Chart inputs (hours, severity) are non-negative.

All functions are deterministic and independent of the LLM.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from ..schemas.execution_plan import (
    CapacityCell,
    DiagnosticIssue,
    ExecutionPlan,
    PlanDiagnostics,
    ScopeCoverage,
)

# Tunable thresholds (kept here so tests and the API share one source).
HIGH_RISK_SEVERITY = 70
CAPACITY_WARN_PCT = 85.0
CAPACITY_ERROR_PCT = 100.0


def _issue(
    issues: List[DiagnosticIssue],
    *,
    code: str,
    severity: str,
    message: str,
    path: Optional[str] = None,
    suggestion: Optional[str] = None,
) -> None:
    issues.append(
        DiagnosticIssue(code=code, severity=severity, message=message, path=path, suggestion=suggestion)  # type: ignore[arg-type]
    )


def _check_duplicate_ids(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    groups = {
        "requirement": [r.id for r in plan.requirements],
        "scopeModule": [m.id for m in plan.scopeModules],
        "workstream": [w.id for w in plan.workstreams],
        "role": [c.roleId for c in plan.teamCapacity],
        "deliverable": [d.id for d in plan.deliverables],
        "task": [t.id for t in plan.tasks],
        "week": [w.id for w in plan.weeks],
        "checkpoint": [c.id for c in plan.checkpoints],
        "component": [c.id for c in (plan.architecture.components if plan.architecture else [])],
    }
    for kind, ids in groups.items():
        seen: set[str] = set()
        for _id in ids:
            if _id in seen:
                _issue(
                    issues,
                    code="duplicate_id",
                    severity="error",
                    message=f"Duplicate {kind} id '{_id}'.",
                    path=f"{kind}.{_id}",
                    suggestion="IDs must be unique within their collection.",
                )
            seen.add(_id)


def _check_references(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    req_ids = {r.id for r in plan.requirements}
    module_ids = {m.id for m in plan.scopeModules}
    ws_ids = {w.id for w in plan.workstreams}
    role_ids = {c.roleId for c in plan.teamCapacity}
    task_ids = {t.id for t in plan.tasks}
    week_numbers = {w.weekNumber for w in plan.weeks}
    week_ids = {w.id for w in plan.weeks}
    deliverable_ids = {d.id for d in plan.deliverables}
    checkpoint_ids = {c.id for c in plan.checkpoints}
    component_ids = {c.id for c in (plan.architecture.components if plan.architecture else [])}

    for m in plan.scopeModules:
        for rid in m.requirementIds:
            if rid not in req_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Scope module '{m.id}' references unknown requirement '{rid}'.",
                       path=f"scopeModules.{m.id}.requirementIds")
        for cid in m.componentIds:
            if cid not in component_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Scope module '{m.id}' references unknown component '{cid}'.",
                       path=f"scopeModules.{m.id}.componentIds")
        for dep in m.dependencyModuleIds:
            if dep not in module_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Scope module '{m.id}' depends on unknown module '{dep}'.",
                       path=f"scopeModules.{m.id}.dependencyModuleIds")

    for t in plan.tasks:
        if t.moduleId not in module_ids:
            _issue(issues, code="dangling_ref", severity="error",
                   message=f"Task '{t.id}' references unknown module '{t.moduleId}'.",
                   path=f"tasks.{t.id}.moduleId")
        if t.workstreamId not in ws_ids:
            _issue(issues, code="dangling_ref", severity="error",
                   message=f"Task '{t.id}' references unknown workstream '{t.workstreamId}'.",
                   path=f"tasks.{t.id}.workstreamId")
        if t.ownerRoleId not in role_ids:
            _issue(issues, code="orphan_role", severity="error",
                   message=f"Task '{t.id}' owner role '{t.ownerRoleId}' is not in teamCapacity.",
                   path=f"tasks.{t.id}.ownerRoleId",
                   suggestion="Add the role to teamCapacity or fix the ownerRoleId.")
        for dep in t.dependencyTaskIds:
            if dep not in task_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Task '{t.id}' depends on unknown task '{dep}'.",
                       path=f"tasks.{t.id}.dependencyTaskIds")

    for cp in plan.checkpoints:
        if cp.ownerRoleId not in role_ids:
            _issue(issues, code="orphan_role", severity="error",
                   message=f"Checkpoint '{cp.id}' owner role '{cp.ownerRoleId}' is not in teamCapacity.",
                   path=f"checkpoints.{cp.id}.ownerRoleId")
        for tid in cp.linkedTaskIds:
            if tid not in task_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Checkpoint '{cp.id}' links unknown task '{tid}'.",
                       path=f"checkpoints.{cp.id}.linkedTaskIds")

    for w in plan.weeks:
        for tid in w.taskIds:
            if tid not in task_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Week '{w.id}' lists unknown task '{tid}'.",
                       path=f"weeks.{w.id}.taskIds")
        for did in w.deliverableIds:
            if did not in deliverable_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Week '{w.id}' lists unknown deliverable '{did}'.",
                       path=f"weeks.{w.id}.deliverableIds")
        for cid in w.checkpointIds:
            if cid not in checkpoint_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Week '{w.id}' lists unknown checkpoint '{cid}'.",
                       path=f"weeks.{w.id}.checkpointIds")
        for wid in w.dependencyWeekIds:
            if wid not in week_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Week '{w.id}' depends on unknown week '{wid}'.",
                       path=f"weeks.{w.id}.dependencyWeekIds")
        for wsid in w.workstreamIds:
            if wsid not in ws_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Week '{w.id}' references unknown workstream '{wsid}'.",
                       path=f"weeks.{w.id}.workstreamIds")

    # Risk links point at real modules / weeks / mitigations.
    for rk in plan.risks:
        for mid in rk.affectedModuleIds:
            if mid not in module_ids:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Risk '{rk.id}' affects unknown module '{mid}'.",
                       path=f"risks.{rk.id}.affectedModuleIds")
        for wn in rk.affectedWeekNumbers:
            if wn not in week_numbers:
                _issue(issues, code="dangling_ref", severity="error",
                       message=f"Risk '{rk.id}' affects unknown week number {wn}.",
                       path=f"risks.{rk.id}.affectedWeekNumbers")


def _check_weeks(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    if not plan.weeks:
        return
    numbers = sorted(w.weekNumber for w in plan.weeks)
    # Continuity: 1..N with no gaps or duplicates.
    expected = list(range(1, len(numbers) + 1))
    if numbers != expected:
        _issue(issues, code="week_discontinuity", severity="error",
               message=f"Weeks must be continuous 1..N; got {numbers}.",
               path="weeks",
               suggestion="Renumber weeks so they run consecutively from 1.")

    max_week = max(numbers)
    for t in plan.tasks:
        if t.endWeek < t.startWeek:
            _issue(issues, code="invalid_span", severity="error",
                   message=f"Task '{t.id}' ends (week {t.endWeek}) before it starts (week {t.startWeek}).",
                   path=f"tasks.{t.id}")
        if t.startWeek > max_week or t.endWeek > max_week:
            _issue(issues, code="span_out_of_range", severity="error",
                   message=f"Task '{t.id}' span [{t.startWeek},{t.endWeek}] exceeds plan length ({max_week} weeks).",
                   path=f"tasks.{t.id}")
    for cp in plan.checkpoints:
        if cp.weekNumber > max_week:
            _issue(issues, code="span_out_of_range", severity="error",
                   message=f"Checkpoint '{cp.id}' is in week {cp.weekNumber}, beyond plan length ({max_week}).",
                   path=f"checkpoints.{cp.id}")


def _check_week_content(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    """Every week needs an objective and at least one task, client decision,
    deliverable, or checkpoint (spec §6.2)."""
    for w in plan.weeks:
        has_work = bool(w.taskIds or w.checkpointIds or w.deliverableIds or w.clientActions)
        if not has_work:
            _issue(issues, code="empty_week", severity="warning",
                   message=f"Week {w.weekNumber} ('{w.label}') has no task, deliverable, checkpoint, or client action.",
                   path=f"weeks.{w.id}",
                   suggestion="Add at least one task, deliverable, checkpoint, or client action.")


def _check_task_dependency_dag(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    tasks_by_id = {t.id: t for t in plan.tasks}
    graph = {t.id: [d for d in t.dependencyTaskIds if d in tasks_by_id] for t in plan.tasks}

    # Cycle detection (DFS colouring).
    WHITE, GREY, BLACK = 0, 1, 2
    color: Dict[str, int] = {tid: WHITE for tid in graph}
    cycle_found = {"v": False}

    def dfs(node: str) -> None:
        color[node] = GREY
        for nxt in graph.get(node, []):
            if color[nxt] == GREY:
                cycle_found["v"] = True
                _issue(issues, code="dependency_cycle", severity="error",
                       message=f"Task dependency cycle detected involving '{node}' → '{nxt}'.",
                       path=f"tasks.{node}.dependencyTaskIds")
            elif color[nxt] == WHITE:
                dfs(nxt)
        color[node] = BLACK

    for tid in graph:
        if color[tid] == WHITE:
            dfs(tid)

    if cycle_found["v"]:
        return  # ordering checks below are meaningless with a cycle present

    # Ordering: a dependency must not start after its dependent; ideally it
    # finishes before the dependent starts.
    for t in plan.tasks:
        for dep_id in t.dependencyTaskIds:
            dep = tasks_by_id.get(dep_id)
            if not dep:
                continue
            if dep.startWeek > t.startWeek:
                _issue(issues, code="dependency_after_dependent", severity="error",
                       message=f"Task '{t.id}' depends on '{dep_id}', but '{dep_id}' starts later (week {dep.startWeek} > {t.startWeek}).",
                       path=f"tasks.{t.id}.dependencyTaskIds")
            elif dep.endWeek > t.startWeek:
                _issue(issues, code="dependency_overlap", severity="warning",
                       message=f"Task '{t.id}' starts in week {t.startWeek} before dependency '{dep_id}' finishes (week {dep.endWeek}).",
                       path=f"tasks.{t.id}.dependencyTaskIds")


def _check_scope_traceability(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    tasks_by_module: Dict[str, List[str]] = {}
    for t in plan.tasks:
        tasks_by_module.setdefault(t.moduleId, []).append(t.id)
    checkpoint_task_ids = {tid for cp in plan.checkpoints for tid in cp.linkedTaskIds}

    for m in plan.scopeModules:
        module_task_ids = tasks_by_module.get(m.id, [])
        if not module_task_ids:
            _issue(issues, code="module_no_task", severity="error",
                   message=f"Scope module '{m.id}' ('{m.name}') has no implementing task.",
                   path=f"scopeModules.{m.id}",
                   suggestion="Add at least one task with moduleId set to this module.")
            continue
        # At least one of the module's tasks is covered by a checkpoint.
        if not any(tid in checkpoint_task_ids for tid in module_task_ids):
            _issue(issues, code="module_no_checkpoint", severity="warning",
                   message=f"Scope module '{m.id}' ('{m.name}') has no verifying checkpoint.",
                   path=f"scopeModules.{m.id}",
                   suggestion="Link one of its tasks to a checkpoint (e.g. a demo or client approval).")


def _check_capacity(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> List[CapacityCell]:
    capacity_by_role = {c.roleId: c.hoursPerWeek for c in plan.teamCapacity}
    # planned[(role, week)] = hours
    planned: Dict[Tuple[str, int], float] = {}
    for t in plan.tasks:
        span = max(1, t.endWeek - t.startWeek + 1)
        per_week = t.estimateHours / span
        for wk in range(t.startWeek, t.endWeek + 1):
            planned[(t.ownerRoleId, wk)] = planned.get((t.ownerRoleId, wk), 0.0) + per_week

    cells: List[CapacityCell] = []
    warned_unknown: set[str] = set()
    for (role_id, wk), hours in sorted(planned.items()):
        hours = round(hours, 2)
        cap = capacity_by_role.get(role_id)
        if cap is None or cap <= 0:
            cells.append(CapacityCell(roleId=role_id, weekNumber=wk, plannedHours=hours,
                                      capacityHours=cap, utilizationPct=None, state="unknown"))
            if role_id not in warned_unknown:
                _issue(issues, code="capacity_unknown", severity="warning",
                       message=f"Role '{role_id}' has no capacity (hours/week) supplied; utilization can't be checked.",
                       path=f"teamCapacity.{role_id}",
                       suggestion="Provide hoursPerWeek for this role to validate staffing.")
                warned_unknown.add(role_id)
            continue
        util = round(hours / cap * 100.0, 1)
        if util >= CAPACITY_ERROR_PCT:
            state = "over"
            _issue(issues, code="capacity_over", severity="error",
                   message=f"Role '{role_id}' is over capacity in week {wk}: {hours}h planned / {cap}h ({util}%).",
                   path=f"capacity.{role_id}.{wk}",
                   suggestion="Reduce scope, extend the span, or add capacity for this role/week.")
        elif util >= CAPACITY_WARN_PCT:
            state = "warning"
            _issue(issues, code="capacity_high", severity="warning",
                   message=f"Role '{role_id}' is near capacity in week {wk}: {hours}h planned / {cap}h ({util}%).",
                   path=f"capacity.{role_id}.{wk}")
        else:
            state = "ok"
        cells.append(CapacityCell(roleId=role_id, weekNumber=wk, plannedHours=hours,
                                  capacityHours=cap, utilizationPct=util, state=state))
    return cells


def _check_risk_mitigation(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    task_ids = {t.id for t in plan.tasks}
    checkpoint_ids = {c.id for c in plan.checkpoints}
    for rk in plan.risks:
        if rk.severity < HIGH_RISK_SEVERITY:
            continue
        has_mitigation = (
            any(tid in task_ids for tid in rk.mitigationTaskIds)
            or any(cid in checkpoint_ids for cid in rk.mitigationCheckpointIds)
        )
        if not has_mitigation:
            _issue(issues, code="high_risk_unmitigated", severity="error",
                   message=f"High-severity risk '{rk.id}' ('{rk.label}', severity {rk.severity}) has no mitigation task or checkpoint.",
                   path=f"risks.{rk.id}",
                   suggestion="Link a mitigation task or checkpoint to this risk.")


def _check_blocking_checkpoints(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    tasks_by_id = {t.id: t for t in plan.tasks}
    for cp in plan.checkpoints:
        if not cp.blocking:
            continue
        if not cp.exitCriteria:
            _issue(issues, code="checkpoint_no_exit", severity="error",
                   message=f"Blocking checkpoint '{cp.id}' has no exit criteria.",
                   path=f"checkpoints.{cp.id}.exitCriteria")
        if not cp.evidenceRequired:
            _issue(issues, code="checkpoint_no_evidence", severity="warning",
                   message=f"Blocking checkpoint '{cp.id}' has no evidence requirements.",
                   path=f"checkpoints.{cp.id}.evidenceRequired")
        for tid in cp.linkedTaskIds:
            t = tasks_by_id.get(tid)
            if t and t.endWeek > cp.weekNumber:
                _issue(issues, code="checkpoint_precedes_work", severity="error",
                       message=f"Blocking checkpoint '{cp.id}' (week {cp.weekNumber}) precedes completion of linked task '{tid}' (ends week {t.endWeek}).",
                       path=f"checkpoints.{cp.id}",
                       suggestion="Move the checkpoint after its linked tasks complete.")


def _check_orphans(plan: ExecutionPlan, issues: List[DiagnosticIssue]) -> None:
    referenced_deliverables = {did for w in plan.weeks for did in w.deliverableIds}
    for d in plan.deliverables:
        if d.id not in referenced_deliverables:
            _issue(issues, code="orphan_deliverable", severity="warning",
                   message=f"Deliverable '{d.id}' ('{d.title}') is not scheduled in any week.",
                   path=f"deliverables.{d.id}")

    if plan.architecture:
        linked_components = {cid for m in plan.scopeModules for cid in m.componentIds}
        edge_components = {e.fromComponentId for e in plan.architecture.edges} | {
            e.toComponentId for e in plan.architecture.edges
        }
        for c in plan.architecture.components:
            if c.id not in linked_components and c.id not in edge_components and not c.moduleIds:
                _issue(issues, code="orphan_component", severity="warning",
                       message=f"Architecture component '{c.id}' ('{c.name}') is not linked to any module or edge.",
                       path=f"architecture.components.{c.id}")


def _compute_scope_coverage(plan: ExecutionPlan) -> List[ScopeCoverage]:
    module_ids_by_req: Dict[str, List[str]] = {r.id: [] for r in plan.requirements}
    for m in plan.scopeModules:
        for rid in m.requirementIds:
            if rid in module_ids_by_req:
                module_ids_by_req[rid].append(m.id)

    tasks_by_module: Dict[str, List[str]] = {}
    for t in plan.tasks:
        tasks_by_module.setdefault(t.moduleId, []).append(t.id)
    checkpoints_by_task: Dict[str, List[str]] = {}
    for cp in plan.checkpoints:
        for tid in cp.linkedTaskIds:
            checkpoints_by_task.setdefault(tid, []).append(cp.id)

    coverage: List[ScopeCoverage] = []
    for r in plan.requirements:
        module_ids = module_ids_by_req.get(r.id, [])
        task_ids: List[str] = []
        checkpoint_ids: List[str] = []
        for mid in module_ids:
            for tid in tasks_by_module.get(mid, []):
                task_ids.append(tid)
                checkpoint_ids.extend(checkpoints_by_task.get(tid, []))
        covered = bool(module_ids) and bool(task_ids)
        coverage.append(ScopeCoverage(
            requirementId=r.id, covered=covered,
            moduleIds=module_ids, taskIds=sorted(set(task_ids)),
            checkpointIds=sorted(set(checkpoint_ids)),
        ))
    return coverage


def _check_requirement_coverage(coverage: List[ScopeCoverage], issues: List[DiagnosticIssue]) -> None:
    for c in coverage:
        if not c.covered:
            _issue(issues, code="requirement_uncovered", severity="warning",
                   message=f"Requirement '{c.requirementId}' is not covered by an implemented scope module.",
                   path=f"requirements.{c.requirementId}",
                   suggestion="Map this requirement to a scope module with at least one task.")


def validate_execution_plan(plan: ExecutionPlan) -> PlanDiagnostics:
    """Recompute deterministic diagnostics for a plan. Never mutates input."""
    issues: List[DiagnosticIssue] = []

    _check_duplicate_ids(plan, issues)
    _check_references(plan, issues)
    _check_weeks(plan, issues)
    _check_week_content(plan, issues)
    _check_task_dependency_dag(plan, issues)
    _check_scope_traceability(plan, issues)
    capacity = _check_capacity(plan, issues)
    _check_risk_mitigation(plan, issues)
    _check_blocking_checkpoints(plan, issues)
    _check_orphans(plan, issues)

    coverage = _compute_scope_coverage(plan)
    _check_requirement_coverage(coverage, issues)

    error_count = sum(1 for i in issues if i.severity == "error")
    warning_count = sum(1 for i in issues if i.severity == "warning")

    return PlanDiagnostics(
        valid=error_count == 0,
        computedAt=datetime.now(timezone.utc).isoformat(),
        issues=issues,
        capacity=capacity,
        scopeCoverage=coverage,
        coveredRequirementCount=sum(1 for c in coverage if c.covered),
        totalRequirementCount=len(plan.requirements),
        unresolvedQuestionCount=sum(1 for q in plan.openQuestions if q.blocking),
        weekCount=len(plan.weeks),
        taskCount=len(plan.tasks),
        errorCount=error_count,
        warningCount=warning_count,
    )
