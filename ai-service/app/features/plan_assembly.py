"""AI-008 — resolve a ``PlanAuthoringDraft`` into a real ``ExecutionPlan``.

This is the trust boundary of the authoring pipeline. The draft carries *content*
keyed by author-chosen, draft-local strings (``"t1"``, ``"mod-auth"``); this
module turns that into a plan whose every cross-reference is a stable minted id
and whose every number was computed here.

Three rules govern everything below:

  * **No number is ever read from the draft.** The draft schema has none except
    ordinal week positions, and those are only ever clamped into ``1..N``.
    ``estimateHours`` comes from ``_COMPLEXITY_HOURS`` (imported from
    ``plan_generator`` so the table has exactly one home), ``risks[].severity``
    is inherited from the matched v1 ``Risk`` (already deterministically derived
    by ``brief_parser.derive_severity``), and ``teamCapacity[].hoursPerWeek``
    is sized from peak demand with the baseline's own algorithm.
  * **Unresolvable references are dropped, never guessed.** A dangling key
    disappears. When the unresolvable reference is a *required* scalar (a task's
    module, workstream, or owner role) the entity carrying it is dropped rather
    than pointed at a placeholder.
  * **Deterministic ids.** Ids are minted from ordinal position or a slug of the
    entity's own name, so assembling the same draft twice yields the same plan.

The result is validator-clean by construction for well-formed drafts: ids are
unique, references resolve, weeks run ``1..N``, spans sit inside that range,
dependency edges that contradict the schedule (or would close a cycle) are
dropped, every module keeps at least one implementing task, and high-severity
risks are attached to the risk-review checkpoint. ``plan_repair`` remains the
safety net for anything left over, and ``plan_generator`` makes the final
baseline-versus-candidate decision — a draft that resolves to almost nothing
produces a thin plan here, and it is the orchestrator's job to prefer the
baseline in that case.
"""
from __future__ import annotations

import logging
import math
import re
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from ..schemas.execution_plan import (
    ArchitectureComponent,
    ArchitectureDocument,
    ArchitectureEdge,
    Assumption,
    Checkpoint,
    ClientAction,
    Deliverable,
    ExecutionPlan,
    OpenQuestion,
    PlanRiskLink,
    PlanTask,
    PlanWeek,
    QualComplexity,
    Requirement,
    ScopeModule,
    TeamCapacity,
    Workstream,
)
from ..schemas.plan_draft import PlanAuthoringDraft
from ..schemas.proposal import Proposal, Risk
from .timeline_validation import HIGH_RISK_SEVERITY, validate_execution_plan

logger = logging.getLogger(__name__)

# The checkpoint every unmitigated high-severity risk is attached to. Same id
# the deterministic baseline uses, so `plan_repair` finds it under one name.
RISK_REVIEW_CHECKPOINT_ID = "cp-risk-review"

_DEFAULT_COMPLEXITY: QualComplexity = "Medium"


# ── Single-source-of-truth tables (lazily imported) ───────────────────────
# `plan_generator` imports this module (the orchestrator calls `assemble_plan`),
# so importing it at module scope would be circular. Importing inside the
# helpers keeps one home for the numbers instead of duplicating the tables.

def _complexity_hours() -> Dict[str, int]:
    from .plan_generator import _COMPLEXITY_HOURS

    return _COMPLEXITY_HOURS


def _capacity_floor() -> float:
    from .plan_generator import _DEFAULT_CAPACITY_FLOOR

    return float(_DEFAULT_CAPACITY_FLOOR)


def estimate_hours(complexity: QualComplexity) -> Tuple[float, str]:
    """Hours for a qualitative complexity, plus the plain-language basis.

    The basis names the complexity that produced the figure and says it is an
    estimate, which is what the surface shows instead of asserting a
    commitment (R9.6). Never consults the draft.
    """
    table = _complexity_hours()
    label = complexity if complexity in table else _DEFAULT_COMPLEXITY
    hours = float(table.get(label, table[_DEFAULT_COMPLEXITY]))
    basis = (
        f"{label} complexity \u2192 {hours:g}h baseline estimate "
        "(derived from the complexity table, not a fixed commitment)"
    )
    return hours, basis


# ── Small text / id helpers ───────────────────────────────────────────────

def _slug(text: str, fallback: str = "item") -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or fallback


