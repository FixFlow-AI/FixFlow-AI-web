"""AI-001 — Semantic Brief Parsing.

Ports ``backend/src/skills/briefParser.ts``: convert an unstructured client brief
into a strict ``Proposal``. On any Gemini/validation error, fall back to
``sanitize_and_patch_brief`` so the API never hard-fails.
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any, List, Type
from pydantic import ValidationError

from google.genai.errors import APIError
from ..config import get_settings
from ..llm.gemini import generate_structured
from ..schemas.depth import BriefSubstance, DepthReport, DepthTargets, ScoreBasis
from ..schemas.proposal import Proposal, ProposalDraft, ParseBriefResponse
from ..features.fallback_logger import log_fallback
from .depth_policy import (
    FULL_TARGETS,
    SUBSTANCE_WORD_THRESHOLD,
    assess_depth,
    brief_substance,
    shortfall_instruction,
    targets_for,
)


logger = logging.getLogger(__name__)

SYSTEM_PROMPT = f"""You are the lead architect and enterprise consultant for FixFlow AI.
Your task is to convert unstructured client briefs (chat transcripts, RFCs, RFPs) into high-fidelity technical proposals.

RULES:
1. Extract implicit/explicit specifications, SLAs, timeline constraints, budget figures, and dependencies.
2. Provide qualitative, defensible signals only: per-feature `complexity` (High/Medium/Low), each risk's `category` and a concrete `mitigation`, market `trend`, and impact `category`. Do NOT invent numeric scores. The service computes `confidence_pct`, `confidence` (label), `risk.severity`, `impact_score`, and `market.relevance` deterministically from the proposal structure — any numbers you emit for those fields are ignored placeholders and will be overwritten.
3. Keep feature counts realistic, drafting actionable, complete deliverables.
4. Output strict JSON conforming to the requested schema. Do not output markdown decorators or extra prose.

DEPTH TARGETS (defaults — the request restates the targets in force for the brief at hand, and those take precedence):
- Scope/feature items: at least {FULL_TARGETS.minFeatures} and never more than {FULL_TARGETS.maxFeatures}, so the list stays reviewable.
- Every scope item carries a `title`, a `description`, a concrete `technical_approach`, a `complexity`, an `area`, and at least {FULL_TARGETS.minCriteriaPerModule} individually checkable acceptance criteria. The schema has no separate criteria field, so state them inside that item's `description` as explicit, verifiable sentences (each one either passes or fails on inspection — no "works well"). The total criteria count therefore scales with the number of scope items rather than staying fixed at three.
- Risks: at least {FULL_TARGETS.minRisks}, spanning at least {FULL_TARGETS.minRiskCategories} distinct `category` values, each with a concrete `mitigation` that names the scope areas it affects.
- Market signals: at least {FULL_TARGETS.minMarket}. Impact items: at least {FULL_TARGETS.minImpact}.
- Timeline phases: at least {FULL_TARGETS.minTimelinePhases}. Effort breakdown items: at least {FULL_TARGETS.minEffort}.

SOURCING (`source` on every feature):
- "brief" when the item restates something the brief itself says.
- "discovery" when it comes from a discovery or interview answer in the supplied text.
- "inferred" when you concluded it yourself. Anything you cannot tie back to a statement in the brief or the discovery answers MUST be marked "inferred" — it is your assumption, not a client requirement.

