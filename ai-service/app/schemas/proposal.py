"""Pydantic mirror of the TypeScript/Zod ``ProposalSchema`` (AI-001).

These models are the contract between the Python AI service and the TS backend.
Field names, enums, and ranges intentionally match ``backend/src/skills/briefParser.ts``
(now removed) so the persisted JSON shape is unchanged.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

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


class Risk(BaseModel):
    label: str = Field(min_length=1)
    severity: int = Field(ge=0, le=100)
    mitigation: str = Field(min_length=1)
    category: str = Field(min_length=1)


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


class ImpactItem(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    impact_score: int = Field(ge=0, le=100)
    category: str = Field(min_length=1)


class Proposal(BaseModel):
    project_summary: str = Field(min_length=1)
    features: List[Feature] = Field(min_length=1)
    risks: List[Risk] = Field(min_length=1)
    timeline: List[TimelinePhase] = Field(min_length=1)
    delivery_plan: DeliveryPlan
    effort: List[Effort] = Field(min_length=1)
    market: List[MarketItem]
    impact: List[ImpactItem]


class ParseBriefResponse(BaseModel):
    proposal: Proposal
    source: Literal["llm", "fallback"]
    degradedReason: str | None = None