"""AIE-09 — Deterministic Confidence Grid factor tests.

Covers the grounded scoring layer in ``app/features/scoring.py``:
  * deliverable coverage: full vs. partial
  * timeline realism: gap / overlap / dependency-cycle detection
  * budget alignment: missing-budget neutrality + parsing
  * blend clamping and weighted-mean renormalisation
  * determinism: identical inputs -> identical factor bases and index

Runnable standalone (`python test_confidence_scoring.py`) or via pytest.
"""
from __future__ import annotations

from app.config import get_settings
from app.features.brief_parser import sanitize_and_patch_brief
from app.features.scoring import (
    blend_factor,
    compute_deterministic_factors,
    parse_budget,
    score_budget_alignment,
    score_deliverable_coverage,
    score_technical_feasibility,
    score_timeline_realism,
    weighted_confidence_index,
)
from app.schemas.proposal import Proposal


# ── Fixtures ──────────────────────────────────────────────────────────────

def _make_feature(text: str, complexity: str = "Medium", confidence_pct: int = 80) -> dict:
    return {
        "title": text,
        "description": text,
        "technical_approach": text,
        "complexity": complexity,
        "confidence": "High",
        "confidence_pct": confidence_pct,
        "area": "Engineering",
    }


def _make_week(week_id: str, start: int, end: int, n_tasks: int = 1, deps=None) -> dict:
    return {
        "id": week_id,
        "label": f"Sprint {week_id}",
        "startWeek": start,
        "endWeek": end,
        "sourcePhase": "Initial Integration",
        "goals": ["deliver"],
        "tasks": [
            {
                "id": f"{week_id}-t{i}",
                "title": "do work",
                "owner": "team",
                "status": "planned",
                "notify": False,
            }
            for i in range(n_tasks)
        ],
        "deliverables": ["artifact"],
        "dependencies": deps or [],
    }


def _build_proposal(
    *,
    features: list[dict] | None = None,
    weeks: list[dict] | None = None,
    risks: list[dict] | None = None,
    effort: list[dict] | None = None,
    project_summary: str = "Delivery of the requested application.",
) -> Proposal:
    """Start from the valid fallback proposal and override specific sections."""
    data = sanitize_and_patch_brief({}).model_dump()
    data["project_summary"] = project_summary
    if features is not None:
        data["features"] = features
    if risks is not None:
        data["risks"] = risks
    if effort is not None:
        data["effort"] = effort
    if weeks is not None:
        data["delivery_plan"]["weeks"] = weeks
    return Proposal.model_validate(data)


_NEUTRAL_RISK = [
    {
        "label": "Requirements churn",
        "severity": 40,
        "mitigation": "Hold regular alignment reviews with stakeholders.",
        "category": "Scope",
    }
]

BRIEF = "Build a react frontend with postgresql database and docker deployment."


# ── Deliverable coverage ────────────────────────────────────────────────

def test_deliverable_coverage_full():
    proposal = _build_proposal(
        features=[_make_feature("react postgresql docker integration")],
        risks=_NEUTRAL_RISK,
    )
    result = score_deliverable_coverage(BRIEF, proposal)
    assert result.base == 100, result.evidence
    print("  [ok] deliverable coverage full -> 100")


def test_deliverable_coverage_partial():
    proposal = _build_proposal(
        features=[_make_feature("react frontend only")],
        risks=_NEUTRAL_RISK,
    )
    result = score_deliverable_coverage(BRIEF, proposal)
    # 1 of 3 requested (react) covered; postgresql + docker missing.
    assert result.base == 33, result.evidence
    assert any("missing" in e for e in result.evidence)
    print("  [ok] deliverable coverage partial -> 33")


def test_deliverable_coverage_no_deliverables_neutral():
    proposal = _build_proposal(features=[_make_feature("generic work")], risks=_NEUTRAL_RISK)
    result = score_deliverable_coverage("Please help us with our project.", proposal)
    assert result.base == 100
    print("  [ok] deliverable coverage neutral when no deliverables detected")


# ── Timeline realism ──────────────────────────────────────────────────────

def test_timeline_clean():
    proposal = _build_proposal(
        weeks=[_make_week("w1", 1, 2), _make_week("w2", 3, 4)],
    )
    result = score_timeline_realism(proposal)
    assert result.base == 100, result.evidence
    print("  [ok] timeline clean -> 100")


def test_timeline_gap_detected():
    proposal = _build_proposal(
        weeks=[_make_week("w1", 1, 1), _make_week("w2", 3, 3)],
    )
    result = score_timeline_realism(proposal)
    assert result.base < 100
    assert any("gap" in e for e in result.evidence)
    print("  [ok] timeline gap detected")


def test_timeline_overlap_detected():
    proposal = _build_proposal(
        weeks=[_make_week("w1", 1, 3), _make_week("w2", 2, 4)],
    )
    result = score_timeline_realism(proposal)
    assert result.base < 100
    assert any("overlap" in e for e in result.evidence)
    print("  [ok] timeline overlap detected")


def test_timeline_cycle_detected():
    proposal = _build_proposal(
        weeks=[
            _make_week("w1", 1, 1, deps=["w2"]),
            _make_week("w2", 2, 2, deps=["w1"]),
        ],
    )
    result = score_timeline_realism(proposal)
    assert result.base < 100
    assert any("cycle" in e for e in result.evidence)
    print("  [ok] timeline dependency cycle detected")


def test_timeline_empty_week_penalised():
    proposal = _build_proposal(
        weeks=[_make_week("w1", 1, 1, n_tasks=0)],
    )
    result = score_timeline_realism(proposal)
    assert result.base < 100
    assert any("no tasks" in e for e in result.evidence)
    print("  [ok] timeline empty week penalised")


