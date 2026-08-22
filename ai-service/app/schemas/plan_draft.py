"""Plan authoring draft — the LLM-facing contract for a deep execution plan.

Used as the Gemini ``response_schema`` for the single authoring pass in
``plan_authoring.py``. The draft is then resolved into a real
``ExecutionPlan`` by ``plan_assembly.py``.

Two design rules make this module what it is:

  * **No numbers.** Apart from ordinal week positions (``weekNumber`` /
    ``startWeek`` / ``endWeek``, all ``ge=1``), this module contains no numeric
    field at all — no hours, no severity, no percentages, no coverage counts.
    The model therefore *structurally cannot* supply a figure (R9.2). Every
    number on the emitted plan is computed by deterministic code:
    ``estimateHours`` from ``complexity``, ``severity`` inherited from the
    matched v1 ``Risk``, capacity from the baseline's peak-demand sizing.
  * **Draft-local keys, not ids.** Cross-references use author-chosen ``key``
    strings scoped to a single draft. The assembler mints the stable ids and
    **drops** any reference that does not resolve, so a hallucinated key can
    never reach a chart.

Qualitative vocabulary (``Priority``, ``QualComplexity``, ``CheckpointType``)
and the already-id-bearing planning-context models (``Workstream``,
``Assumption``, ``OpenQuestion``) are reused from the v2 plan schema so the
draft and the plan speak the same language.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from .execution_plan import (
    Assumption,
    CheckpointType,
    OpenQuestion,
    Priority,
    QualComplexity,
    Workstream,
)

EdgeKind = Literal["sync", "async", "data", "event"]


# ── Requirements & scope ──────────────────────────────────────────────────

class DraftRequirement(BaseModel):
    """A single requirement the plan must trace back to."""

    key: str
    statement: str
    source: Literal["brief", "discovery", "client", "inferred"] = "brief"
    priority: Priority = "should"


class DraftScopeModule(BaseModel):
    """A scope module with an explicit boundary and verifiable criteria."""

    key: str
    name: str
    businessObjective: str
    actors: List[str] = Field(default_factory=list)
    inScope: List[str] = Field(default_factory=list)
    # An explicit boundary is mandatory — "what this does not cover".
    outOfScope: List[str] = Field(min_length=1)
    # At least two verifiable criteria per module.
    acceptanceCriteria: List[str] = Field(min_length=2)
    requirementKeys: List[str] = Field(min_length=1)
    dataEntities: List[str] = Field(default_factory=list)
    integrations: List[str] = Field(default_factory=list)
    securityControls: List[str] = Field(default_factory=list)
    componentKeys: List[str] = Field(default_factory=list)
    complexity: QualComplexity = "Medium"


# ── Architecture ──────────────────────────────────────────────────────────

class DraftComponent(BaseModel):
    """A component-level unit of the architecture."""

    key: str
    name: str
    responsibility: str
    moduleKeys: List[str] = Field(default_factory=list)
    runtime: Optional[str] = None
    technology: Optional[str] = None
    dataBoundary: str
    interfaces: List[str] = Field(min_length=1)
    errorHandling: str
    observability: Optional[str] = None
    security: Optional[str] = None
    scaling: Optional[str] = None
    dependencyComponentKeys: List[str] = Field(default_factory=list)
    failureImpact: Optional[str] = None
    decisions: List[str] = Field(default_factory=list)
    # Design decisions still unresolved, so the surface can mark the component
    # as carrying open decisions (R4.4).
    openDecisions: List[str] = Field(default_factory=list)


class DraftEdge(BaseModel):
    """A directed relationship between two drafted components."""

    fromKey: str
    toKey: str
    kind: EdgeKind
    label: Optional[str] = None


# ── Weekly execution ──────────────────────────────────────────────────────

class DraftTask(BaseModel):
    """A unit of work. Hours are absent by design — the assembler derives
    ``estimateHours`` from ``complexity`` and records the basis."""

    key: str
    title: str
    description: str
    moduleKey: str
    workstreamKey: str
    ownerRoleKey: str
    # Ordinal week positions; the assembler clamps them into 1..N.
    startWeek: int = Field(ge=1)
    endWeek: int = Field(ge=1)
    dependencyTaskKeys: List[str] = Field(default_factory=list)
    acceptanceCriteria: List[str] = Field(min_length=1)
    evidenceRequired: List[str] = Field(default_factory=list)
    complexity: QualComplexity = "Medium"
    priority: Priority = "should"


class DraftClientAction(BaseModel):
    """Something the client must do in a given week."""

    description: str
    weekNumber: int = Field(ge=1)
    # True when the schedule is blocked until the client acts (R3.5).
    required: bool = False


class DraftWeek(BaseModel):
    """One week of the plan and everything it carries."""

    weekNumber: int = Field(ge=1)
    label: str
    objective: str
    taskKeys: List[str] = Field(default_factory=list)
    deliverableTitles: List[str] = Field(default_factory=list)
    checkpointKeys: List[str] = Field(default_factory=list)
    clientActions: List[DraftClientAction] = Field(default_factory=list)


class DraftCheckpoint(BaseModel):
    """A review gate with exit criteria and required evidence."""

    key: str
    title: str
    type: CheckpointType
    weekNumber: int = Field(ge=1)
    ownerRoleKey: str
    blocking: bool = False
    exitCriteria: List[str] = Field(default_factory=list)
    evidenceRequired: List[str] = Field(default_factory=list)
    linkedTaskKeys: List[str] = Field(default_factory=list)


# ── Risk links ────────────────────────────────────────────────────────────

class DraftRiskLink(BaseModel):
    """A risk projected onto the plan. Carries no severity: the assembler
    matches ``label`` to a v1 ``Risk`` and inherits its derived severity."""

    label: str
    category: str
    affectedModuleKeys: List[str] = Field(default_factory=list)
    # Ordinal week positions, not measurements.
    affectedWeekNumbers: List[int] = Field(default_factory=list)
    mitigationTaskKeys: List[str] = Field(default_factory=list)
    mitigationCheckpointKeys: List[str] = Field(default_factory=list)


# ── The draft envelope ────────────────────────────────────────────────────

class PlanAuthoringDraft(BaseModel):
    """The complete authoring contract for one plan-generation pass.

    Never stored and never returned to a caller: it is validated, resolved into
    an ``ExecutionPlan``, and discarded. A draft that fails validation costs
    nothing, because the deterministic baseline plan already exists.
    """

    summary: str
    planningAssumptions: List[Assumption] = Field(default_factory=list)
    openQuestions: List[OpenQuestion] = Field(default_factory=list)
    requirements: List[DraftRequirement] = Field(min_length=1)
    scopeModules: List[DraftScopeModule] = Field(min_length=1)
    workstreams: List[Workstream] = Field(min_length=1)
    # Role names only; stable role ids are minted by the assembler.
    roles: List[str] = Field(min_length=1)
    components: List[DraftComponent] = Field(default_factory=list)
    edges: List[DraftEdge] = Field(default_factory=list)
    tasks: List[DraftTask] = Field(min_length=1)
    weeks: List[DraftWeek] = Field(min_length=1)
    checkpoints: List[DraftCheckpoint] = Field(default_factory=list)
    risks: List[DraftRiskLink] = Field(default_factory=list)
