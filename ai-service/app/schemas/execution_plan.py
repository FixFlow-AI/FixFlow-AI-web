"""AI-008 — v2 Execution Plan schema (deep proposal / editable timeline).

This is the versioned source of truth for a deep, decision-ready project plan:
scope modules with acceptance criteria, a component-level architecture, and a
true week-by-week execution plan with tasks, checkpoints, capacity, and
deterministic diagnostics.

Design rules (see docs/specifications/ai_features/ai_008_*):
  * Every cross-reference is a stable ID, never a title string, so renaming a
    task can never break a dependency or a chart.
  * The LLM emits qualitative content and *priority/complexity* only. Hours,
    capacity %, coverage, risk severity, and chart totals are computed or
    validated by deterministic code (``timeline_validation.py``) — never trusted
    from the model. ``diagnostics`` is therefore optional on input and always
    recomputed server-side.
  * ``ExecutionPlan`` is attached to ``Proposal`` as an OPTIONAL field so every
    existing v1 proposal keeps parsing unchanged.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["must", "should", "could"]
QualComplexity = Literal["High", "Medium", "Low"]
TaskStatus = Literal["planned", "in_progress", "blocked", "done", "backlog"]
CheckpointType = Literal[
    "design_review", "demo", "client_approval", "security_review", "release_readiness"
]
CheckpointStatus = Literal["planned", "ready_for_review", "approved", "changes_requested"]


# ── Planning context ──────────────────────────────────────────────────────

class Assumption(BaseModel):
    id: str = Field(min_length=1)
    statement: str = Field(min_length=1)
    impact: Optional[str] = None
    category: Optional[str] = None


class OpenQuestion(BaseModel):
    id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    blocking: bool = False
    relatedRequirementIds: List[str] = Field(default_factory=list)


class Requirement(BaseModel):
    id: str = Field(min_length=1)
    statement: str = Field(min_length=1)
    source: Literal["brief", "discovery", "client", "inferred"] = "brief"
    priority: Priority = "should"


# ── Scope ─────────────────────────────────────────────────────────────────

class ScopeModule(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    businessObjective: str = Field(min_length=1)
    actors: List[str] = Field(default_factory=list)
    inScope: List[str] = Field(default_factory=list)
    # An explicit boundary is mandatory for a non-degraded module.
    outOfScope: List[str] = Field(min_length=1)
    # At least two verifiable acceptance criteria (spec §6.2).
    acceptanceCriteria: List[str] = Field(min_length=2)
    # Must trace back to one or more requirements.
    requirementIds: List[str] = Field(min_length=1)
    dependencyModuleIds: List[str] = Field(default_factory=list)
    assumptionIds: List[str] = Field(default_factory=list)
    openQuestionIds: List[str] = Field(default_factory=list)
    dataEntities: List[str] = Field(default_factory=list)
    integrations: List[str] = Field(default_factory=list)
    securityControls: List[str] = Field(default_factory=list)
    componentIds: List[str] = Field(default_factory=list)
    complexity: QualComplexity = "Medium"


# ── Architecture ──────────────────────────────────────────────────────────

class ArchitectureComponent(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    responsibility: str = Field(min_length=1)
    moduleIds: List[str] = Field(default_factory=list)
    runtime: Optional[str] = None
    technology: Optional[str] = None
    dataBoundary: str = Field(min_length=1)
    interfaces: List[str] = Field(min_length=1)
    errorHandling: str = Field(min_length=1)
    observability: Optional[str] = None
    security: Optional[str] = None
    scaling: Optional[str] = None
    dependencyComponentIds: List[str] = Field(default_factory=list)
    failureImpact: Optional[str] = None
    decisions: List[str] = Field(default_factory=list)
    openDecisions: List[str] = Field(default_factory=list)


class ArchitectureEdge(BaseModel):
    fromComponentId: str = Field(min_length=1)
    toComponentId: str = Field(min_length=1)
    label: Optional[str] = None
    kind: Optional[Literal["sync", "async", "data", "event"]] = None


class ArchitectureDocument(BaseModel):
    summary: str = Field(min_length=1)
    components: List[ArchitectureComponent] = Field(default_factory=list)
    edges: List[ArchitectureEdge] = Field(default_factory=list)


# ── Capacity & workstreams ─────────────────────────────────────────────────

class Workstream(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: Optional[str] = None


class TeamCapacity(BaseModel):
    """A required role and its capacity. ``hoursPerWeek is None`` means the
    client has not supplied availability yet — the validator warns rather than
    inventing staffing (spec §13)."""

    roleId: str = Field(min_length=1)
    roleName: str = Field(min_length=1)
    hoursPerWeek: Optional[float] = Field(default=None, ge=0)


class Deliverable(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    moduleId: Optional[str] = None


# ── Weekly execution plan ──────────────────────────────────────────────────

class ClientAction(BaseModel):
    id: str = Field(min_length=1)
    description: str = Field(min_length=1)
    weekNumber: int = Field(ge=1)
    required: bool = False


class PlanTask(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    moduleId: str = Field(min_length=1)
    workstreamId: str = Field(min_length=1)
    ownerRoleId: str = Field(min_length=1)
    estimateHours: float = Field(gt=0, le=2000)
    # Plain-language reason the hours above were derived, e.g. "Medium
    # complexity → 16h baseline". Optional so plans stored before this field
    # existed keep parsing unchanged.
    estimateBasis: Optional[str] = None
    startWeek: int = Field(ge=1)
    endWeek: int = Field(ge=1)
    dependencyTaskIds: List[str] = Field(default_factory=list)
    acceptanceCriteria: List[str] = Field(min_length=1)
    evidenceRequired: List[str] = Field(default_factory=list)
    status: TaskStatus = "planned"
    priority: Priority = "should"


class Checkpoint(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    type: CheckpointType
    weekNumber: int = Field(ge=1)
    ownerRoleId: str = Field(min_length=1)
    blocking: bool = False
    exitCriteria: List[str] = Field(default_factory=list)
    evidenceRequired: List[str] = Field(default_factory=list)
    linkedTaskIds: List[str] = Field(default_factory=list)
    status: CheckpointStatus = "planned"


class PlanWeek(BaseModel):
    id: str = Field(min_length=1)
    weekNumber: int = Field(ge=1)
    label: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    workstreamIds: List[str] = Field(default_factory=list)
    taskIds: List[str] = Field(default_factory=list)
    deliverableIds: List[str] = Field(default_factory=list)
    checkpointIds: List[str] = Field(default_factory=list)
    dependencyWeekIds: List[str] = Field(default_factory=list)
    clientActions: List[ClientAction] = Field(default_factory=list)


class PlanRiskLink(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    # Deterministic severity (0-100), derived by code — mirrors AI-001 Risk.
    severity: int = Field(ge=0, le=100)
    category: str = Field(min_length=1)
    affectedModuleIds: List[str] = Field(default_factory=list)
    affectedWeekNumbers: List[int] = Field(default_factory=list)
    mitigationTaskIds: List[str] = Field(default_factory=list)
    mitigationCheckpointIds: List[str] = Field(default_factory=list)
    status: Literal["open", "mitigated", "accepted"] = "open"


# ── Deterministic diagnostics (never LLM-authored) ─────────────────────────

DiagnosticSeverity = Literal["error", "warning", "info"]


class DiagnosticIssue(BaseModel):
    code: str
    severity: DiagnosticSeverity
    message: str
    path: Optional[str] = None
    suggestion: Optional[str] = None


class CapacityCell(BaseModel):
    roleId: str
    weekNumber: int
    plannedHours: float
    capacityHours: Optional[float] = None
    utilizationPct: Optional[float] = None
    state: Literal["ok", "warning", "over", "unknown"] = "unknown"


class ScopeCoverage(BaseModel):
    requirementId: str
    covered: bool
    moduleIds: List[str] = Field(default_factory=list)
    taskIds: List[str] = Field(default_factory=list)
    checkpointIds: List[str] = Field(default_factory=list)


class PlanDiagnostics(BaseModel):
    valid: bool = True
    computedAt: Optional[str] = None
    issues: List[DiagnosticIssue] = Field(default_factory=list)
    capacity: List[CapacityCell] = Field(default_factory=list)
    scopeCoverage: List[ScopeCoverage] = Field(default_factory=list)
    # Longest dependency chain by summed estimateHours, computed server-side.
    # Empty when the graph contains a cycle or has not been computed.
    criticalPathTaskIds: List[str] = Field(default_factory=list)
    coveredRequirementCount: int = 0
    totalRequirementCount: int = 0
    unresolvedQuestionCount: int = 0
    weekCount: int = 0
    taskCount: int = 0
    errorCount: int = 0
    warningCount: int = 0


# ── The plan envelope ──────────────────────────────────────────────────────

class ExecutionPlan(BaseModel):
    schemaVersion: Literal[2] = 2
    # Absent means the plan uses relative Week 1..N (spec default decision).
    projectStartDate: Optional[str] = None
    degraded: bool = False
    degradedReason: Optional[str] = None
    planningAssumptions: List[Assumption] = Field(default_factory=list)
    openQuestions: List[OpenQuestion] = Field(default_factory=list)
    requirements: List[Requirement] = Field(default_factory=list)
    scopeModules: List[ScopeModule] = Field(default_factory=list)
    architecture: Optional[ArchitectureDocument] = None
    workstreams: List[Workstream] = Field(default_factory=list)
    teamCapacity: List[TeamCapacity] = Field(default_factory=list)
    deliverables: List[Deliverable] = Field(default_factory=list)
    tasks: List[PlanTask] = Field(default_factory=list)
    weeks: List[PlanWeek] = Field(default_factory=list)
    checkpoints: List[Checkpoint] = Field(default_factory=list)
    risks: List[PlanRiskLink] = Field(default_factory=list)
    # Deterministic, recomputed server-side; never trusted from the LLM.
    diagnostics: Optional[PlanDiagnostics] = None
    # How this plan was produced. Absent on plans stored before this field
    # existed, so it stays optional.
    authoringSource: Optional[Literal["authored", "repaired", "derived", "degraded"]] = None