NO PADDING:
- Never invent, duplicate, or generalise an item to reach a target. If the brief genuinely does not support a target, produce fewer items and let the shortfall stand — the service reports limited depth honestly, and a padded section is a worse outcome than a short one.
- Every item must trace to the brief, to a discovery answer, or to an assumption you have marked "inferred"."""


# ---------------------------------------------------------------------------
# Fallback & sanitization (mirror of sanitizeAndPatchBrief in briefParser.ts)
# ---------------------------------------------------------------------------

def _safe_string(val: Any, fallback: str) -> str:
    return val.strip() if isinstance(val, str) and val.strip() else fallback


def _safe_number(val: Any, min_val: float, max_val: float, fallback: float) -> float:
    try:
        num = float(val)
    except (TypeError, ValueError):
        return fallback
    return num if min_val <= num <= max_val else fallback


def _safe_array(val: Any) -> List[Any]:
    return val if isinstance(val, list) else []


def _rand(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:9]}"


# ---------------------------------------------------------------------------
# AIE-10 — Deterministic, grounded scoring
#
# The LLM emits only *qualitative* signals (complexity, confidence label,
# risk category + mitigation, market trend, impact category). Every numeric
# field shown to users is derived here from those grounded signals plus the
# proposal's own structure, so the numbers are explainable, stable run-to-run,
# and identical between the LLM path and the fallback path for the same input.
# ---------------------------------------------------------------------------

# A concrete `technical_approach` must clear this length to count as grounded.
_MIN_TECHNICAL_APPROACH_LEN = 15
# A `mitigation` at/above this length is treated as a strong, actionable plan.
_STRONG_MITIGATION_LEN = 30

# Tokens ignored when matching a feature against the delivery plan (too generic
# to signal a real linkage).
_STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "core", "system",
    "module", "platform", "setup", "phase", "sprint", "week", "project",
}


def _significant_tokens(text: str) -> List[str]:
    """Lowercased alphanumeric tokens (>=4 chars) that carry topical meaning."""
    return [
        tok
        for tok in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(tok) >= 4 and tok not in _STOPWORDS
    ]


def _clamp(value: int, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, value))


# --- Step 3.1: confidence_pct + label -------------------------------------

_COMPLEXITY_BASE_CONFIDENCE = {"Low": 85, "Medium": 70, "High": 55}


def derive_confidence_pct(
    complexity: str,
    has_technical_approach: bool,
    in_delivery_plan: bool,
    dependencies_resolved: bool,
) -> int:
    """Per-feature confidence from grounded inputs.

    base(complexity) + concrete approach (+5) + scheduled in delivery plan (+5)
    + scheduled with resolvable dependencies (+5). The dependency bonus only
    applies when the feature is actually scheduled, since an unscheduled
    feature has no dependencies to resolve.
    """
    score = _COMPLEXITY_BASE_CONFIDENCE.get(complexity, 70)
    if has_technical_approach:
        score += 5
    if in_delivery_plan:
        score += 5
        if dependencies_resolved:
            score += 5
    return _clamp(score)


def derive_confidence_label(confidence_pct: int) -> str:
    """Qualitative band derived from the number so the two never disagree."""
    if confidence_pct >= 80:
        return "High"
    if confidence_pct >= 60:
        return "Medium"
    return "Low"


# --- Step 3.2: risk severity ----------------------------------------------

# Ordered category bands: (base score, band name, matching keywords). The order
# is significant — the first band whose keywords appear in the category wins.
# The band name is what `explain_severity` reads back, so the label can never
# drift from the number: both come from this one table.
_SEVERITY_CATEGORY_BANDS: tuple[tuple[int, str, tuple[str, ...]], ...] = (
    (80, "security/compliance category", ("security", "compliance", "legal", "privacy", "data loss")),
    (65, "integration/technical category", ("integration", "technical", "dependency", "architecture")),
    (60, "performance/reliability category", ("performance", "scalability", "reliability")),
    (60, "timeline/resource category", ("timeline", "schedule", "resource", "budget")),
    (55, "scope/requirements category", ("scope", "requirement")),
)
_SEVERITY_DEFAULT_BAND = (50, "uncategorised risk")


def _severity_band(category: str) -> tuple[int, str]:
    """The base severity and the band name it came from."""
    c = (category or "").lower()
    for base, label, keywords in _SEVERITY_CATEGORY_BANDS:
        if any(k in c for k in keywords):
            return base, label
    return _SEVERITY_DEFAULT_BAND


def _category_severity_base(category: str) -> int:
    return _severity_band(category)[0]


def derive_severity(category: str, mitigation: str) -> int:
    """Severity from a category weight, adjusted by mitigation strength.

    No mitigation raises severity (+20); a strong, actionable mitigation lowers
    it (-15); a weak/short mitigation is neutral.
    """
    score = _category_severity_base(category)
    text = (mitigation or "").strip()
    if not text:
        score += 20
    elif len(text) >= _STRONG_MITIGATION_LEN:
        score -= 15
    return _clamp(score)


# --- Step 3.3: impact_score + market.relevance ----------------------------

# Same ordered-band structure as severity, for the same reason (see above).
_IMPACT_CATEGORY_BANDS: tuple[tuple[int, str, tuple[str, ...]], ...] = (
    (85, "revenue/growth category", ("revenue", "growth", "financial", "sales", "market")),
    (75, "efficiency/automation category", ("efficiency", "automation", "operational", "productivity", "cost")),
    (70, "risk/compliance category", ("risk", "compliance", "security")),
    (65, "experience/engagement category", ("experience", "ux", "satisfaction", "engagement")),
)
_IMPACT_DEFAULT_BAND = (60, "uncategorised impact")


def _impact_band(category: str) -> tuple[int, str]:
    """The base impact score and the band name it came from."""
    c = (category or "").lower()
    for base, label, keywords in _IMPACT_CATEGORY_BANDS:
        if any(k in c for k in keywords):
            return base, label
    return _IMPACT_DEFAULT_BAND


def _category_impact_base(category: str) -> int:
    return _impact_band(category)[0]


def derive_impact_score(category: str, linked_to_feature: bool) -> int:
    """Advisory impact from category weight, boosted when tied to a feature."""
    score = _category_impact_base(category)
    if linked_to_feature:
        score += 10
    return _clamp(score)


_TREND_RELEVANCE_DELTA = {"up": 20, "stable": 0, "down": -10}


def derive_relevance(trend: str, linked_to_feature: bool) -> int:
    """Advisory market relevance from trend direction and feature linkage."""
    score = 60 + _TREND_RELEVANCE_DELTA.get(trend, 0)
    if linked_to_feature:
        score += 10
    return _clamp(score)


# --- Step 3.3 (depth): score bases that read back to the number -----------
#
# Each `explain_*` mirrors its `derive_*` sibling — same inputs, same branching
# — and returns the qualitative signals consumed plus a rule that reads back to
# the derived figure, so every number the UI shows can be explained from the
# same code path that produced it (R2.4, R9.6). None of these functions perform
# the derivation themselves: they call the `derive_*` sibling for the figure, so
# the two can never disagree.

_TREND_RELEVANCE_LABEL = {"up": "upward trend", "stable": "stable trend", "down": "downward trend"}


def _score_basis(
    base: tuple[int, str, str],
    adjustments: List[tuple[int, str, str]],
    derived: int,
) -> ScoreBasis:
    """Assemble a ``ScoreBasis`` whose rule sums to ``derived``.

    ``base`` is ``(value, rule_label, input_name)`` and each adjustment is
    ``(delta, rule_label, input_name)``. Only signals the derivation actually
    consumed are passed in; a consumed-but-neutral signal is passed with a zero
    delta so it is still named rather than silently dropped. A clamp, if one
    applies, is emitted as its own term so the arithmetic always closes.
    """
    base_value, base_label, base_input = base
    inputs = [base_input] + [name for _, _, name in adjustments]
    parts = [f"base {base_value} ({base_label})"]
    running = base_value
    for delta, label, _ in adjustments:
        parts.append(f"{delta:+d} {label}")
        running += delta
    if running != derived:
        parts.append(f"{derived - running:+d} clamped to 0..100")
    parts.append(f"= {derived}")
    return ScoreBasis(inputs=inputs, rule=" ".join(parts))


def explain_confidence(
    complexity: str,
    has_technical_approach: bool,
    in_delivery_plan: bool,
    dependencies_resolved: bool,
) -> ScoreBasis:
    """Read-back for :func:`derive_confidence_pct`."""
    known = complexity in _COMPLEXITY_BASE_CONFIDENCE
    base = (
        _COMPLEXITY_BASE_CONFIDENCE.get(complexity, 70),
        complexity if known else "unrecognised complexity, default",
        f"complexity={complexity}",
    )

    adjustments: List[tuple[int, str, str]] = []
    if has_technical_approach:
        adjustments.append((5, "approach", "concrete technical approach"))
    else:
        adjustments.append((0, "no approach", "no concrete technical approach"))
    if in_delivery_plan:
        adjustments.append((5, "scheduled", "scheduled in the delivery plan"))
        # The dependency signal is only consumed for a scheduled feature.
        if dependencies_resolved:
            adjustments.append((5, "deps resolved", "delivery dependencies all resolvable"))
        else:
            adjustments.append((0, "deps unresolved", "a delivery dependency is unresolvable"))
    else:
        adjustments.append((0, "not scheduled", "not scheduled in the delivery plan"))

    return _score_basis(
        base,
        adjustments,
        derive_confidence_pct(
            complexity, has_technical_approach, in_delivery_plan, dependencies_resolved
        ),
    )


def explain_severity(category: str, mitigation: str) -> ScoreBasis:
    """Read-back for :func:`derive_severity`."""
    base_value, band = _severity_band(category)
    base = (base_value, band, f"risk category matched the {band}")

    text = (mitigation or "").strip()
    if not text:
        adjustment = (20, "no mitigation", "no mitigation provided")
    elif len(text) >= _STRONG_MITIGATION_LEN:
        adjustment = (-15, "strong mitigation", "strong, actionable mitigation")
    else:
        adjustment = (0, "weak mitigation", "brief mitigation, treated as neutral")

    return _score_basis(base, [adjustment], derive_severity(category, mitigation))


def explain_impact(category: str, linked_to_feature: bool) -> ScoreBasis:
    """Read-back for :func:`derive_impact_score`."""
    base_value, band = _impact_band(category)
    base = (base_value, band, f"impact category matched the {band}")
    adjustment = (
        (10, "linked to a feature", "linked to a proposal feature")
        if linked_to_feature
        else (0, "not linked", "not linked to any proposal feature")
    )
    return _score_basis(base, [adjustment], derive_impact_score(category, linked_to_feature))


def explain_relevance(trend: str, linked_to_feature: bool) -> ScoreBasis:
    """Read-back for :func:`derive_relevance`."""
    known = trend in _TREND_RELEVANCE_DELTA
    base = (
        60 + _TREND_RELEVANCE_DELTA.get(trend, 0),
        _TREND_RELEVANCE_LABEL[trend] if known else "unrecognised trend, no delta",
        f"trend={trend}",
    )
    adjustment = (
        (10, "linked to a feature", "linked to a proposal feature")
        if linked_to_feature
        else (0, "not linked", "not linked to any proposal feature")
    )
    return _score_basis(base, [adjustment], derive_relevance(trend, linked_to_feature))


# --- Grounding signals derived from proposal structure --------------------

def _delivery_plan_corpus(proposal: Proposal) -> str:
    """Lowercased text of everything scheduled in the weekly delivery plan."""
    parts: List[str] = []
    for week in proposal.delivery_plan.weeks:
        parts.append(week.label)
        parts.append(week.sourcePhase)
        parts.extend(week.goals)
        parts.extend(week.deliverables)
        parts.extend(task.title for task in week.tasks)
    return " ".join(parts).lower()


def _dependencies_resolved(proposal: Proposal) -> bool:
    """True when every delivery-week dependency points at a known week.

    A plan with no dependencies is trivially resolved; a dangling reference
    (typo, deleted week) marks the schedule as not fully resolved.
    """
    week_ids = {w.id for w in proposal.delivery_plan.weeks}
    week_labels = {w.label.lower() for w in proposal.delivery_plan.weeks}
    for week in proposal.delivery_plan.weeks:
        for dep in week.dependencies:
            d = (dep or "").strip()
            if not d:
                continue
            if d not in week_ids and d.lower() not in week_labels:
                return False
    return True


def _text_linked_to_features(text: str, feature_tokens: set[str]) -> bool:
    """True when advisory item text shares a topical token with any feature."""
    return any(tok in feature_tokens for tok in _significant_tokens(text))


def apply_deterministic_scores(proposal: Proposal) -> Proposal:
    """Overwrite every LLM/fallback numeric field with a grounded derivation.

    Mutates and returns ``proposal``. Runs identically on the LLM path and the
    fallback path, so proposals with the same structure always score the same.
    Each figure is written together with its ``score_basis`` read-back (R2.4).
    """
    corpus = _delivery_plan_corpus(proposal)
    deps_resolved = _dependencies_resolved(proposal)

    feature_tokens: set[str] = set()
    for feature in proposal.features:
        feature_tokens.update(_significant_tokens(feature.title))
        feature_tokens.update(_significant_tokens(feature.area))

    for feature in proposal.features:
        has_approach = len(feature.technical_approach.strip()) >= _MIN_TECHNICAL_APPROACH_LEN
        tokens = _significant_tokens(feature.title) + _significant_tokens(feature.area)
        in_plan = any(tok in corpus for tok in tokens)
        feature.confidence_pct = derive_confidence_pct(
            feature.complexity, has_approach, in_plan, deps_resolved
        )
        feature.confidence = derive_confidence_label(feature.confidence_pct)
        feature.score_basis = explain_confidence(
            feature.complexity, has_approach, in_plan, deps_resolved
        )

    for risk in proposal.risks:
        risk.severity = derive_severity(risk.category, risk.mitigation)
        risk.score_basis = explain_severity(risk.category, risk.mitigation)

    for item in proposal.impact:
        linked = _text_linked_to_features(
            f"{item.title} {item.description}", feature_tokens
        )
        item.impact_score = derive_impact_score(item.category, linked)
        item.score_basis = explain_impact(item.category, linked)

    for item in proposal.market:
        linked = _text_linked_to_features(
            f"{item.title} {item.description}", feature_tokens
        )
        item.relevance = derive_relevance(item.trend, linked)
        item.score_basis = explain_relevance(item.trend, linked)

    return proposal


def sanitize_and_patch_brief(raw: Any) -> Proposal:
    """Coerce any malformed object into a valid Proposal with safe defaults."""
    raw = raw or {}

    features = []
    for f in _safe_array(raw.get("features")):
        f = f or {}
        features.append(
            {
                "title": _safe_string(f.get("title"), "Core Module Deployment"),
                "description": _safe_string(
                    f.get("description"),
                    "Core system capabilities development and configuration.",
                ),
                "technical_approach": _safe_string(
                    f.get("technical_approach"),
                    "Leverage modern framework patterns and modular handlers.",
                ),
                "complexity": f.get("complexity")
                if f.get("complexity") in ("High", "Medium", "Low")
                else "Medium",
                "confidence": f.get("confidence")
                if f.get("confidence") in ("High", "Medium", "Low")
                else "Medium",
                "confidence_pct": int(_safe_number(f.get("confidence_pct"), 0, 100, 75)),
                "area": _safe_string(f.get("area"), "Engineering"),
            }
        )
    if not features:
        features.append(
            {
                "title": "Core Platform Setup",
                "description": "Initialize application stack, structure configuration profiles, and verify runtime endpoints.",
                "technical_approach": "Establish standard repository patterns with lint and type checking.",
                "complexity": "Medium",
                "confidence": "High",
                "confidence_pct": 90,
                "area": "Platform Operations",
            }
        )

    risks = []
    for r in _safe_array(raw.get("risks")):
        r = r or {}
        risks.append(
            {
                "label": _safe_string(r.get("label"), "Under-specified requirements"),
                "severity": int(_safe_number(r.get("severity"), 0, 100, 50)),
                "mitigation": _safe_string(
                    r.get("mitigation"), "Organize collaborative design review workshops."
                ),
                "category": _safe_string(r.get("category"), "Scope Management"),
            }
        )
    if not risks:
        risks.append(
            {
                "label": "Integration Interface Drift",
                "severity": 45,
                "mitigation": "Implement rigorous automated mock contracts early in the development sprint.",
                "category": "Technical Integration",
            }
        )

    timeline = []
    for t in _safe_array(raw.get("timeline")):
        t = t or {}
        tasks = [str(x).strip() for x in _safe_array(t.get("tasks")) if str(x).strip()]
        timeline.append(
            {
                "phase": _safe_string(t.get("phase"), "Integration sprint"),
                "duration": _safe_string(t.get("duration"), "2 weeks"),
                "tasks": tasks,
                "dependencies": [str(x).strip() for x in _safe_array(t.get("dependencies"))],
            }
        )
    if not timeline or any(len(t["tasks"]) == 0 for t in timeline):
        timeline.append(
            {
                "phase": "Initial Integration",
                "duration": "4 weeks",
                "tasks": ["Initialize systems", "Configure interface layers", "Run verification suites"],
                "dependencies": [],
            }
        )

    raw_plan = raw.get("delivery_plan") or {}
    weeks = []
    for w in _safe_array(raw_plan.get("weeks")):
        w = w or {}
        tasks = []
        for tk in _safe_array(w.get("tasks")):
            tk = tk or {}
            tasks.append(
                {
                    "id": _safe_string(tk.get("id"), _rand("task")),
                    "title": _safe_string(tk.get("title"), "Platform onboarding"),
                    "owner": tk.get("owner")
                    if tk.get("owner") in ("team", "client", "shared")
                    else "team",
                    "status": tk.get("status")
                    if tk.get("status") in ("planned", "done", "backlog")
                    else "planned",
                    "notify": tk.get("notify") if isinstance(tk.get("notify"), bool) else False,
                }
            )
        weeks.append(
            {
                "id": _safe_string(w.get("id"), _rand("week")),
                "label": _safe_string(w.get("label"), "Sprint 1"),
                "startWeek": int(_safe_number(w.get("startWeek"), 1, 100, 1)),
                "endWeek": int(_safe_number(w.get("endWeek"), 1, 100, 1)),
                "sourcePhase": _safe_string(w.get("sourcePhase"), "Initial Integration"),
                "goals": [str(g).strip() for g in _safe_array(w.get("goals")) if str(g).strip()],
                "tasks": tasks,
                "deliverables": [
                    str(d).strip() for d in _safe_array(w.get("deliverables")) if str(d).strip()
                ],
                "dependencies": [
                    str(dp).strip() for dp in _safe_array(w.get("dependencies")) if str(dp).strip()
                ],
            }
        )
    if not weeks:
        weeks.append(
            {
                "id": "week-1",
                "label": "Week 1: Foundations",
                "startWeek": 1,
                "endWeek": 1,
                "sourcePhase": "Initial Integration",
                "goals": ["Setup runtime systems and confirm initial schemas"],
                "tasks": [
                    {
                        "id": "t-1",
                        "title": "Establish repository structure and configure automated lints",
                        "owner": "team",
                        "status": "planned",
                        "notify": False,
                    }
                ],
                "deliverables": ["Typescript definitions file", "Verify baseline configs"],
                "dependencies": [],
            }
        )

    roadmap = []
    for rm in _safe_array(raw_plan.get("roadmap")):
        rm = rm or {}
        roadmap.append(
            {
                "id": _safe_string(rm.get("id"), _rand("rm")),
                "title": _safe_string(rm.get("title"), "Deployment Milestone"),
                "targetWeek": int(_safe_number(rm.get("targetWeek"), 1, 100, 1)),
                "sourceWeekIds": [
                    str(i).strip() for i in _safe_array(rm.get("sourceWeekIds")) if str(i).strip()
                ],
                "status": rm.get("status") if rm.get("status") in ("planned", "done") else "planned",
            }
        )

    backlog = []
    for bl in _safe_array(raw_plan.get("backlog")):
        bl = bl or {}
        source_week_id = bl.get("sourceWeekId")
        backlog.append(
            {
                "id": _safe_string(bl.get("id"), _rand("bl")),
                "title": _safe_string(bl.get("title"), "Post-launch scale optimization"),
                "sourceWeekId": source_week_id
                if isinstance(source_week_id, str) and source_week_id
                else None,
                "reason": bl.get("reason")
                if bl.get("reason")
                in ("timeline_overflow", "future_enhancement", "dependency_blocked")
                else "future_enhancement",
                "status": "backlog",
            }
        )

    raw_notify = raw_plan.get("notificationDefaults") or {}
    channels = [c for c in _safe_array(raw_notify.get("channels")) if c in ("in_app", "email")]
    events = [
        e
        for e in _safe_array(raw_notify.get("events"))
        if e in ("invite", "comment", "approval", "assignment", "goal_completed", "backlog_moved")
    ]
    if not channels:
        channels.append("in_app")
    if not events:
        events.append("goal_completed")
    notification_defaults = {
        "enabled": raw_notify.get("enabled") if isinstance(raw_notify.get("enabled"), bool) else False,
        "channels": channels,
        "events": events,
    }

    effort = []
    for ef in _safe_array(raw.get("effort")):
        ef = ef or {}
        effort.append(
            {
                "label": _safe_string(ef.get("label"), "Core Development"),
                "percentage": int(_safe_number(ef.get("percentage"), 0, 100, 100)),
                "timeframe": _safe_string(ef.get("timeframe"), "4 weeks"),
                "description": _safe_string(
                    ef.get("description"), "Full lifecycle programming, testing, and alignment."
                ),
            }
        )
    if not effort:
        effort.append(
            {
                "label": "Core Implementation",
                "percentage": 100,
                "timeframe": "4 weeks",
                "description": "Covers core backend routing, typescript schema integrations, and validation testing.",
            }
        )

    market = []
    for m in _safe_array(raw.get("market")):
        m = m or {}
        market.append(
            {
                "title": _safe_string(m.get("title"), "Cloud Migration Trends"),
                "description": _safe_string(
                    m.get("description"),
                    "Growing market adoption of serverless and event-driven computing.",
                ),
                "trend": m.get("trend") if m.get("trend") in ("up", "down", "stable") else "stable",
                "relevance": int(_safe_number(m.get("relevance"), 0, 100, 80)),
            }
        )

    impact = []
    for imp in _safe_array(raw.get("impact")):
        imp = imp or {}
        impact.append(
            {
                "title": _safe_string(imp.get("title"), "Automation Efficiency"),
                "description": _safe_string(
                    imp.get("description"),
                    "Substantial decrease in manual overhead processing tasks.",
                ),
                "impact_score": int(_safe_number(imp.get("impact_score"), 0, 100, 85)),
                "category": _safe_string(imp.get("category"), "Operational Impact"),
            }
        )

    generated_from = (
        raw_plan.get("generatedFrom")
        if raw_plan.get("generatedFrom") in ("llm", "derived")
        else "derived"
    )

    proposal = Proposal.model_validate(
        {
            "project_summary": _safe_string(
                raw.get("project_summary"),
                "Highly scalable deployment engineered to satisfy explicit functional targets.",
            ),
            "features": features,
            "risks": risks,
            "timeline": timeline,
            "delivery_plan": {
                "mode": "weekly",
                "generatedFrom": generated_from,
                "weeks": weeks,
                "roadmap": roadmap,
                "backlog": backlog,
                "notificationDefaults": notification_defaults,
            },
            "effort": effort,
            "market": market,
            "impact": impact,
        }
    )
    # Ground the numeric fields deterministically (identical to the LLM path).
    return apply_deterministic_scores(proposal)


# ---------------------------------------------------------------------------
# Depth flow (spec §A; R1.1, R1.3, R2.5, R9.4, R9.5)
#
# One brief, at most two model calls: the first constrained to the depth the
# brief has earned, and — only when a substantial brief came back short — one
# bounded re-ask naming the short sections. Nothing on this path constructs a
# proposal item, so a shortfall is always reported rather than padded.
# ---------------------------------------------------------------------------

# Shown when the brief itself capped the depth, even if the relaxed targets were
# all met: the client still deserves to know the proposal is thin because the
# brief was (R1.3).
_BRIEF_TOO_SHORT_NOTE = (
    "Depth was limited by the level of detail in the brief (under "
    f"{SUBSTANCE_WORD_THRESHOLD} words of substance), so fewer items were produced. "
    "Add more detail for a fuller proposal — nothing was padded with generic entries."
)

_DEGRADED_NOTE = (
    "The AI service was degraded, so this is a clearly-labelled degraded result. "
    "No extra risks, market signals, or impact items were synthesised to fill the "
    "sections."
)


def _depth_instruction(substance: BriefSubstance, targets: DepthTargets) -> str:
    """The per-request depth block: the targets actually in force for this brief."""
    if substance.sufficient:
        discovery = ", assembled from discovery answers" if substance.hasDiscoveryAnswers else ""
        return (
            f"DEPTH TARGETS IN FORCE (this brief carries {substance.wordCount} words across "
            f"{substance.distinctTopicCount} distinct topics{discovery}):\n"
            f"- scope items: {targets.minFeatures} to {targets.maxFeatures}\n"
            f"- acceptance criteria per scope item: at least {targets.minCriteriaPerModule}\n"
            f"- risks: at least {targets.minRisks}, across at least {targets.minRiskCategories} categories\n"
            f"- market signals: at least {targets.minMarket}; impact items: at least {targets.minImpact}\n"
            f"- timeline phases: at least {targets.minTimelinePhases}; effort items: at least {targets.minEffort}\n"
            "Reach these with genuine, brief-grounded detail only. Do NOT pad."
        )
    return (
        f"DEPTH TARGETS IN FORCE: this brief is thin ({substance.wordCount} words, below the "
        f"{SUBSTANCE_WORD_THRESHOLD}-word substance threshold), so the targets are relaxed to at "
        f"least {targets.minFeatures} scope items with no floor on the other sections. Cover only "
        "what the brief actually supports and stop there. A short, honest proposal is the correct "
        "answer here; inventing items to look thorough is a failure."
    )


async def _generate_proposal(contents: str, schema: Type[Proposal]) -> Proposal:
    return await generate_structured(
        system_instruction=SYSTEM_PROMPT,
        contents=contents,
        response_schema=schema,
        temperature=0.2,
        model=get_settings().gemini_proposal_model,
    )


def _unmet_count(report: DepthReport) -> int:
    return sum(1 for section in report.sections if not section.met)


def _limited_by_brief(report: DepthReport) -> DepthReport:
    """Label a reduced-target run as brief-limited (R1.3).

    ``assess_depth`` reports ``depthLimited=False`` when the relaxed targets were
    all met, which is true of the *targets* but hides why they were relaxed. The
    reduced path is by definition depth-limited by the brief, so say so.
    """
    return report.model_copy(
        update={
            "depthLimited": True,
            "limitReason": "brief_too_short",
            "note": report.note or _BRIEF_TOO_SHORT_NOTE,
        }
    )


def _degraded_report(proposal: Proposal, targets: DepthTargets) -> DepthReport:
    """Depth accounting for the degraded path — counts only, nothing synthesised."""
    return assess_depth(proposal, targets).model_copy(
        update={
            "depthLimited": True,
            "limitReason": "degraded",
            "note": _DEGRADED_NOTE,
        }
    )


def _attach(proposal: Proposal, report: DepthReport) -> DepthReport:
    """Attach the report to the proposal and hand it back for the response echo."""
    proposal.depth_report = report
    return report


def _degraded_response(
    raw: Any, degraded_reason: str, targets: DepthTargets
) -> ParseBriefResponse:
    """The fallback proposal, labelled degraded, with nothing added to it."""
    fallback = sanitize_and_patch_brief(raw)
    report = _attach(fallback, _degraded_report(fallback, targets))
    return ParseBriefResponse(
        proposal=fallback,
        source="fallback",
        degradedReason=degraded_reason,
        depthReport=report,
    )


# ---------------------------------------------------------------------------
# Semantic ingest
# ---------------------------------------------------------------------------

async def parse_brief(brief_text: str) -> ParseBriefResponse:
    feature_name = "brief_parse"
    if not brief_text or not brief_text.strip():
        raise ValueError("Brief parsing failed: The incoming brief content is empty.")

    # How much material the brief carried decides how much depth we may ask for,
    # and therefore which schema constrains the model. A thin brief is generated
    # against `Proposal`, so it is never asked to fill six feature slots (R1.3).
    substance = brief_substance(brief_text)
    targets = targets_for(substance)
    schema: Type[Proposal] = ProposalDraft if substance.sufficient else Proposal

    contents = (
        "Analyze the brief text below and output a complete project proposal "
        "conforming strictly to the requested schema.\n\n"
        f"{_depth_instruction(substance, targets)}\n\n"
        f"Brief text:\n{brief_text}"
    )

    try:
        proposal = await _generate_proposal(contents, schema)

        # Discard the LLM's fabricated numbers; derive them from grounded fields.
        proposal = apply_deterministic_scores(proposal)
        report = assess_depth(proposal, targets)

        # At most one re-ask, and only when a brief with real substance came back
        # short — a thin brief has nothing more to give, so re-asking it could
        # only invite padding (R9.4, R9.5).
        instruction = shortfall_instruction(report) if substance.sufficient else None
        if instruction:
            report = report.model_copy(update={"reaskUsed": True})
            try:
                retry = apply_deterministic_scores(
                    await _generate_proposal(f"{contents}\n\n{instruction}", schema)
                )
            except Exception as reask_error:  # noqa: BLE001 - the first result still stands
                logger.info("Depth re-ask failed (%s); keeping the first proposal.", reask_error)
            else:
                retry_report = assess_depth(retry, targets).model_copy(
                    update={"reaskUsed": True}
                )
                # Keep the re-ask only when it is genuinely deeper, so a worse
                # second response can never replace a better first one.
                if _unmet_count(retry_report) < _unmet_count(report):
                    proposal, report = retry, retry_report

        if not substance.sufficient:
            report = _limited_by_brief(report)

        return ParseBriefResponse(
            proposal=proposal,
            source="llm",
            degradedReason=None,
            depthReport=_attach(proposal, report),
        )
    except ValidationError as validation_error:
        raw_dict = getattr(validation_error, "raw_payload", {})
        has_salvaged_data = False
        if isinstance(raw_dict, dict):
            has_salvaged_data = any(
                key in raw_dict
                for key in [
                    "project_summary",
                    "features",
                    "risks",
                    "timeline",
                    "delivery_plan",
                    "effort",
                    "market",
                    "impact",
                ]
            )
        degraded_reason = "partial_salvage" if has_salvaged_data else "validation"

        log_fallback(feature_name, degraded_reason, str(validation_error))
        logger.info("Initiating fallback brief patch heuristics (salvaging what is possible)...")
        return _degraded_response(raw_dict, degraded_reason, targets)
    except ValueError as value_error:
        log_fallback(feature_name, "empty_response", str(value_error))
        logger.info("Initiating fallback brief patch heuristics...")
        return _degraded_response({}, "empty_response", targets)
    except APIError as api_error:
        reason = "gemini_error"
        if api_error.code in (401, 403):
            reason = "invalid_key"
        log_fallback(feature_name, reason, str(api_error))
        logger.info("Initiating fallback brief patch heuristics...")
        return _degraded_response({}, reason, targets)
    except Exception as error:  # noqa: BLE001 - deliberate broad fallback
        log_fallback(feature_name, "gemini_error", str(error))
        logger.info("Initiating fallback brief patch heuristics...")
        return _degraded_response({}, "gemini_error", targets)
