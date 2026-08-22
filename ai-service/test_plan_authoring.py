"""Unit tests for the plan authoring pass (task 6.1).

The contract under test is narrow but load-bearing: ``author_plan_draft`` is one
bounded Gemini call that must NEVER raise into the request path. A missing key, a
hang, a transport error, or an invalid draft all resolve to ``None`` so the
caller can fall back to its deterministic baseline plan.
"""
from __future__ import annotations

import asyncio
from contextlib import contextmanager

from app.config import get_settings
from app.features import plan_authoring as pa
from app.schemas.plan_draft import PlanAuthoringDraft
from app.schemas.proposal import Proposal


def sample_proposal() -> Proposal:
    return Proposal.model_validate({
        "project_summary": "Build a scheduling app for clinics.",
        "features": [{
            "title": "Appointment booking",
            "description": "Patients book and reschedule slots.",
            "technical_approach": "REST API over a Postgres slot table with row locks.",
            "complexity": "High",
            "confidence": "Medium",
            "confidence_pct": 70,
            "area": "Backend",
        }],
        "risks": [{
            "label": "Double-booking under concurrency",
            "severity": 65,
            "mitigation": "Serialise slot writes with a database-level unique constraint.",
            "category": "Technical Integration",
        }],
        "timeline": [{
            "phase": "Core booking",
            "duration": "3 weeks",
            "tasks": ["Model slots", "Build booking API"],
            "dependencies": [],
        }],
        "delivery_plan": {
            "mode": "weekly",
            "generatedFrom": "derived",
            "weeks": [{
                "id": "week-1",
                "label": "Week 1",
                "startWeek": 1,
                "endWeek": 3,
                "sourcePhase": "Core booking",
                "goals": ["Slot model in place"],
                "tasks": [{
                    "id": "t-1",
                    "title": "Model slots",
                    "owner": "team",
                    "status": "planned",
                    "notify": False,
                }],
                "deliverables": ["Slot schema"],
                "dependencies": [],
            }],
            "roadmap": [],
            "backlog": [],
            "notificationDefaults": {
                "enabled": False,
                "channels": ["in_app"],
                "events": ["goal_completed"],
            },
        },
        "effort": [{
            "label": "Core Implementation",
            "percentage": 100,
            "timeframe": "3 weeks",
            "description": "Booking API, schema, and tests.",
        }],
        "market": [],
        "impact": [],
    })


def sample_draft() -> PlanAuthoringDraft:
    return PlanAuthoringDraft.model_validate({
        "summary": "Deliver clinic scheduling in three weeks.",
        "requirements": [{"key": "req-booking", "statement": "Patients can book a slot."}],
        "scopeModules": [{
            "key": "mod-booking",
            "name": "Booking",
            "businessObjective": "Let patients self-serve appointments.",
            "outOfScope": ["Payments"],
            "acceptanceCriteria": ["A slot cannot be double-booked", "A patient can reschedule"],
            "requirementKeys": ["req-booking"],
        }],
        "workstreams": [{"id": "ws-backend", "name": "Backend"}],
        "roles": ["Backend Engineer"],
        "tasks": [{
            "key": "task-slots",
            "title": "Model slots",
            "description": "Design the slot table and its constraints.",
            "moduleKey": "mod-booking",
            "workstreamKey": "ws-backend",
            "ownerRoleKey": "Backend Engineer",
            "startWeek": 1,
            "endWeek": 1,
            "acceptanceCriteria": ["Unique constraint prevents overlap"],
        }],
        "weeks": [{
            "weekNumber": 1,
            "label": "Week 1",
            "objective": "Slot model in place",
            "taskKeys": ["task-slots"],
        }],
    })


@contextmanager
def _patched(api_key: str, fake):
    """Swap the module-level ``generate_structured`` and the configured key."""
    settings = get_settings()
    saved_key, saved_call = settings.gemini_api_key, pa.generate_structured
    settings.gemini_api_key = api_key
    pa.generate_structured = fake  # type: ignore[assignment]
    try:
        yield
    finally:
        settings.gemini_api_key = saved_key
        pa.generate_structured = saved_call  # type: ignore[assignment]


def _run(timeout_sec: float = 5.0):
    return asyncio.run(
        pa.author_plan_draft(sample_proposal(), "Clinic booking brief", timeout_sec=timeout_sec)
    )


# ── the non-raising contract ──────────────────────────────────────────────

def test_missing_api_key_returns_none_without_calling_gemini():
    calls = []

    async def fake(**kwargs):
        calls.append(kwargs)
        raise AssertionError("Gemini must not be called without a key")

    with _patched("", fake):
        assert _run() is None
    assert calls == []


def test_timeout_returns_none():
    async def fake(**_kwargs):
        await asyncio.sleep(5)
        raise AssertionError("unreachable")

    with _patched("test-key", fake):
        assert _run(timeout_sec=0.05) is None


def test_transport_error_returns_none():
    async def fake(**_kwargs):
        raise ConnectionError("connection reset")

    with _patched("test-key", fake):
        assert _run() is None


def test_validation_failure_returns_none():
    async def fake(**_kwargs):
        PlanAuthoringDraft.model_validate({"summary": "missing everything else"})

    with _patched("test-key", fake):
        assert _run() is None


def test_successful_call_returns_the_draft():
    seen = {}

    async def fake(**kwargs):
        seen.update(kwargs)
        return sample_draft()

    with _patched("test-key", fake):
        draft = _run()

    assert isinstance(draft, PlanAuthoringDraft)
    assert draft.tasks[0].key == "task-slots"
    assert seen["response_schema"] is PlanAuthoringDraft
    assert seen["system_instruction"] is pa.PLAN_SYSTEM_PROMPT


# ── what the model is actually asked for ──────────────────────────────────

def test_prompt_forbids_every_numeric_field():
    prompt = pa.PLAN_SYSTEM_PROMPT.lower()
    for banned in ("hour", "severity", "percentage", "cost", "date"):
        assert banned in prompt, f"prompt does not mention {banned}"
    assert "content only" in prompt
    # The one legitimate numeric exception is stated explicitly.
    assert "startweek" in prompt and "endweek" in prompt


def test_contents_carry_the_horizon_risk_labels_and_brief():
    proposal = sample_proposal()
    contents = pa._build_contents(proposal, "Clinic booking brief", pa._week_count(proposal))

    assert "weeks 1 to 3" in contents
    assert "Double-booking under concurrency" in contents
    assert "Clinic booking brief" in contents
    # Derived figures must not leak into the prompt.
    assert "severity" not in contents.lower()


def test_week_count_falls_back_when_the_delivery_plan_has_no_horizon():
    proposal = sample_proposal()
    proposal.delivery_plan.weeks[0].startWeek = 1
    proposal.delivery_plan.weeks[0].endWeek = 1
    assert pa._week_count(proposal) == 1

    proposal.delivery_plan.weeks = []
    assert pa._week_count(proposal) == pa._DEFAULT_WEEKS
