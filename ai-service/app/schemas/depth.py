"""Proposal depth accounting and score explainability schemas.

Two concerns live here, both in service of the platform's "no invented
precision" rule:

  * **Depth reporting.** ``BriefSubstance`` / ``DepthTargets`` / ``SectionDepth``
    / ``DepthReport`` record how much substance a brief actually carried, what
    depth was therefore expected, and what was produced. When a target is
    unmet the system *reports* the shortfall (``depthLimited`` + a user-facing
    ``note``) instead of padding a section with generic entries (R1.3, R2.5).
  * **Score explainability.** ``ScoreBasis`` carries the qualitative inputs and
    the rule behind a deterministically derived number, so every figure the UI
    shows can be read back rather than merely asserted (R2.4, R9.6).

Nothing in this module is model-authored: ``depth_policy.py`` computes these
values from the proposal that already exists, and must never construct new
proposal items to satisfy a target.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

DepthLimitReason = Literal["brief_too_short", "model_shortfall", "degraded"]


# ── Brief substance and depth targets ─────────────────────────────────────

class BriefSubstance(BaseModel):
    """How much material the brief (plus discovery answers) actually supplied."""

    wordCount: int
    distinctTopicCount: int
    hasDiscoveryAnswers: bool
    # True when the brief clears the substance threshold, so full depth targets
    # apply rather than the reduced set.
    sufficient: bool


class DepthTargets(BaseModel):
    """The per-section depth expected for a given brief substance level."""

    minFeatures: int
    # Upper bound keeps the scope list reviewable (R1.1); it never truncates.
    maxFeatures: int
    minRisks: int
    minRiskCategories: int
    minMarket: int
    minImpact: int
    minTimelinePhases: int
    minEffort: int
    minCriteriaPerModule: int


# ── Depth report ──────────────────────────────────────────────────────────

class SectionDepth(BaseModel):
    """Actual versus targeted item count for one proposal section."""

    section: str = Field(min_length=1)
    actual: int
    target: int
    met: bool


class DepthReport(BaseModel):
    """Assessment of the depth a generated proposal reached.

    Attached to the proposal and echoed on the parse response so the surface can
    explain a thin result instead of silently presenting it as complete.
    """

    sections: List[SectionDepth]
    depthLimited: bool = False
    limitReason: Optional[DepthLimitReason] = None
    # User-facing sentence stating that depth was limited by brief detail (R1.3).
    note: Optional[str] = None
    # True when the one bounded shortfall re-ask was spent.
    reaskUsed: bool = False


# ── Score explainability ──────────────────────────────────────────────────

class ScoreBasis(BaseModel):
    """Why a deterministic number is what it is (R2.4, R9.6)."""

    # The qualitative signals consumed, e.g.
    # ["complexity=High", "concrete technical approach", "scheduled in plan"].
    inputs: List[str]
    # Reads back to the derived figure, e.g. "base 55 (High) +5 approach +5 scheduled".
    rule: str
