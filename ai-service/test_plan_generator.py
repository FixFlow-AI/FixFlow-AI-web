"""Tests for AI-008 deterministic plan generation (Week 2).

Proves that deriving a v2 ExecutionPlan from any well-formed v1 Proposal yields
a validator-clean plan, and that sectioned regeneration preserves client edits.
"""
import asyncio
import unittest

from app.schemas.proposal import Proposal
from app.features.plan_generator import (
    derive_execution_plan_from_proposal,
    generate_execution_plan,
    degraded_execution_plan,
)
from app.features.timeline_validation import validate_execution_plan


def sample_proposal() -> Proposal:
    return Proposal.model_validate({
        "project_summary": "Build a scheduling app for clinics.",
        "features": [
            {"title": "Appointment booking", "description": "Patients book slots online",
             "technical_approach": "REST API + calendar UI", "complexity": "High",
             "confidence": "Medium", "confidence_pct": 70, "area": "Backend"},
            {"title": "Reminder notifications", "description": "SMS/email reminders",
             "technical_approach": "Queue + provider", "complexity": "Medium",
             "confidence": "Medium", "confidence_pct": 70, "area": "Notifications"},
        ],
        "risks": [
            {"label": "Data privacy of patient records", "severity": 85,
             "mitigation": "Encrypt at rest and audit access controls thoroughly.", "category": "security"},
            {"label": "Scope creep", "severity": 45, "mitigation": "Weekly scope reviews.", "category": "scope"},
        ],
        "timeline": [{"phase": "Build", "duration": "3w", "tasks": ["api", "ui"], "dependencies": []}],
        "delivery_plan": {
            "mode": "weekly", "generatedFrom": "llm",
            "weeks": [
                {"id": "w1", "label": "Week 1: Booking", "startWeek": 1, "endWeek": 1, "sourcePhase": "Build",
                 "goals": ["Ship booking"], "deliverables": ["Booking API"], "dependencies": [],
                 "tasks": [
                     {"id": "t1", "title": "Build appointment booking API", "owner": "team", "status": "planned", "notify": False},
                 ]},
                {"id": "w2", "label": "Week 2: Reminders", "startWeek": 2, "endWeek": 2, "sourcePhase": "Build",
                 "goals": ["Ship reminders"], "deliverables": ["Reminder worker"], "dependencies": [],
                 "tasks": [
                     {"id": "t2", "title": "Build reminder notifications worker", "owner": "team", "status": "planned", "notify": False},
                 ]},
            ],
            "roadmap": [], "backlog": [],
            "notificationDefaults": {"enabled": False, "channels": ["in_app"], "events": ["goal_completed"]},
        },
        "effort": [{"label": "Dev", "percentage": 100, "timeframe": "3w", "description": "Build"}],
        "market": [], "impact": [],
    })


class TestPlanGenerator(unittest.TestCase):
    def test_derived_plan_is_valid(self):
        plan = derive_execution_plan_from_proposal(sample_proposal())
        diag = validate_execution_plan(plan)
        self.assertTrue(diag.valid, msg=f"errors: {[i.message for i in diag.issues if i.severity=='error']}")
        self.assertEqual(diag.errorCount, 0)

    def test_every_requirement_covered(self):
        plan = derive_execution_plan_from_proposal(sample_proposal())
        diag = validate_execution_plan(plan)
        self.assertEqual(diag.coveredRequirementCount, diag.totalRequirementCount)
        self.assertGreaterEqual(diag.totalRequirementCount, 2)

    def test_high_risk_has_mitigation(self):
        plan = derive_execution_plan_from_proposal(sample_proposal())
        high = [r for r in plan.risks if r.severity >= 70]
        self.assertTrue(high)
        for r in high:
            self.assertTrue(r.mitigationCheckpointIds or r.mitigationTaskIds)

    def test_weeks_are_continuous(self):
        plan = derive_execution_plan_from_proposal(sample_proposal())
        numbers = sorted(w.weekNumber for w in plan.weeks)
        self.assertEqual(numbers, list(range(1, len(numbers) + 1)))

    def test_capacity_not_over_allocated(self):
        plan = derive_execution_plan_from_proposal(sample_proposal())
        diag = validate_execution_plan(plan)
        over = [i for i in diag.issues if i.code == "capacity_over"]
        self.assertEqual(over, [])

    def test_timeline_regeneration_preserves_architecture_edits(self):
        base = derive_execution_plan_from_proposal(sample_proposal())
        # Simulate a client edit to the architecture summary.
        base.architecture.summary = "CLIENT EDITED SUMMARY"
        # ``generate_execution_plan`` is a coroutine now (it awaits the optional
        # authoring pass), so the synchronous suite drives it with asyncio.run.
        regenerated = asyncio.run(generate_execution_plan(
            sample_proposal(), scope="timeline", existing_plan=base, preserve_client_edits=True
        ))
        self.assertEqual(regenerated.architecture.summary, "CLIENT EDITED SUMMARY")
        self.assertTrue(validate_execution_plan(regenerated).valid)

    def test_degraded_plan_is_flagged_and_valid(self):
        plan = degraded_execution_plan("gemini_unavailable")
        self.assertTrue(plan.degraded)
        self.assertEqual(plan.degradedReason, "gemini_unavailable")
        self.assertTrue(validate_execution_plan(plan).valid)


if __name__ == "__main__":
    unittest.main()
