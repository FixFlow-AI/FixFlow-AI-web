"""AIE-09 — Deterministic factor scoring for the Confidence Grid.

The confidence grid used to be four numbers the LLM invented, then averaged.
This module grounds each factor in *measured* signals derived from the brief
and the proposal, so the same inputs always yield the same score and every
factor can be traced to concrete evidence.

Design mirrors ``opportunity.score_opportunity``: pure, deterministic math with
explicit weights (``config.Settings.CONFIDENCE_WEIGHTS``). The LLM only supplies
a *bounded* qualitative modifier on top of these bases (applied in
``confidence_grid.py``); it never emits the headline number.

Every scorer returns a :class:`FactorResult` (``base`` in ``0-100`` plus
human-readable ``evidence``) or ``None`` when there is no evidence to measure
(e.g. no stated budget), so the aggregate can *exclude* the factor rather than
defaulting to a fabricated guess.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ..schemas.proposal import Proposal
from .skill_gap import extract_required_skills


@dataclass
class FactorResult:
    """A grounded deterministic sub-score with its supporting evidence."""

    name: str
    base: int  # 0-100
    evidence: List[str] = field(default_factory=list)


# ── Deliverable coverage ──────────────────────────────────────────────────

def score_deliverable_coverage(brief_text: str, proposal: Proposal) -> FactorResult:
    """% of brief-requested deliverables present in the proposal.

    Reuses ``skill_gap.extract_required_skills`` to derive the concrete,
    normalised technology deliverables requested in the brief, then checks how
    many of those appear anywhere in the proposal (features / risks / summary).
    Coverage % = matched / requested.
    """
    requested = extract_required_skills(brief_text)
    if not requested:
        return FactorResult(
            name="deliverable_coverage",
            base=100,
            evidence=["No explicit deliverables detected in brief; treated as fully covered"],
        )

    covered = requested & extract_required_skills("", proposal)
    missing = requested - covered
    coverage = round(len(covered) / len(requested) * 100)

    evidence = [f"{len(covered)} of {len(requested)} requested deliverables covered"]
    if covered:
        evidence.append("covered: " + ", ".join(sorted(covered)))
    if missing:
        evidence.append("missing: " + ", ".join(sorted(missing)))

    return FactorResult(name="deliverable_coverage", base=coverage, evidence=evidence)


# ── Timeline realism ──────────────────────────────────────────────────────

def _detect_cycle(graph: Dict[str, List[str]]) -> bool:
    """Return True if the directed dependency graph contains a cycle."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: Dict[str, int] = {node: WHITE for node in graph}

    def visit(node: str) -> bool:
        color[node] = GRAY
        for nxt in graph.get(node, []):
            if nxt not in color:
                continue  # dependency points outside the known week set
            if color[nxt] == GRAY:
                return True
            if color[nxt] == WHITE and visit(nxt):
                return True
        color[node] = BLACK
        return False

    return any(color[node] == WHITE and visit(node) for node in graph)