def _tokens(text: str) -> Set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) >= 4}


def _norm(text: str) -> str:
    """Normalised comparison form for a draft key or a label."""
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def _text(*candidates: Optional[str]) -> str:
    """First non-blank candidate, stripped. Empty string when there is none."""
    for c in candidates:
        if isinstance(c, str) and c.strip():
            return c.strip()
    return ""


def _clean_list(values: Optional[Iterable[str]]) -> List[str]:
    """Non-blank, de-duplicated, order-preserving strings."""
    seen: Set[str] = set()
    out: List[str] = []
    for v in values or []:
        s = _text(v)
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def _mint(prefix: str, seed: str, used: Set[str]) -> str:
    """A stable, unique id of the form ``prefix-slug`` (``-2``, ``-3`` on clash)."""
    base = f"{prefix}-{_slug(seed)}"
    candidate = base
    n = 1
    while candidate in used:
        n += 1
        candidate = f"{base}-{n}"
    used.add(candidate)
    return candidate


def _resolve_many(keys: Optional[Iterable[str]], table: Dict[str, str]) -> List[str]:
    """Resolve draft keys to minted ids, dropping every key that misses."""
    out: List[str] = []
    seen: Set[str] = set()
    for k in keys or []:
        resolved = _resolve_one(k, table)
        if resolved and resolved not in seen:
            seen.add(resolved)
            out.append(resolved)
    return out


def _resolve_one(key: Optional[str], table: Dict[str, str]) -> Optional[str]:
    """Resolve a single draft key, trying its normalised form as a courtesy."""
    if not isinstance(key, str):
        return None
    if key in table:
        return table[key]
    return table.get(_norm(key))


def _register(table: Dict[str, str], key: str, minted: str) -> None:
    """Index a draft key under both its raw and normalised form."""
    if key and key not in table:
        table[key] = minted
    norm = _norm(key)
    if norm and norm not in table:
        table[norm] = minted


# ── Week ordinals ─────────────────────────────────────────────────────────

class _WeekIndex:
    """Maps the draft's ordinal week positions onto a continuous ``1..N``.

    Draft weeks are sorted by their stated number (ties broken by draft order)
    and renumbered consecutively, which is what makes the emitted plan satisfy
    the validator's week-continuity rule by construction. Any other ordinal in
    the draft (a task span, a risk's affected week) is translated through the
    same map, and clamped into ``1..N`` when it names no drafted week.
    """

    def __init__(self, draft: PlanAuthoringDraft) -> None:
        order = sorted(range(len(draft.weeks)), key=lambda i: (draft.weeks[i].weekNumber, i))
        self.count = max(1, len(order))
        self.number_by_draft_index: Dict[int, int] = {}
        self._by_stated: Dict[int, int] = {}
        for position, index in enumerate(order):
            number = position + 1
            self.number_by_draft_index[index] = number
            self._by_stated.setdefault(draft.weeks[index].weekNumber, number)

    def translate(self, stated: int) -> int:
        mapped = self._by_stated.get(stated)
        if mapped is not None:
            return mapped
        return _clamp(stated, 1, self.count)


# ── Risk severity inheritance ─────────────────────────────────────────────

def _match_v1_risk(label: str, category: str, proposal: Proposal) -> Optional[Risk]:
    """The v1 risk this drafted risk link is about, or ``None``.

    Exact (normalised) label match first; otherwise the v1 risk sharing the most
    significant words with the drafted label, ties broken by proposal order so
    the match is deterministic.
    """
    target = _norm(label)
    if not target:
        return None
    for risk in proposal.risks:
        if _norm(risk.label) == target:
            return risk

    label_tokens = _tokens(label) | _tokens(category)
    best: Optional[Risk] = None
    best_score = 0
    for risk in proposal.risks:
        score = len(label_tokens & (_tokens(risk.label) | _tokens(risk.category)))
        if score > best_score:
            best, best_score = risk, score
    return best


