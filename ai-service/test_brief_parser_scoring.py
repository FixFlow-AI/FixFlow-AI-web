"""AIE-10 — Grounded brief-parser scoring tests.

Verifies that `confidence_pct`, `confidence` (label), `risk.severity`,
`impact_score`, and `market.relevance` are computed deterministically from
grounded fields rather than emitted by the LLM.

Covered:
  - complexity -> confidence mapping (and label/number consistency)
  - grounding bonuses (technical approach, delivery-plan linkage, deps)
  - mitigation -> severity mapping (none / weak / strong; category weight)
  - impact_score / relevance derivation (category, trend, feature linkage)
  - LLM path vs. fallback path parity: identical structure -> identical numbers

The file is both pytest-discoverable and runnable standalone
(`python test_brief_parser_scoring.py`), matching `test_confidence_grid.py`.
"""
from __future__ import annotations

from app.features.brief_parser import (
    apply_deterministic_scores,
    derive_confidence_label,
    derive_confidence_pct,
    derive_impact_score,
    derive_relevance,
    derive_severity,
    sanitize_and_patch_brief,
)
from app.schemas.proposal import Proposal


# --- Step 3.1: complexity -> confidence -----------------------------------

def test_confidence_pct_complexity_ordering():
    """Lower complexity yields higher confidence for identical grounding."""
    high = derive_confidence_pct("High", False, False, False)
    med = derive_confidence_pct("Medium", False, False, False)
    low = derive_confidence_pct("Low", False, False, False)
    assert (high, med, low) == (55, 70, 85)
    assert high < med < low
    print("  [ok] complexity ordering: High<Medium<Low base confidence")


def test_confidence_pct_grounding_bonuses():
    """Concrete approach, plan linkage, and resolved deps each add confidence."""
    base = derive_confidence_pct("High", False, False, False)  # 55
    approach = derive_confidence_pct("High", True, False, False)  # +5
    scheduled = derive_confidence_pct("High", True, True, False)  # +5
    resolved = derive_confidence_pct("High", True, True, True)  # +5
    assert base == 55
    assert approach == 60
    assert scheduled == 65
    assert resolved == 70
    # Dependency bonus requires the feature to be scheduled.
    assert derive_confidence_pct("High", False, False, True) == 55
    print("  [ok] grounding bonuses: approach/plan/deps stack, deps need schedule")


def test_confidence_label_consistent_with_pct():
    """Label is derived from the number, so the two can never disagree."""
    assert derive_confidence_label(80) == "High"
    assert derive_confidence_label(79) == "Medium"
    assert derive_confidence_label(60) == "Medium"
    assert derive_confidence_label(59) == "Low"
    # Round-trip: every derived label matches its own pct band.
    for pct in range(0, 101):
        label = derive_confidence_label(pct)
        if label == "High":
            assert pct >= 80
        elif label == "Medium":
            assert 60 <= pct < 80
        else:
            assert pct < 60
    print("  [ok] confidence label consistent with pct by construction")


# --- Step 3.2: mitigation -> severity -------------------------------------

def test_severity_mitigation_strength():
    """No mitigation raises severity; a strong mitigation lowers it."""
    category = "Technical Integration"  # base 65
    none = derive_severity(category, "")
    weak = derive_severity(category, "review it")  # short -> neutral
    strong = derive_severity(category, "Implement automated mock contracts and CI gates early.")
    assert none == 85  # 65 + 20
    assert weak == 65  # neutral
    assert strong == 50  # 65 - 15
    assert none > weak > strong
    print("  [ok] severity: none > weak > strong mitigation")


def test_severity_category_weighting():
    """Higher-stakes categories score higher for the same mitigation."""
    mit = "review it"  # neutral, isolates category weight
    security = derive_severity("Security & Compliance", mit)
    integration = derive_severity("Technical Integration", mit)
    scope = derive_severity("Scope Management", mit)
    generic = derive_severity("Miscellaneous", mit)
    assert security == 80
    assert integration == 65
    assert scope == 55
    assert generic == 50
    assert security > integration > scope > generic
    print("  [ok] severity category weighting ordered")


def test_severity_clamped():
    """Severity stays within [0, 100] even with stacked adjustments."""
    assert derive_severity("Security", "") == 100  # 80 + 20, clamped at 100
    print("  [ok] severity clamped to [0,100]")


# --- Step 3.3: impact_score / relevance -----------------------------------

def test_impact_score_category_and_linkage():
    revenue = derive_impact_score("Revenue Growth", False)
    ops = derive_impact_score("Operational Efficiency", False)
    generic = derive_impact_score("Other", False)
    assert revenue == 85
    assert ops == 75
    assert generic == 60
    # Feature linkage adds a bounded bonus.
    assert derive_impact_score("Other", True) == 70
    print("  [ok] impact_score: category weight + linkage bonus")


def test_relevance_trend_and_linkage():
    up = derive_relevance("up", False)
    stable = derive_relevance("stable", False)
    down = derive_relevance("down", False)
    assert up == 80
    assert stable == 60
    assert down == 50
    assert derive_relevance("stable", True) == 70
    print("  [ok] relevance: trend delta + linkage bonus")


# --- Step 3.5: LLM path vs. fallback parity -------------------------------