def score_timeline_realism(proposal: Proposal) -> FactorResult:
    """Validate the delivery-week schedule: bounds, continuity, cycles, density.

    Starts at 100 and deducts for each concrete defect found in
    ``delivery_plan.weeks`` (invalid bounds, overlaps, gaps, dependency cycles,
    empty or over-loaded weeks).
    """
    weeks = proposal.delivery_plan.weeks
    penalty = 0
    evidence: List[str] = []

    # 1. Week bounds: startWeek must not exceed endWeek.
    for week in weeks:
        if week.startWeek > week.endWeek:
            penalty += 15
            evidence.append(
                f"week '{week.id}': startWeek {week.startWeek} > endWeek {week.endWeek}"
            )

    # 2. Continuity: no overlaps and no gaps between consecutive weeks.
    ordered = sorted(weeks, key=lambda w: (w.startWeek, w.endWeek))
    for prev, cur in zip(ordered, ordered[1:]):
        if cur.startWeek <= prev.endWeek:
            penalty += 10
            evidence.append(f"overlap between '{prev.id}' and '{cur.id}'")
        elif cur.startWeek > prev.endWeek + 1:
            penalty += 5
            evidence.append(
                f"gap between '{prev.id}' (ends {prev.endWeek}) and "
                f"'{cur.id}' (starts {cur.startWeek})"
            )

    # 3. Dependency cycles among weeks.
    graph = {week.id: list(week.dependencies) for week in weeks}
    if _detect_cycle(graph):
        penalty += 25
        evidence.append("dependency cycle detected among delivery weeks")

    # 4. Task-per-week density within sane bounds.
    for week in weeks:
        span = max(1, week.endWeek - week.startWeek + 1)
        if len(week.tasks) == 0:
            penalty += 5
            evidence.append(f"week '{week.id}' has no tasks")
        elif len(week.tasks) / span > 8:
            penalty += 5
            evidence.append(
                f"week '{week.id}' task density {len(week.tasks) / span:.1f}/week "
                "exceeds sane bound (8)"
            )

    score = max(0, 100 - penalty)
    if not evidence:
        evidence.append("weeks are continuous, acyclic, and sensibly loaded")

    return FactorResult(name="timeline_realism", base=score, evidence=evidence)


# ── Budget alignment ──────────────────────────────────────────────────────

_BUDGET_RE = re.compile(
    r"(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s*([\d,]+(?:\.\d+)?)\s*(k|m)?"
    r"|([\d,]+(?:\.\d+)?)\s*(k|m)?\s*(?:usd|inr|eur|gbp|dollars?|rupees?)"
    r"|(?:budget|cost|price)[^\d]{0,20}?([\d,]+(?:\.\d+)?)\s*(k|m)?"
    r"|([\d,]+(?:\.\d+)?)\s*(k|m)?\s*(?:budget|cost|price)",
    re.IGNORECASE,
)

_COMPLEXITY_WEIGHT = {"High": 3, "Medium": 2, "Low": 1}


def parse_budget(brief_text: str) -> Optional[float]:
    """Extract the largest stated budget figure from the brief, or None.

    Handles currency symbols/codes, thousands separators, and ``k``/``m``
    suffixes. Returns ``None`` when no budget is stated so the caller can treat
    the factor as neutral (excluded) rather than guessing.
    """
    amounts: List[float] = []
    for match in _BUDGET_RE.finditer(brief_text or ""):
        # Each alternative exposes a (number, suffix) pair in its own groups.
        pairs = [
            (match.group(1), match.group(2)),
            (match.group(3), match.group(4)),
            (match.group(5), match.group(6)),
            (match.group(7), match.group(8)),
        ]
        for number, suffix in pairs:
            if not number:
                continue
            try:
                value = float(number.replace(",", ""))
            except ValueError:
                continue
            if suffix:
                value *= 1_000 if suffix.lower() == "k" else 1_000_000
            amounts.append(value)

    return max(amounts) if amounts else None


def score_budget_alignment(brief_text: str, proposal: Proposal) -> Optional[FactorResult]:
    """Compare a stated budget against proposal effort allocation and scope demand.

    Returns ``None`` when the brief states no budget — the factor is then
    excluded from the aggregate, not defaulted to a guess.

    Two grounded signals:
      * effort allocation must be well-formed (``effort[].percentage`` ≈ 100%).
      * budget-per-complexity-unit must be plausible for the proposed scope.
    """
    budget = parse_budget(brief_text)
    if budget is None:
        return None

    penalty = 0
    evidence = [f"detected stated budget ~= {budget:.0f}"]

    # 1. Effort allocation well-formedness.
    effort_sum = sum(effort.percentage for effort in proposal.effort)
    if abs(effort_sum - 100) > 10:
        penalty += min(30, abs(effort_sum - 100))
        evidence.append(f"effort allocation sums to {effort_sum}%, expected ~100%")

    # 2. Budget vs. scope demand (weighted complexity units).
    demand = sum(_COMPLEXITY_WEIGHT[f.complexity] for f in proposal.features)
    per_unit = budget / demand if demand else budget
    evidence.append(f"budget per complexity unit ~= {per_unit:.0f} (scope demand {demand})")
    if per_unit < 200:
        penalty += 25
        evidence.append("budget is low relative to the proposed scope complexity")
    elif per_unit < 500:
        penalty += 10
        evidence.append("budget is tight relative to the proposed scope complexity")

    score = max(0, 100 - penalty)
    return FactorResult(name="budget_alignment", base=score, evidence=evidence)