def _severity_for(label: str, category: str, proposal: Proposal) -> Tuple[int, str]:
    """Severity for a drafted risk link — inherited, never authored.

    Returns the severity plus the v1 category it should carry. A matched v1 risk
    hands over the severity it was already given deterministically; with no
    match the same derivation runs over the qualitative signals the draft does
    supply (its category, with no mitigation recorded on the plan link).
    """
    matched = _match_v1_risk(label, category, proposal)
    if matched is not None:
        return matched.severity, _text(category, matched.category, "uncategorised")

    from .brief_parser import derive_severity  # deterministic severity path

    resolved_category = _text(category, "uncategorised")
    return derive_severity(resolved_category, ""), resolved_category


# ── Dependency edges ──────────────────────────────────────────────────────

def _reaches(graph: Dict[str, List[str]], start: str, target: str) -> bool:
    """Is ``target`` reachable from ``start`` along dependency edges?"""
    stack = [start]
    seen: Set[str] = set()
    while stack:
        node = stack.pop()
        if node == target:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(graph.get(node, ()))
    return False


def _acyclic_dependencies(
    tasks: List[PlanTask],
    wanted: Dict[str, List[str]],
) -> None:
    """Attach dependency edges in place, keeping only the sound ones.

    An edge is dropped when the dependency starts after its dependent (the
    schedule contradicts the stated order) or when accepting it would close a
    cycle. Tasks are processed in emission order and each task's dependencies in
    draft order, so the surviving edge set is deterministic.
    """
    by_id = {t.id: t for t in tasks}
    graph: Dict[str, List[str]] = {t.id: [] for t in tasks}
    for task in tasks:
        for dep_id in wanted.get(task.id, []):
            dep = by_id.get(dep_id)
            if dep is None or dep_id == task.id:
                continue
            if dep.startWeek > task.startWeek:
                continue  # dependency cannot start after the work it unblocks
            if _reaches(graph, dep_id, task.id):
                continue  # would close a dependency cycle
            graph[task.id].append(dep_id)
    for task in tasks:
        task.dependencyTaskIds = graph[task.id]


# ── Capacity sizing (baseline algorithm) ──────────────────────────────────

def _size_capacity(
    tasks: Sequence[PlanTask],
    roles: Sequence[Tuple[str, str]],
    baseline: ExecutionPlan,
) -> List[TeamCapacity]:
    """Peak-demand sizing, mirroring ``derive_execution_plan_from_proposal``.

    Each role is sized to its busiest week plus an hour of headroom, floored at
    the baseline's default, so the validator never reports the authored plan as
    over capacity. A role the baseline already sized is never given less than
    the baseline gave it.
    """
    demand: Dict[Tuple[str, int], float] = {}
    for task in tasks:
        span = max(1, task.endWeek - task.startWeek + 1)
        per_week = task.estimateHours / span
        for week in range(task.startWeek, task.endWeek + 1):
            key = (task.ownerRoleId, week)
            demand[key] = demand.get(key, 0.0) + per_week

    peak: Dict[str, float] = {}
    for (role_id, _week), hours in demand.items():
        peak[role_id] = max(peak.get(role_id, 0.0), hours)

    inherited = {c.roleId: c.hoursPerWeek for c in baseline.teamCapacity if c.hoursPerWeek}
    floor = _capacity_floor()

    out: List[TeamCapacity] = []
    for role_id, role_name in roles:
        capacity = max(floor, float(math.ceil(peak.get(role_id, 0.0) + 1)))
        baseline_capacity = inherited.get(role_id)
        if baseline_capacity:
            capacity = max(capacity, float(baseline_capacity))
        out.append(TeamCapacity(roleId=role_id, roleName=role_name, hoursPerWeek=capacity))
    return out


# ── Assembly ──────────────────────────────────────────────────────────────

