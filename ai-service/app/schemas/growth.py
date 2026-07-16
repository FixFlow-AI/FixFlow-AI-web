from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from .github import ProfileConfidence, VerifiedSkill, ExperienceSignals, ConfidenceBand


class ActionItem(BaseModel):
    factor: str
    action: str
    impact: Literal["High", "Medium", "Low"]
    effort: Literal["High", "Medium", "Low"]


class SuggestedProject(BaseModel):
    title: str
    description: str
    skills_to_practice: List[str] = Field(default_factory=list)


class GrowthPlan(BaseModel):
    currentBand: ConfidenceBand
    targetBand: ConfidenceBand
    overallScore: int = Field(ge=0, le=100)
    prioritizedActions: List[ActionItem] = Field(default_factory=list)
    targetSkills: List[str] = Field(default_factory=list)
    suggestedProjects: List[SuggestedProject] = Field(default_factory=list)


class GrowthPlanRequest(BaseModel):
    confidence: ProfileConfidence
    verified_skills: List[VerifiedSkill] = Field(default_factory=list)
    experience: Optional[ExperienceSignals] = None
