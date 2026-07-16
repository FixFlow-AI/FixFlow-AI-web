from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class BudgetRange(BaseModel):
    min_budget: int = Field(default=0, ge=0)
    max_budget: int = Field(default=0, ge=0)


class Opportunity(BaseModel):
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    budget: BudgetRange = Field(default_factory=BudgetRange)
    currency: str = Field(default="USD")
    urgency: Literal["High", "Medium", "Low"] = "Medium"
    remote: bool = True
    red_flags: List[str] = Field(default_factory=list)
    source: str = Field(default="unknown")
    posted_at: str = Field(default="")
    dedupe_key: str = Field(default="")


class FactorScores(BaseModel):
    skill_fit: int = Field(ge=0, le=100)
    budget_adequacy: int = Field(ge=0, le=100)
    urgency: int = Field(ge=0, le=100)
    client_quality: int = Field(ge=0, le=100)
    red_flag_penalty: int = Field(ge=0, le=100)


class OpportunityScore(BaseModel):
    opportunity_id: str
    overall_score: int = Field(ge=0, le=100)
    factors: FactorScores
    rank: int = 1
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    dedupe_key: str


class ScoreOpportunityRequest(BaseModel):
    opportunity: Opportunity
    # Freelancer profile description or skills
    verified_skills: List[str] = Field(default_factory=list)
    # The client quality rating if available (1-100, default 80)
    client_rating: Optional[int] = 80