def assemble_plan(
    draft: PlanAuthoringDraft,
    proposal: Proposal,
    *,
    baseline: ExecutionPlan,
) -> ExecutionPlan:
    """Resolve an authoring draft into a stable, numerically deterministic plan.

    ``baseline`` is the deterministic plan derived from ``proposal``; it supplies
    the plan-level defaults (start date) and the capacity figures already sized
    for its own roles. Nothing numeric is read from ``draft``.
    """
    weeks_index = _WeekIndex(draft)
    used_ids: Set[str] = set()

    # ── Requirements ──
    requirement_ids: Dict[str, str] = {}
    requirements: List[Requirement] = []
    for req in draft.requirements:
        statement = _text(req.statement)
        if not statement or _resolve_one(req.key, requirement_ids) is not None:
            continue  # blank statement, or a key already claimed
        rid = f"req-{len(requirements) + 1}"
        used_ids.add(rid)
        _register(requirement_ids, req.key, rid)
        requirements.append(
            Requirement(id=rid, statement=statement, source=req.source, priority=req.priority)
        )

    # ── Planning context ──
    assumptions = [
        Assumption(
            id=f"asm-{i + 1}",
            statement=_text(a.statement),
            impact=a.impact,
            category=a.category,
        )
        for i, a in enumerate(draft.planningAssumptions)
        if _text(a.statement)
    ]
    open_questions = [
        OpenQuestion(
            id=f"oq-{i + 1}",
            question=_text(q.question),
            blocking=q.blocking,
            relatedRequirementIds=_resolve_many(q.relatedRequirementIds, requirement_ids),
        )
        for i, q in enumerate(draft.openQuestions)
        if _text(q.question)
    ]

    # ── Workstreams and roles ──
    workstream_ids: Dict[str, str] = {}
    workstreams: List[Workstream] = []
    for ws in draft.workstreams:
        name = _text(ws.name, ws.id)
        if not name or _resolve_one(ws.id, workstream_ids) is not None:
            continue
        wsid = _mint("ws", name, used_ids)
        _register(workstream_ids, ws.id, wsid)
        _register(workstream_ids, name, wsid)
        workstreams.append(Workstream(id=wsid, name=name, description=ws.description))

    role_ids: Dict[str, str] = {}
    roles: List[Tuple[str, str]] = []  # (roleId, roleName), emission order
    for raw_role in draft.roles:
        name = _text(raw_role)
        if not name or _resolve_one(name, role_ids) is not None:
            continue
        role_id = _mint("role", name, used_ids)
        _register(role_ids, raw_role, role_id)
        _register(role_ids, name, role_id)
        roles.append((role_id, name))

    if not roles:
        # The draft named no usable role: keep the baseline's roles so owners
        # still resolve. Draft owner keys will not match, so authored tasks are
        # dropped and the module-coverage pass below re-creates the work.
        for capacity in baseline.teamCapacity:
            role_id = capacity.roleId
            used_ids.add(role_id)
            _register(role_ids, capacity.roleName, role_id)
            roles.append((role_id, capacity.roleName))

    default_role_id = roles[0][0] if roles else None
    default_workstream_id = workstreams[0].id if workstreams else None

    # ── Architecture components ──
    component_ids: Dict[str, str] = {}
    kept_components: List[Tuple[str, object]] = []  # (mintedId, draft component)
    for comp in draft.components:
        name = _text(comp.name)
        interfaces = _clean_list(comp.interfaces)
        responsibility = _text(comp.responsibility)
        data_boundary = _text(comp.dataBoundary)
        error_handling = _text(comp.errorHandling)
        # A component that cannot be described completely is dropped, not padded.
        if not (name and interfaces and responsibility and data_boundary and error_handling):
            continue
        if _resolve_one(comp.key, component_ids) is not None:
            continue
        cid = _mint("cmp", name, used_ids)
        _register(component_ids, comp.key, cid)
        kept_components.append((cid, comp))

    # ── Scope modules (need requirement + component ids) ──
    module_ids: Dict[str, str] = {}
    modules: List[ScopeModule] = []
    module_complexity: Dict[str, QualComplexity] = {}
    for mod in draft.scopeModules:
        name = _text(mod.name)
        requirement_refs = _resolve_many(mod.requirementKeys, requirement_ids)
        out_of_scope = _clean_list(mod.outOfScope)
        criteria = _clean_list(mod.acceptanceCriteria)
        # requirementIds (>=1), outOfScope (>=1), acceptanceCriteria (>=2) are
        # contract minimums; a module that loses them is dropped whole.
        if not (name and requirement_refs and out_of_scope and len(criteria) >= 2):
            continue
        if _resolve_one(mod.key, module_ids) is not None:
            continue
        mid = f"mod-{len(modules) + 1}"
        used_ids.add(mid)
        _register(module_ids, mod.key, mid)
        module_complexity[mid] = mod.complexity
        modules.append(
            ScopeModule(
                id=mid,
                name=name,
                businessObjective=_text(mod.businessObjective, f"Deliver {name}."),
                actors=_clean_list(mod.actors),
                inScope=_clean_list(mod.inScope),
                outOfScope=out_of_scope,
                acceptanceCriteria=criteria,
                requirementIds=requirement_refs,
                dependencyModuleIds=[],
                assumptionIds=[],
                openQuestionIds=[],
                dataEntities=_clean_list(mod.dataEntities),
                integrations=_clean_list(mod.integrations),
                securityControls=_clean_list(mod.securityControls),
                componentIds=_resolve_many(mod.componentKeys, component_ids),
                complexity=mod.complexity,
            )
        )

    surviving_module_ids = {m.id for m in modules}
    surviving_component_ids = {cid for cid, _ in kept_components}

    components = [
        ArchitectureComponent(
            id=cid,
            name=_text(comp.name),
            responsibility=_text(comp.responsibility),
            moduleIds=[
                mid
                for mid in _resolve_many(comp.moduleKeys, module_ids)
                if mid in surviving_module_ids
            ],
            runtime=comp.runtime,
            technology=comp.technology,
            dataBoundary=_text(comp.dataBoundary),
            interfaces=_clean_list(comp.interfaces),
            errorHandling=_text(comp.errorHandling),
            observability=comp.observability,
            security=comp.security,
            scaling=comp.scaling,
            dependencyComponentIds=[
                dep
                for dep in _resolve_many(comp.dependencyComponentKeys, component_ids)
                if dep != cid
            ],
            failureImpact=comp.failureImpact,
            decisions=_clean_list(comp.decisions),
            openDecisions=_clean_list(comp.openDecisions),
        )
        for cid, comp in kept_components
    ]

    edges: List[ArchitectureEdge] = []
    seen_edges: Set[Tuple[str, str, str]] = set()
    for edge in draft.edges:
        src = _resolve_one(edge.fromKey, component_ids)
        dst = _resolve_one(edge.toKey, component_ids)
        if not src or not dst or src == dst:
            continue
        if src not in surviving_component_ids or dst not in surviving_component_ids:
            continue
        signature = (src, dst, edge.kind)
        if signature in seen_edges:
            continue
        seen_edges.add(signature)
        edges.append(
            ArchitectureEdge(fromComponentId=src, toComponentId=dst, label=edge.label, kind=edge.kind)
        )

    architecture: Optional[ArchitectureDocument] = None
    if components:
        architecture = ArchitectureDocument(
            summary=_text(
                draft.summary,
                proposal.project_summary,
                "Architecture derived from the authored plan scope.",
            ),
            components=components,
            edges=edges,
        )

    # ── Tasks ──
    task_ids: Dict[str, str] = {}
    tasks: List[PlanTask] = []
    wanted_dependencies: Dict[str, List[str]] = {}
    for dt in draft.tasks:
        title = _text(dt.title)
        criteria = _clean_list(dt.acceptanceCriteria)
        module_id = _resolve_one(dt.moduleKey, module_ids)
        workstream_id = _resolve_one(dt.workstreamKey, workstream_ids)
        owner_role_id = _resolve_one(dt.ownerRoleKey, role_ids)
        # Required references are dropped by dropping the task that carries an
        # unresolvable one — never by pointing it at a stand-in.
        if not (title and criteria and module_id and workstream_id and owner_role_id):
            continue
        if module_id not in surviving_module_ids:
            continue
        if _resolve_one(dt.key, task_ids) is not None:
            continue
        start = weeks_index.translate(dt.startWeek)
        end = weeks_index.translate(dt.endWeek)
        if end < start:
            end = start
        hours, basis = estimate_hours(dt.complexity)
        tid = f"task-{len(tasks) + 1}"
        used_ids.add(tid)
        _register(task_ids, dt.key, tid)
        wanted_dependencies[tid] = list(dt.dependencyTaskKeys or [])
        tasks.append(
            PlanTask(
                id=tid,
                title=title,
                description=_text(dt.description, title),
                moduleId=module_id,
                workstreamId=workstream_id,
                ownerRoleId=owner_role_id,
                estimateHours=hours,
                estimateBasis=basis,
                startWeek=start,
                endWeek=end,
                dependencyTaskIds=[],
                acceptanceCriteria=criteria,
                evidenceRequired=_clean_list(dt.evidenceRequired),
                status="planned",
                priority=dt.priority,
            )
        )

    # Dependencies resolve only against tasks that survived.
    resolved_dependencies = {
        tid: _resolve_many(keys, task_ids) for tid, keys in wanted_dependencies.items()
    }
    _acyclic_dependencies(tasks, resolved_dependencies)

    # ── Module coverage: every module keeps an implementing task ──
    covered = {t.moduleId for t in tasks}
    last_week = weeks_index.count
    cover_seq = 0
    if default_role_id and default_workstream_id:
        for module in modules:
            if module.id in covered:
                continue
            hours, basis = estimate_hours(module_complexity.get(module.id, _DEFAULT_COMPLEXITY))
            cover_seq += 1
            tid = f"task-cover-{cover_seq}"
            used_ids.add(tid)
            tasks.append(
                PlanTask(
                    id=tid,
                    title=f"Implement {module.name}",
                    description=f"Implement scope module '{module.name}'.",
                    moduleId=module.id,
                    workstreamId=default_workstream_id,
                    ownerRoleId=default_role_id,
                    estimateHours=hours,
                    estimateBasis=basis,
                    startWeek=last_week,
                    endWeek=last_week,
                    acceptanceCriteria=[f"'{module.name}' meets its acceptance criteria."],
                    evidenceRequired=["Reviewed output"],
                    status="planned",
                    priority="should",
                )
            )

    tasks_by_id = {t.id: t for t in tasks}

    # ── Checkpoints ──
    checkpoint_ids: Dict[str, str] = {}
    checkpoints: List[Checkpoint] = []
    for dc in draft.checkpoints:
        title = _text(dc.title)
        owner_role_id = _resolve_one(dc.ownerRoleKey, role_ids)
        if not title or not owner_role_id:
            continue
        if _resolve_one(dc.key, checkpoint_ids) is not None:
            continue
        linked = [tid for tid in _resolve_many(dc.linkedTaskKeys, task_ids) if tid in tasks_by_id]
        week_number = weeks_index.translate(dc.weekNumber)
        exit_criteria = _clean_list(dc.exitCriteria)
        # A blocking gate needs exit criteria and must not precede the work it
        # gates. Missing criteria makes it advisory rather than inventing one.
        blocking = dc.blocking and bool(exit_criteria)
        if blocking and linked:
            week_number = max(week_number, max(tasks_by_id[tid].endWeek for tid in linked))
            week_number = _clamp(week_number, 1, weeks_index.count)
        cid = f"cp-{len(checkpoints) + 1}"
        used_ids.add(cid)
        _register(checkpoint_ids, dc.key, cid)
        checkpoints.append(
            Checkpoint(
                id=cid,
                title=title,
                type=dc.type,
                weekNumber=week_number,
                ownerRoleId=owner_role_id,
                blocking=blocking,
                exitCriteria=exit_criteria,
                evidenceRequired=_clean_list(dc.evidenceRequired),
                linkedTaskIds=linked,
                status="planned",
            )
        )

    # The risk-review gate always exists, so a high-severity risk always has
    # somewhere to attach (and `plan_repair` finds it under one stable id).
    if default_role_id:
        used_ids.add(RISK_REVIEW_CHECKPOINT_ID)
        checkpoints.append(
            Checkpoint(
                id=RISK_REVIEW_CHECKPOINT_ID,
                title="Risk & security review",
                type="security_review",
                weekNumber=weeks_index.count,
                ownerRoleId=default_role_id,
                blocking=False,
                exitCriteria=["High-severity risks reviewed and mitigated."],
                evidenceRequired=["Review notes"],
                linkedTaskIds=[],
                status="planned",
            )
        )
    checkpoint_id_set = {c.id for c in checkpoints}

    # ── Deliverables and client actions, grouped by normalised week ──
    deliverables: List[Deliverable] = []
    deliverable_ids_by_week: Dict[int, List[str]] = {}
    client_actions_by_week: Dict[int, List[ClientAction]] = {}
    action_seq = 0
    for index, dw in enumerate(draft.weeks):
        number = weeks_index.number_by_draft_index.get(index)
        if number is None:
            continue
        for title in _clean_list(dw.deliverableTitles):
            did = f"del-{len(deliverables) + 1}"
            used_ids.add(did)
            deliverables.append(Deliverable(id=did, title=title))
            deliverable_ids_by_week.setdefault(number, []).append(did)
        for action in dw.clientActions:
            description = _text(action.description)
            if not description:
                continue
            action_seq += 1
            client_actions_by_week.setdefault(number, []).append(
                ClientAction(
                    id=f"ca-{action_seq}",
                    description=description,
                    weekNumber=number,
                    required=action.required,
                )
            )

    # ── Weeks ──
    label_by_number: Dict[int, Tuple[str, str]] = {}
    for index, dw in enumerate(draft.weeks):
        number = weeks_index.number_by_draft_index.get(index)
        if number is None or number in label_by_number:
            continue
        label = _text(dw.label, f"Week {number}")
        label_by_number[number] = (label, _text(dw.objective, label))

    checkpoints_by_week: Dict[int, List[str]] = {}
    for cp in checkpoints:
        checkpoints_by_week.setdefault(cp.weekNumber, []).append(cp.id)

    weeks: List[PlanWeek] = []
    for number in range(1, weeks_index.count + 1):
        label, objective = label_by_number.get(number, (f"Week {number}", f"Deliver week {number} scope."))
        week_task_ids = [t.id for t in tasks if t.startWeek <= number <= t.endWeek]
        workstream_ids_in_week: List[str] = []
        for tid in week_task_ids:
            wsid = tasks_by_id[tid].workstreamId
            if wsid not in workstream_ids_in_week:
                workstream_ids_in_week.append(wsid)
        weeks.append(
            PlanWeek(
                id=f"wk-{number}",
                weekNumber=number,
                label=label,
                objective=objective,
                workstreamIds=workstream_ids_in_week,
                taskIds=week_task_ids,
                deliverableIds=deliverable_ids_by_week.get(number, []),
                checkpointIds=checkpoints_by_week.get(number, []),
                dependencyWeekIds=[],
                clientActions=client_actions_by_week.get(number, []),
            )
        )
    week_numbers = {w.weekNumber for w in weeks}

    # ── Risks: severity inherited, references resolved ──
    risks: List[PlanRiskLink] = []
    for dr in draft.risks:
        label = _text(dr.label)
        if not label:
            continue
        severity, category = _severity_for(label, dr.category, proposal)
        mitigation_task_ids = [
            tid for tid in _resolve_many(dr.mitigationTaskKeys, task_ids) if tid in tasks_by_id
        ]
        mitigation_checkpoint_ids = [
            cid
            for cid in _resolve_many(dr.mitigationCheckpointKeys, checkpoint_ids)
            if cid in checkpoint_id_set
        ]
        if (
            severity >= HIGH_RISK_SEVERITY
            and not mitigation_task_ids
            and not mitigation_checkpoint_ids
            and RISK_REVIEW_CHECKPOINT_ID in checkpoint_id_set
        ):
            mitigation_checkpoint_ids = [RISK_REVIEW_CHECKPOINT_ID]
        affected_weeks = sorted(
            {
                number
                for number in (weeks_index.translate(w) for w in dr.affectedWeekNumbers)
                if number in week_numbers
            }
        )
        mitigated = bool(mitigation_task_ids or mitigation_checkpoint_ids)
        risks.append(
            PlanRiskLink(
                id=f"risk-{len(risks) + 1}",
                label=label,
                severity=severity,
                category=category,
                affectedModuleIds=[
                    mid
                    for mid in _resolve_many(dr.affectedModuleKeys, module_ids)
                    if mid in surviving_module_ids
                ],
                affectedWeekNumbers=affected_weeks,
                mitigationTaskIds=mitigation_task_ids,
                mitigationCheckpointIds=mitigation_checkpoint_ids,
                status="mitigated" if mitigated else "open",
            )
        )

    plan = ExecutionPlan(
        schemaVersion=2,
        projectStartDate=baseline.projectStartDate,
        degraded=False,
        degradedReason=None,
        planningAssumptions=assumptions,
        openQuestions=open_questions,
        requirements=requirements,
        scopeModules=modules,
        architecture=architecture,
        workstreams=workstreams,
        teamCapacity=_size_capacity(tasks, roles, baseline),
        deliverables=deliverables,
        tasks=tasks,
        weeks=weeks,
        checkpoints=checkpoints,
        risks=risks,
    )
    plan.diagnostics = validate_execution_plan(plan)
    return plan
