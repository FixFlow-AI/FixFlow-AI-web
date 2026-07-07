"""AI-001 — Semantic Brief Parsing.

Ports ``backend/src/skills/briefParser.ts``: convert an unstructured client brief
into a strict ``Proposal``. On any Gemini/validation error, fall back to
``sanitize_and_patch_brief`` so the API never hard-fails.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, List

from ..llm.gemini import generate_structured
from ..schemas.proposal import Proposal
from ..main import ParseBriefResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the lead architect and enterprise consultant for FixFlow AI.
Your task is to convert unstructured client briefs (chat transcripts, RFCs, RFPs) into high-fidelity technical proposals.

RULES:
1. Extract implicit/explicit specifications, SLAs, timeline constraints, budget figures, and dependencies.
2. Formulate realistic confidence indices and identify crucial development complexity cards.
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

    return Proposal.model_validate(
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


# ---------------------------------------------------------------------------
# Semantic ingest
# ---------------------------------------------------------------------------

async def parse_brief(brief_text: str) -> ParseBriefResponse:
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
        )
        return ParseBriefResponse(proposal=proposal, source="llm", degradedReason=None)
    except Exception as error:  # noqa: BLE001 - deliberate broad fallback
        logger.error("CRITICAL: Semantic Brief Parsing Exception: %s", error)
        logger.info("Initiating fallback brief patch heuristics...")
        fallback = sanitize_and_patch_brief({})
        return ParseBriefResponse(proposal=fallback, source="fallback", degradedReason="gemini_error")
