"""Pydantic mirror of the TypeScript/Zod ``ProposalSchema`` (AI-001).

These models are the contract between the Python AI service and the TS backend.
Field names, enums, and ranges intentionally match ``backend/src/skills/briefParser.ts``
(now removed) so the persisted JSON shape is unchanged.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from .depth import DepthReport, ScoreBasis
from .execution_plan import ExecutionPlan

Complexity = Literal["High", "Medium", "Low"]
Confidence = Literal["High", "Medium", "Low"]


class Feature(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    technical_approach: str = Field(min_length=1)
    complexity: Complexity
    confidence: Confidence
    confidence_pct: int = Field(ge=0, le=100)
    area: str = Field(min_length=1)
    # Where the feature came from: stated in the brief, answered during
    # discovery, or inferred by the model (R1.4). Defaults to "brief" so
    # historical proposals keep their meaning.
    source: Literal["brief", "discovery", "inferred"] = "brief"
    # Read-back for confidence_pct (R2.4). Optional: absent on v1 proposals.
    score_basis: Optional[ScoreBasis] = None


class Risk(BaseModel):
    label: str = Field(min_length=1)
    severity: int = Field(ge=0, le=100)
    mitigation: str = Field(min_length=1)
    category: str = Field(min_length=1)
    # Read-back for severity (R2.4).
    score_basis: Optional[ScoreBasis] = None


class TimelinePhase(BaseModel):
    phase: str = Field(min_length=1)
    duration: str = Field(min_length=1)
    tasks: List[str] = Field(min_length=1)
    dependencies: List[str]


class DeliveryTask(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    owner: Literal["team", "client", "shared"]
    status: Literal["planned", "done", "backlog"]
    notify: bool


class DeliveryWeek(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    startWeek: int = Field(ge=1)
    endWeek: int = Field(ge=1)
    sourcePhase: str = Field(min_length=1)
    goals: List[str]
    tasks: List[DeliveryTask]
    deliverables: List[str]
    dependencies: List[str]


class RoadmapItem(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    targetWeek: int = Field(ge=1)
    sourceWeekIds: List[str]
    status: Literal["planned", "done"]


class BacklogItem(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    sourceWeekId: Optional[str] = None
    reason: Literal["timeline_overflow", "future_enhancement", "dependency_blocked"]
    status: Literal["backlog"]


class NotificationDefaults(BaseModel):
    enabled: bool
    channels: List[Literal["in_app", "email"]]
    events: List[
        Literal[
            "invite",
            "comment",
            "approval",
            "assignment",
            "goal_completed",
            "backlog_moved",
        ]
    ]


class DeliveryPlan(BaseModel):
    mode: Literal["weekly"]
    generatedFrom: Literal["llm", "derived"]
    weeks: List[DeliveryWeek] = Field(min_length=1)
    roadmap: List[RoadmapItem]
    backlog: List[BacklogItem]
    notificationDefaults: NotificationDefaults


class Effort(BaseModel):
    label: str = Field(min_length=1)
    percentage: int = Field(ge=0, le=100)
    timeframe: str = Field(min_length=1)
    description: str = Field(min_length=1)


class MarketItem(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    trend: Literal["up", "down", "stable"]
    relevance: int = Field(ge=0, le=100)
    # Read-back for relevance (R2.4).
    score_basis: Optional[ScoreBasis] = None


class ImpactItem(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    impact_score: int = Field(ge=0, le=100)
    category: str = Field(min_length=1)
    # Read-back for impact_score (R2.4).
    score_basis: Optional[ScoreBasis] = None


class Proposal(BaseModel):
    project_summary: str = Field(min_length=1)
    features: List[Feature] = Field(min_length=1)
    risks: List[Risk] = Field(min_length=1)
    timeline: List[TimelinePhase] = Field(min_length=1)
    delivery_plan: DeliveryPlan
    effort: List[Effort] = Field(min_length=1)
    market: List[MarketItem]
    impact: List[ImpactItem]
    # AI-008 (v2): optional deep execution plan. Absent on every existing v1
    # proposal, so historical JSON continues to parse unchanged.
    executionPlan: Optional[ExecutionPlan] = None
    # Depth accounting for this proposal (R1.1, R1.3). Optional and additive.
    depth_report: Optional[DepthReport] = None


class ProposalDraft(Proposal):
    """Generation-time contract ONLY.

    Used as the Gemini ``response_schema`` so the model is constrained toward
    depth. It is **never** used to validate a stored or inbound proposal — the
    looser minimums on :class:`Proposal` remain the persistence and API
    contract, so a proposal saved before this feature still parses.

    A thin brief is generated against :class:`Proposal` instead, so a short
    brief is never asked to fill six feature slots (R1.3).
    """

    features: List[Feature] = Field(min_length=6, max_length=12)
    risks: List[Risk] = Field(min_length=5)
    timeline: List[TimelinePhase] = Field(min_length=3)
    effort: List[Effort] = Field(min_length=3)
    market: List[MarketItem] = Field(min_length=3)
    impact: List[ImpactItem] = Field(min_length=3)


class ParseBriefResponse(BaseModel):
    proposal: Proposal
    source: Literal["llm", "fallback"]
    degradedReason: str | None = None
    # Echo of the proposal's depth assessment so the surface can explain a thin
    # result rather than presenting it as complete (R1.3).
    depthReport: Optional[DepthReport] = None