# ── Technical feasibility ─────────────────────────────────────────────────

def score_technical_feasibility(proposal: Proposal) -> FactorResult:
    """Heuristic feasibility: risk mitigation, complexity-vs-duration, stack coherence."""
    penalty = 0
    evidence: List[str] = []

    # 1. High-severity risks must carry a substantive mitigation.
    for risk in proposal.risks:
        if risk.severity >= 70 and len(risk.mitigation.strip()) < 10:
            penalty += 10
            evidence.append(
                f"high-severity risk '{risk.label}' lacks a substantive mitigation"
            )

    # 2. High-complexity features must fit the delivery span.
    total_weeks = max((w.endWeek for w in proposal.delivery_plan.weeks), default=1)
    high = sum(1 for f in proposal.features if f.complexity == "High")
    if high > total_weeks:
        penalty += min(20, (high - total_weeks) * 5)
        evidence.append(
            f"{high} high-complexity features compressed into {total_weeks} week(s)"
        )

    # 3. Stack coherence: proposal must reference a recognisable technology stack.
    if not extract_required_skills("", proposal):
        penalty += 10
        evidence.append("no recognisable technology stack referenced in the proposal")

    # 4. Low-confidence features signal shaky technical footing.
    low_conf = [f for f in proposal.features if f.confidence_pct < 40]
    if low_conf:
        penalty += min(15, len(low_conf) * 5)
        evidence.append(f"{len(low_conf)} feature(s) declared with low confidence (<40%)")

    score = max(0, 100 - penalty)
    if not evidence:
        evidence.append("stack coherent, high-severity risks mitigated, complexity fits timeline")

    return FactorResult(name="technical_feasibility", base=score, evidence=evidence)


# ── Aggregation helpers ───────────────────────────────────────────────────

def compute_deterministic_factors(
    brief_text: str, proposal: Proposal
) -> Dict[str, Optional[FactorResult]]:
    """Compute all four grounded factor bases (budget may be ``None``)."""
    return {
        "deliverable_coverage": score_deliverable_coverage(brief_text, proposal),
        "timeline_realism": score_timeline_realism(proposal),
        "budget_alignment": score_budget_alignment(brief_text, proposal),
        "technical_feasibility": score_technical_feasibility(proposal),
    }


def blend_factor(base: int, modifier: int, limit: int) -> int:
    """Apply a bounded LLM modifier to a deterministic base, clamped to 0-100."""
    bounded = max(-limit, min(limit, modifier))
    return max(0, min(100, base + bounded))


def weighted_confidence_index(
    factor_scores: Dict[str, Optional[int]],
    weights: Dict[str, float],
) -> int:
    """Weighted mean of the available factor scores.

    Factors whose score is ``None`` (e.g. no stated budget) are excluded and the
    remaining weights are renormalised, so the index is never diluted by a
    fabricated default.
    """
    numerator = 0.0
    denominator = 0.0
    for name, score in factor_scores.items():
        if score is None:
            continue
        weight = weights.get(name, 0.0)
        numerator += weight * score
        denominator += weight

    if denominator == 0:
        return 0
    return round(numerator / denominator)
