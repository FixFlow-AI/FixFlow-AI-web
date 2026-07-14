"""Pydantic mirror of ``confidenceGrid.ts`` evaluation schemas (AI-002)."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field

from .proposal import Proposal


class AuditorEvaluation(BaseModel):
    budget_alignment_score: int = Field(ge=0, le=100)
    deliverable_coverage_score: int = Field(ge=0, le=100)
    issues: List[str]
    findings: str = Field(min_length=1)


class FeasibilityEvaluation(BaseModel):
    technical_feasibility_score: int = Field(ge=0, le=100)
    timeline_realism_score: int = Field(ge=0, le=100)
    issues: List[str]
    findings: str = Field(min_length=1)


class CycleRecord(BaseModel):
    cycle: int
    auditor: AuditorEvaluation
    feasibility: FeasibilityEvaluation
    confidenceIndex: int
    issuesFed: list[str]
    optimizationApplied: bool
    improvedOverPrevious: bool | None


class ConfidenceGridResult(BaseModel):
    auditor: AuditorEvaluation
    feasibility: FeasibilityEvaluation
    confidenceIndex: int  # mean of the 4 individual scores
    optimized: bool
    finalProposal: Proposal
    cycles: list[CycleRecord]
    bestCycle: int

