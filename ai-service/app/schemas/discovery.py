"""Schemas for the Requirement Discovery Agent (Talent section).

The agent turns an incomplete client request into a complete project brief by
asking adaptive, mostly multiple-choice questions one at a time, then emits a
structured brief once confidence is high enough. The service is stateless: the
full answer history is passed on every turn.
"""
from __future__ import annotations

from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class DiscoveryOption(BaseModel):
    """A single selectable choice for a multiple-choice question."""

    key: str = Field(min_length=1, description="Short key shown to the user, e.g. 'A'.")
    label: str = Field(min_length=1, description="Human-readable option text.")


class DiscoveryQuestion(BaseModel):
    """The next question to ask. Prefer multiple-choice (options non-empty)."""

    category: str = Field(
        min_length=1,
        description="Requirement category, e.g. 'Project Goal', 'Platform', 'Budget'.",
    )
    question: str = Field(min_length=1)
    options: List[DiscoveryOption] = Field(default_factory=list)
    allow_custom: bool = True
    multi_select: bool = False


class ProjectBrief(BaseModel):
    """The structured brief produced once discovery is complete."""

    project_goal: str = ""
    target_users: str = ""
    platform: str = ""
    industry: str = ""
    problem_statement: str = ""
    core_features: List[str] = Field(default_factory=list)
    nice_to_have_features: List[str] = Field(default_factory=list)
    integrations: List[str] = Field(default_factory=list)
    authentication: str = ""
    admin_panel: bool = False
    ai_features: List[str] = Field(default_factory=list)
    timeline: str = ""
    budget: str = ""
    design_style: str = ""
    technical_preferences: List[str] = Field(default_factory=list)
    existing_assets: List[str] = Field(default_factory=list)
    success_criteria: str = ""


class DiscoveryTurn(BaseModel):
    """One turn of the discovery loop.

    - ``status == 'questioning'`` → ``next_question`` is present.
    - ``status == 'complete'``    → ``brief`` is present and confidence >= 90.
    """

    status: Literal["questioning", "complete"]
    confidence: int = Field(ge=0, le=100)
    next_question: Optional[DiscoveryQuestion] = None
    brief: Optional[ProjectBrief] = None
    missing_information: List[str] = Field(default_factory=list)


class DiscoveryAnswer(BaseModel):
    question: str = Field(min_length=1)
    answer: str


class DiscoveryRequest(BaseModel):
    initialRequest: str = Field(min_length=1)
    answers: List[DiscoveryAnswer] = Field(default_factory=list)