def _sample_raw() -> dict:
    """A structurally rich raw brief object (numbers deliberately absurd)."""
    return {
        "project_summary": "Build a payments dashboard with escrow milestones.",
        "features": [
            {
                "title": "Escrow Payment Engine",
                "description": "Milestone-based escrow with release controls.",
                "technical_approach": "Finite state machine with SHA-256 audit trail.",
                "complexity": "High",
                "confidence": "High",  # LLM label — should be overwritten
                "confidence_pct": 99,  # LLM number — should be overwritten
                "area": "Payments",
            },
            {
                "title": "Notification Center",
                "description": "In-app and email notifications for events.",
                "technical_approach": "x",  # too short -> not concrete
                "complexity": "Low",
                "confidence": "Low",
                "confidence_pct": 12,
                "area": "Messaging",
            },
        ],
        "risks": [
            {
                "label": "Payment data breach",
                "severity": 3,  # LLM number — should be overwritten
                "mitigation": "Encrypt at rest and in transit with rotating keys and audits.",
                "category": "Security & Compliance",
            },
            {
                "label": "Scope creep",
                "severity": 97,
                "mitigation": "",  # will be defaulted by sanitizer, then scored
                "category": "Scope Management",
            },
        ],
        "delivery_plan": {
            "weeks": [
                {
                    "id": "week-1",
                    "label": "Escrow Foundations",
                    "startWeek": 1,
                    "endWeek": 2,
                    "sourcePhase": "Build",
                    "goals": ["Stand up escrow engine"],
                    "tasks": [
                        {"id": "t-1", "title": "Escrow state machine", "owner": "team",
                         "status": "planned", "notify": False}
                    ],
                    "deliverables": ["Payment ledger"],
                    "dependencies": [],
                }
            ],
        },
        "market": [
            {
                "title": "Escrow adoption in freelancing",
                "description": "Rising demand for protected payment flows.",
                "trend": "up",
                "relevance": 5,
            }
        ],
        "impact": [
            {
                "title": "Payment dispute reduction",
                "description": "Escrow lowers disputes and chargebacks.",
                "impact_score": 1,
                "category": "Revenue Growth",
            }
        ],
    }


def _numeric_fingerprint(p: Proposal) -> dict:
    return {
        "features": [(f.confidence, f.confidence_pct) for f in p.features],
        "risks": [r.severity for r in p.risks],
        "market": [m.relevance for m in p.market],
        "impact": [i.impact_score for i in p.impact],
    }


def test_llm_and_fallback_parity():
    """Same structure -> same numbers, whichever path built the Proposal.

    Fallback path: raw dict -> sanitize_and_patch_brief (which applies scoring).
    LLM path: raw dict -> sanitize (to get a valid structure) -> re-validate a
    fresh Proposal (as if returned by Gemini with junk numbers) -> apply scores.
    """
    raw = _sample_raw()

    fallback = sanitize_and_patch_brief(raw)

    # Simulate the LLM path: a schema-valid Proposal with fabricated numbers
    # that must be discarded and recomputed identically.
    llm_like_data = fallback.model_dump()
    for feat in llm_like_data["features"]:
        feat["confidence"] = "High"
        feat["confidence_pct"] = 100
    for risk in llm_like_data["risks"]:
        risk["severity"] = 1
    for m in llm_like_data["market"]:
        m["relevance"] = 100
    for i in llm_like_data["impact"]:
        i["impact_score"] = 100
    llm_proposal = apply_deterministic_scores(Proposal.model_validate(llm_like_data))

    assert _numeric_fingerprint(fallback) == _numeric_fingerprint(llm_proposal)
    print("  [ok] LLM path and fallback path produce identical numbers")


def test_scores_are_grounded_not_llm_values():
    """The absurd LLM numbers in the raw input never survive."""
    raw = _sample_raw()
    p = sanitize_and_patch_brief(raw)

    escrow, notif = p.features
    # High complexity, concrete approach, scheduled+linked, deps resolved.
    assert escrow.confidence_pct == 70
    assert escrow.confidence == "Medium"
    # Low complexity but approach too short and not in the plan.
    assert notif.confidence_pct == 85
    assert notif.confidence == "High"

    breach, creep = p.risks
    assert breach.severity == 65  # security(80) - strong mitigation(15)
    # Scope base 55; sanitizer injects a default (strong) mitigation -> -15.
    assert creep.severity == 40

    # Revenue base 85 + linkage ("payment"/"escrow" overlap features) +10.
    assert p.impact[0].impact_score == 95
    assert p.market[0].relevance == 90  # up(+20) + linkage("escrow"/"payment") +10
    print("  [ok] grounded scores replace fabricated LLM values")


def test_label_number_consistency_end_to_end():
    """Every feature's label matches its computed pct band on a real proposal."""
    p = sanitize_and_patch_brief(_sample_raw())
    for f in p.features:
        assert f.confidence == derive_confidence_label(f.confidence_pct)
    print("  [ok] end-to-end feature label/number consistency")


if __name__ == "__main__":
    print("AIE-10 grounded brief-parser scoring tests")
    test_confidence_pct_complexity_ordering()
    test_confidence_pct_grounding_bonuses()
    test_confidence_label_consistent_with_pct()
    test_severity_mitigation_strength()
    test_severity_category_weighting()
    test_severity_clamped()
    test_impact_score_category_and_linkage()
    test_relevance_trend_and_linkage()
    test_llm_and_fallback_parity()
    test_scores_are_grounded_not_llm_values()
    test_label_number_consistency_end_to_end()
    print("ALL BRIEF PARSER SCORING TESTS PASSED")