# ── Budget alignment ──────────────────────────────────────────────────────

def test_parse_budget_variants():
    assert parse_budget("Our budget is $10,000 for this.") == 10000
    assert parse_budget("We can pay 5k USD.") == 5000
    assert parse_budget("Total INR 200000 available.") == 200000
    assert parse_budget("2.5m budget ceiling") == 2_500_000
    assert parse_budget("No money details here.") is None
    print("  [ok] parse_budget handles symbols, codes, k/m suffixes, and absence")


def test_budget_missing_returns_none():
    proposal = _build_proposal()
    assert score_budget_alignment("No budget stated here.", proposal) is None
    print("  [ok] budget alignment None when unstated (excluded, not guessed)")


def test_budget_present_returns_score():
    proposal = _build_proposal(
        features=[_make_feature("react work", complexity="Low")],
        effort=[
            {
                "label": "Build",
                "percentage": 100,
                "timeframe": "4 weeks",
                "description": "Core build",
            }
        ],
    )
    result = score_budget_alignment("Budget is $50,000.", proposal)
    assert result is not None
    assert result.base == 100, result.evidence  # generous budget, well-formed effort
    print("  [ok] budget alignment scores a stated budget")


def test_budget_malformed_effort_penalised():
    proposal = _build_proposal(
        features=[_make_feature("react work", complexity="Low")],
        effort=[
            {
                "label": "Build",
                "percentage": 40,
                "timeframe": "4 weeks",
                "description": "Core build",
            }
        ],
    )
    result = score_budget_alignment("Budget is $50,000.", proposal)
    assert result is not None
    assert result.base < 100
    assert any("effort allocation" in e for e in result.evidence)
    print("  [ok] budget alignment penalises malformed effort allocation")


# ── Technical feasibility ─────────────────────────────────────────────────

def test_technical_feasibility_flags_unmitigated_risk():
    proposal = _build_proposal(
        features=[_make_feature("react postgresql work")],
        risks=[
            {
                "label": "Critical dependency",
                "severity": 90,
                "mitigation": "n/a",
                "category": "Technical",
            }
        ],
    )
    result = score_technical_feasibility(proposal)
    assert result.base < 100
    assert any("mitigation" in e for e in result.evidence)
    print("  [ok] technical feasibility flags unmitigated high-severity risk")


# ── Blend + aggregate helpers ─────────────────────────────────────────────

def test_blend_factor_clamps():
    assert blend_factor(90, 15, 15) == 100  # 90 + 15 = 105 -> clamp 100
    assert blend_factor(10, -20, 15) == 0   # modifier bounded to -15 -> -5 -> clamp 0
    assert blend_factor(50, 5, 15) == 55
    print("  [ok] blend_factor clamps modifier and 0-100 range")


def test_weighted_index_excludes_none_budget():
    weights = get_settings().CONFIDENCE_WEIGHTS
    # budget None -> excluded; remaining weights renormalise over 0.30/0.25/0.25.
    idx = weighted_confidence_index(
        {
            "deliverable_coverage": 100,
            "timeline_realism": 60,
            "technical_feasibility": 80,
            "budget_alignment": None,
        },
        weights,
    )
    expected = round((0.30 * 100 + 0.25 * 60 + 0.25 * 80) / (0.30 + 0.25 + 0.25))
    assert idx == expected
    print("  [ok] weighted index excludes None budget and renormalises")


def test_weighted_index_all_equal():
    weights = get_settings().CONFIDENCE_WEIGHTS
    idx = weighted_confidence_index(
        {
            "deliverable_coverage": 80,
            "timeline_realism": 80,
            "technical_feasibility": 80,
            "budget_alignment": 80,
        },
        weights,
    )
    assert idx == 80
    print("  [ok] weighted index of equal factors equals the shared value")


# ── Determinism ────────────────────────────────────────────────────────────

def test_determinism():
    proposal = _build_proposal(
        features=[_make_feature("react postgresql docker", complexity="High")],
        weeks=[_make_week("w1", 1, 2), _make_week("w2", 3, 4)],
        risks=_NEUTRAL_RISK,
    )
    first = compute_deterministic_factors(BRIEF, proposal)
    for _ in range(5):
        again = compute_deterministic_factors(BRIEF, proposal)
        assert again == first  # dataclass equality over base + evidence

    weights = get_settings().CONFIDENCE_WEIGHTS

    def index_from(factors) -> int:
        return weighted_confidence_index(
            {name: (fr.base if fr is not None else None) for name, fr in factors.items()},
            weights,
        )

    baseline = index_from(first)
    for _ in range(5):
        assert index_from(compute_deterministic_factors(BRIEF, proposal)) == baseline
    print(f"  [ok] deterministic: same inputs -> same index ({baseline}) across runs")


if __name__ == "__main__":
    print("AIE-09 deterministic confidence scoring tests")
    test_deliverable_coverage_full()
    test_deliverable_coverage_partial()
    test_deliverable_coverage_no_deliverables_neutral()
    test_timeline_clean()
    test_timeline_gap_detected()
    test_timeline_overlap_detected()
    test_timeline_cycle_detected()
    test_timeline_empty_week_penalised()
    test_parse_budget_variants()
    test_budget_missing_returns_none()
    test_budget_present_returns_score()
    test_budget_malformed_effort_penalised()
    test_technical_feasibility_flags_unmitigated_risk()
    test_blend_factor_clamps()
    test_weighted_index_excludes_none_budget()
    test_weighted_index_all_equal()
    test_determinism()
    print("ALL DETERMINISTIC SCORING TESTS PASSED")
