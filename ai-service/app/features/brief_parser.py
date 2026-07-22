"""AI-001 — Semantic Brief Parsing.

Ports ``backend/src/skills/briefParser.ts``: convert an unstructured client brief
into a strict ``Proposal``. On any Gemini/validation error, fall back to
``sanitize_and_patch_brief`` so the API never hard-fails.
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any, List
from pydantic import ValidationError

from google.genai.errors import APIError
from ..config import get_settings
from ..llm.gemini import generate_structured
from ..schemas.proposal import Proposal, ParseBriefResponse
from ..features.fallback_logger import log_fallback


logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the lead architect and enterprise consultant for FixFlow AI.
Your task is to convert unstructured client briefs (chat transcripts, RFCs, RFPs) into high-fidelity technical proposals.

RULES:
1. Extract implicit/explicit specifications, SLAs, timeline constraints, budget figures, and dependencies.
2. Provide qualitative, defensible signals only: per-feature `complexity` (High/Medium/Low), each risk's `category` and a concrete `mitigation`, market `trend`, and impact `category`. Do NOT invent numeric scores. The service computes `confidence_pct`, `confidence` (label), `risk.severity`, `impact_score`, and `market.relevance` deterministically from the proposal structure — any numbers you emit for those fields are ignored placeholders and will be overwritten.
3. Keep feature counts realistic, drafting actionable, complete deliverables.
4. Output strict JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""


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

def _category_severity_base(category: str) -> int:
    c = (category or "").lower()
    if any(k in c for k in ("security", "compliance", "legal", "privacy", "data loss")):
        return 80
    if any(k in c for k in ("integration", "technical", "dependency", "architecture")):
        return 65
    if any(k in c for k in ("performance", "scalability", "reliability")):
        return 60
    if any(k in c for k in ("timeline", "schedule", "resource", "budget")):
        return 60
    if any(k in c for k in ("scope", "requirement")):
        return 55
    return 50


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

def _category_impact_base(category: str) -> int:
    c = (category or "").lower()
    if any(k in c for k in ("revenue", "growth", "financial", "sales", "market")):
        return 85
    if any(k in c for k in ("efficiency", "automation", "operational", "productivity", "cost")):
        return 75
    if any(k in c for k in ("risk", "compliance", "security")):
        return 70
    if any(k in c for k in ("experience", "ux", "satisfaction", "engagement")):
        return 65
    return 60


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

    for risk in proposal.risks:
        risk.severity = derive_severity(risk.category, risk.mitigation)

    for item in proposal.impact:
        linked = _text_linked_to_features(
            f"{item.title} {item.description}", feature_tokens
        )
        item.impact_score = derive_impact_score(item.category, linked)

    for item in proposal.market:
        linked = _text_linked_to_features(
            f"{item.title} {item.description}", feature_tokens
        )
        item.relevance = derive_relevance(item.trend, linked)

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
# Semantic ingest
# ---------------------------------------------------------------------------

async def parse_brief(brief_text: str) -> ParseBriefResponse:
    feature_name = "brief_parse"
    if not brief_text or not brief_text.strip():
        raise ValueError("Brief parsing failed: The incoming brief content is empty.")

    contents = (
        "Analyze the brief text below and output a complete project proposal "
        "conforming strictly to the requested schema.\n\n"
        f"Brief text:\n{brief_text}"
    )

    try:
        proposal = await generate_structured(
            system_instruction=SYSTEM_PROMPT,
            contents=contents,
            response_schema=Proposal,
            temperature=0.2,
            model=get_settings().gemini_proposal_model,
        )

        # Discard the LLM's fabricated numbers; derive them from grounded fields.
        proposal = apply_deterministic_scores(proposal)
        return ParseBriefResponse(proposal=proposal,
                                  source="llm",
                                  degradedReason=None)
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
        fallback = sanitize_and_patch_brief(raw_dict)
        return ParseBriefResponse(proposal=fallback,
                                  source="fallback",
                                  degradedReason=degraded_reason)
    except ValueError as value_error:
        log_fallback(feature_name, "empty_response", str(value_error))
        logger.info("Initiating fallback brief patch heuristics...")
        fallback = sanitize_and_patch_brief({})
        return ParseBriefResponse(proposal=fallback,
                                  source="fallback",
                                  degradedReason="empty_response")
    except APIError as api_error:
        reason = "gemini_error"
        if api_error.code in (401, 403):
            reason = "invalid_key"
        log_fallback(feature_name, reason, str(api_error))
        logger.info("Initiating fallback brief patch heuristics...")
        fallback = sanitize_and_patch_brief({})
        return ParseBriefResponse(proposal=fallback,
                                    source="fallback",
                                    degradedReason=reason)
    except Exception as error:  # noqa: BLE001 - deliberate broad fallback
        log_fallback(feature_name, "gemini_error", str(error))
        logger.info("Initiating fallback brief patch heuristics...")
        fallback = sanitize_and_patch_brief({})
        return ParseBriefResponse(proposal=fallback,
                                  source="fallback",
                                  degradedReason="gemini_error")
