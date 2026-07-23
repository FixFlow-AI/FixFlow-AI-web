"""Pydantic schemas for the Confidence Grid (AI-002 / AIE-09).

The headline ``confidenceIndex`` is a deterministic weighted blend of four
grounded factors (see ``features/scoring.py``). The LLM agents contribute only
qualitative ``issues``/``findings`` and a *bounded* modifier per factor — they
can no longer emit the score itself. Every factor carries its evidence so the
UI and audit trail can explain the number.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from .proposal import Proposal

# Hard bound on how far the LLM may nudge a deterministic base (±points).
LLM_MODIFIER_LIMIT = 15


class FactorScore(BaseModel):
    """One grid factor: deterministic base + bounded LLM modifier = final score."""

    name: str = Field(min_length=1)
    score: int = Field(ge=0, le=100)  # final = clamp(base + modifier)
    deterministic_base: int = Field(ge=0, le=100)
    llm_modifier: int = Field(default=0, ge=-LLM_MODIFIER_LIMIT, le=LLM_MODIFIER_LIMIT)
    evidence: List[str] = Field(default_factory=list)


# ── LLM feedback contracts: bounded modifiers + qualitative only ──────────
# These are the *only* structures the LLM agents are asked to produce. They
# deliberately cannot express the absolute score, only a nudge around it.

class AuditorFeedback(BaseModel):
    budget_alignment_modifier: int = Field(
        default=0, ge=-LLM_MODIFIER_LIMIT, le=LLM_MODIFIER_LIMIT
    )
    deliverable_coverage_modifier: int = Field(
        default=0, ge=-LLM_MODIFIER_LIMIT, le=LLM_MODIFIER_LIMIT
    )
    issues: List[str] = Field(default_factory=list)
    findings: str = Field(min_length=1)


class FeasibilityFeedback(BaseModel):
    technical_feasibility_modifier: int = Field(
        default=0, ge=-LLM_MODIFIER_LIMIT, le=LLM_MODIFIER_LIMIT
    )
    timeline_realism_modifier: int = Field(
        default=0, ge=-LLM_MODIFIER_LIMIT, le=LLM_MODIFIER_LIMIT
    )
    issues: List[str] = Field(default_factory=list)
    findings: str = Field(min_length=1)


# ── Evaluation results: grounded factor scores + evidence ─────────────────

class AuditorEvaluation(BaseModel):
    # None when the brief states no budget (factor excluded, not guessed).
    budget_alignment: Optional[FactorScore] = None
    deliverable_coverage: FactorScore
    issues: List[str] = Field(default_factory=list)
    findings: str = Field(min_length=1)


class FeasibilityEvaluation(BaseModel):
    technical_feasibility: FactorScore
    timeline_realism: FactorScore
    issues: List[str] = Field(default_factory=list)
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
    confidenceIndex: int  # deterministic weighted blend of available factors
    optimized: bool
    finalProposal: Proposal
    cycles: list[CycleRecord]
    bestCycle: int
