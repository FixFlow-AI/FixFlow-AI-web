"""Tests for AI-008 plan assembly (draft → ExecutionPlan).

Proves the three guarantees the assembler exists to provide: every number is
computed here (never read from the draft), every unresolvable draft reference is
dropped rather than guessed, and the emitted plan is validator-clean — including
for adversarial drafts with dangling keys, duplicate keys, out-of-range week
spans, and dependency cycles.
"""
import copy
import unittest

from app.features.plan_assembly import assemble_plan, estimate_hours
from app.features.plan_generator import (
    _COMPLEXITY_HOURS,
    derive_execution_plan_from_proposal,
)
from app.features.timeline_validation import validate_execution_plan
from app.schemas.plan_draft import PlanAuthoringDraft
from app.schemas.proposal import Proposal


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
             "mitigation": "Encrypt at rest and audit access controls thoroughly.",
             "category": "security"},
            {"label": "Scope creep", "severity": 45,
             "mitigation": "Weekly scope reviews.", "category": "scope"},
        ],
        "timeline": [{"phase": "Build", "duration": "2w", "tasks": ["api", "ui"], "dependencies": []}],
        "delivery_plan": {
            "mode": "weekly", "generatedFrom": "llm",
            "weeks": [
                {"id": "w1", "label": "Week 1: Booking", "startWeek": 1, "endWeek": 1,
                 "sourcePhase": "Build", "goals": ["Ship booking"], "deliverables": ["Booking API"],
                 "dependencies": [],
                 "tasks": [{"id": "t1", "title": "Build appointment booking API", "owner": "team",
                            "status": "planned", "notify": False}]},
            ],
            "roadmap": [], "backlog": [],
            "notificationDefaults": {"enabled": False, "channels": ["in_app"],
                                     "events": ["goal_completed"]},
        },
        "effort": [{"label": "Dev", "percentage": 100, "timeframe": "2w", "description": "Build"}],
        "market": [], "impact": [],
    })


def sample_draft_payload() -> dict:
    return {
        "summary": "Two-week clinic scheduling build.",
        "planningAssumptions": [
            {"id": "model-a1", "statement": "The clinic supplies its SMS provider credentials."}
        ],
        "openQuestions": [
            {"id": "model-q1", "question": "Which SMS provider?", "blocking": True,
             "relatedRequirementIds": ["r2", "does-not-exist"]}
        ],
        "requirements": [
            {"key": "r1", "statement": "Patients can book appointments online.",
             "source": "brief", "priority": "must"},
            {"key": "r2", "statement": "Staff and patients receive reminders.",
             "source": "discovery", "priority": "should"},
        ],
        "scopeModules": [
            {"key": "mod-book", "name": "Appointment booking",
             "businessObjective": "Let patients self-serve bookings.",
             "actors": ["Patient"], "inScope": ["Slot search", "Booking"],
             "outOfScope": ["Payment collection"],
             "acceptanceCriteria": ["A patient can book a free slot.",
                                    "A double booking is rejected."],
             "requirementKeys": ["r1"], "componentKeys": ["c-api"], "complexity": "High"},
            {"key": "mod-remind", "name": "Reminders",
             "businessObjective": "Reduce no-shows.",
             "actors": ["Patient", "Staff"], "inScope": ["SMS reminders"],
             "outOfScope": ["Marketing campaigns"],
             "acceptanceCriteria": ["A reminder is sent 24h before a slot.",
                                    "A failed send is retried and logged."],
             "requirementKeys": ["r2"], "componentKeys": ["c-worker"], "complexity": "Medium"},
        ],
        "workstreams": [
            {"id": "ws-be", "name": "Backend"},
            {"id": "ws-notify", "name": "Notifications"},
        ],
        "roles": ["Backend Engineer", "Notification Engineer"],
        "components": [
            {"key": "c-api", "name": "Booking API", "responsibility": "Owns slots and bookings.",
             "moduleKeys": ["mod-book"], "dataBoundary": "Owns the booking tables.",
             "interfaces": ["REST /bookings"], "errorHandling": "Validate at the boundary.",
             "openDecisions": ["Slot locking strategy"]},
            {"key": "c-worker", "name": "Reminder Worker", "responsibility": "Sends reminders.",
             "moduleKeys": ["mod-remind"], "dataBoundary": "Owns the outbound message log.",
             "interfaces": ["Queue consumer"], "errorHandling": "Retry with backoff.",
             "dependencyComponentKeys": ["c-api"]},
        ],
        "edges": [{"fromKey": "c-api", "toKey": "c-worker", "kind": "event",
                   "label": "booking.created"}],
        "tasks": [
            {"key": "t1", "title": "Build the booking API",
             "description": "Slots, bookings, conflict rejection.",
             "moduleKey": "mod-book", "workstreamKey": "ws-be",
             "ownerRoleKey": "Backend Engineer", "startWeek": 1, "endWeek": 1,
             "acceptanceCriteria": ["Conflicting bookings are rejected."],
             "evidenceRequired": ["API tests"], "complexity": "High", "priority": "must"},
            {"key": "t2", "title": "Build the reminder worker",
             "description": "Consume booking events and send reminders.",
             "moduleKey": "mod-remind", "workstreamKey": "ws-notify",
             "ownerRoleKey": "Notification Engineer", "startWeek": 2, "endWeek": 2,
             "dependencyTaskKeys": ["t1"],
             "acceptanceCriteria": ["A reminder is sent for a booked slot."],
             "complexity": "Medium", "priority": "should"},
        ],
        "weeks": [
            {"weekNumber": 1, "label": "Week 1: Booking", "objective": "Ship booking.",
             "taskKeys": ["t1"], "deliverableTitles": ["Booking API"],
             "clientActions": [{"description": "Confirm clinic opening hours",
                                "weekNumber": 1, "required": True}]},
            {"weekNumber": 2, "label": "Week 2: Reminders", "objective": "Ship reminders.",
             "taskKeys": ["t2"], "deliverableTitles": ["Reminder worker"],
             "checkpointKeys": ["cp-demo"]},
        ],
        "checkpoints": [
            {"key": "cp-demo", "title": "End-of-build demo", "type": "demo", "weekNumber": 2,
             "ownerRoleKey": "Backend Engineer", "blocking": True,
             "exitCriteria": ["Booking and reminders demoed end to end."],
             "evidenceRequired": ["Demo recording"], "linkedTaskKeys": ["t1", "t2"]},
        ],
        "risks": [
            {"label": "Data privacy of patient records", "category": "security",
             "affectedModuleKeys": ["mod-book"], "affectedWeekNumbers": [1],
             "mitigationCheckpointKeys": ["cp-demo"]},
            {"label": "SMS provider deliverability", "category": "integration",
             "affectedModuleKeys": ["mod-remind"], "affectedWeekNumbers": [2]},
        ],
    }


def sample_draft(**overrides) -> PlanAuthoringDraft:
    payload = sample_draft_payload()
    payload.update(overrides)
    return PlanAuthoringDraft.model_validate(payload)


def assemble(draft: PlanAuthoringDraft, proposal: Proposal = None):
    proposal = proposal or sample_proposal()
    baseline = derive_execution_plan_from_proposal(proposal)
    return assemble_plan(draft, proposal, baseline=baseline)


class TestEstimateHours(unittest.TestCase):
    def test_hours_come_from_the_complexity_table(self):
        for complexity, expected in _COMPLEXITY_HOURS.items():
            hours, basis = estimate_hours(complexity)
            self.assertEqual(hours, float(expected))
            self.assertTrue(basis)
            self.assertIn(complexity, basis)


class TestAssembleWellFormedDraft(unittest.TestCase):
    def setUp(self):
        self.plan = assemble(sample_draft())

    def test_plan_is_validator_clean(self):
        diag = validate_execution_plan(self.plan)
        errors = [i.message for i in diag.issues if i.severity == "error"]
        self.assertEqual(diag.errorCount, 0, msg=f"errors: {errors}")
        self.assertTrue(diag.valid)

    def test_every_task_estimate_is_derived_and_explained(self):
        self.assertTrue(self.plan.tasks)
        for task in self.plan.tasks:
            self.assertIn(task.estimateHours, [float(v) for v in _COMPLEXITY_HOURS.values()])
            self.assertTrue(task.estimateBasis)

    def test_high_risk_severity_is_inherited_from_the_v1_proposal(self):
        privacy = next(r for r in self.plan.risks if "privacy" in r.label.lower())
        self.assertEqual(privacy.severity, 85)
        self.assertTrue(privacy.mitigationCheckpointIds or privacy.mitigationTaskIds)

    def test_unresolvable_related_requirement_is_dropped(self):
        question = self.plan.openQuestions[0]
        requirement_ids = {r.id for r in self.plan.requirements}
        self.assertTrue(question.relatedRequirementIds)
        self.assertTrue(set(question.relatedRequirementIds) <= requirement_ids)

    def test_capacity_is_sized_for_every_owning_role(self):
        owners = {t.ownerRoleId for t in self.plan.tasks}
        sized = {c.roleId for c in self.plan.teamCapacity}
        self.assertTrue(owners <= sized)
        for cell in self.plan.teamCapacity:
            self.assertIsNotNone(cell.hoursPerWeek)
            self.assertGreater(cell.hoursPerWeek, 0)

    def test_assembly_is_deterministic(self):
        again = assemble(sample_draft())
        self.assertEqual(
            self.plan.model_dump(exclude={"diagnostics"}),
            again.model_dump(exclude={"diagnostics"}),
        )


class TestAdversarialDrafts(unittest.TestCase):
    def assert_clean(self, plan):
        diag = validate_execution_plan(plan)
        errors = [i.message for i in diag.issues if i.severity == "error"]
        self.assertEqual(diag.errorCount, 0, msg=f"errors: {errors}")

    def test_dangling_keys_are_dropped(self):
        payload = sample_draft_payload()
        payload["tasks"][1]["dependencyTaskKeys"] = ["t1", "ghost-task"]
        payload["scopeModules"][0]["componentKeys"] = ["c-api", "ghost-component"]
        payload["risks"][0]["mitigationTaskKeys"] = ["ghost-task"]
        payload["weeks"][1]["checkpointKeys"] = ["ghost-checkpoint"]
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        component_ids = {c.id for c in (plan.architecture.components if plan.architecture else [])}
        self.assertTrue(set(plan.scopeModules[0].componentIds) <= component_ids)
        task_ids = {t.id for t in plan.tasks}
        for task in plan.tasks:
            self.assertTrue(set(task.dependencyTaskIds) <= task_ids)

    def test_task_with_unresolvable_required_reference_is_dropped(self):
        payload = sample_draft_payload()
        payload["tasks"][0]["moduleKey"] = "ghost-module"
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        self.assertNotIn("Build the booking API", [t.title for t in plan.tasks])
        # The module it should have implemented still keeps a covering task.
        booking = next(m for m in plan.scopeModules if m.name == "Appointment booking")
        self.assertTrue([t for t in plan.tasks if t.moduleId == booking.id])

    def test_out_of_range_week_spans_are_clamped(self):
        payload = sample_draft_payload()
        payload["tasks"][0]["startWeek"] = 99
        payload["tasks"][0]["endWeek"] = 500
        payload["tasks"][1]["startWeek"] = 7
        payload["tasks"][1]["endWeek"] = 3
        payload["risks"][0]["affectedWeekNumbers"] = [1, 42]
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        week_count = len(plan.weeks)
        for task in plan.tasks:
            self.assertGreaterEqual(task.startWeek, 1)
            self.assertLessEqual(task.endWeek, week_count)
            self.assertLessEqual(task.startWeek, task.endWeek)
        for risk in plan.risks:
            for number in risk.affectedWeekNumbers:
                self.assertLessEqual(number, week_count)

    def test_duplicate_keys_collapse_to_one_entity(self):
        payload = sample_draft_payload()
        payload["tasks"].append(copy.deepcopy(payload["tasks"][0]))
        payload["tasks"][-1]["title"] = "Duplicate key task"
        payload["requirements"].append({"key": "r1", "statement": "Duplicated requirement."})
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        self.assertNotIn("Duplicate key task", [t.title for t in plan.tasks])
        self.assertEqual(len({r.id for r in plan.requirements}), len(plan.requirements))
        self.assertEqual(len({t.id for t in plan.tasks}), len(plan.tasks))

    def test_dependency_cycle_is_broken(self):
        payload = sample_draft_payload()
        payload["tasks"][0]["dependencyTaskKeys"] = ["t2"]
        payload["tasks"][1]["dependencyTaskKeys"] = ["t1"]
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        diag = validate_execution_plan(plan)
        self.assertFalse([i for i in diag.issues if i.code == "dependency_cycle"])

    def test_discontinuous_weeks_are_renumbered(self):
        payload = sample_draft_payload()
        payload["weeks"][0]["weekNumber"] = 3
        payload["weeks"][1]["weekNumber"] = 9
        payload["tasks"][0]["startWeek"] = 3
        payload["tasks"][0]["endWeek"] = 3
        payload["tasks"][1]["startWeek"] = 9
        payload["tasks"][1]["endWeek"] = 9
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        self.assertEqual([w.weekNumber for w in plan.weeks], [1, 2])
        by_title = {t.title: t for t in plan.tasks}
        self.assertEqual(by_title["Build the booking API"].startWeek, 1)
        self.assertEqual(by_title["Build the reminder worker"].startWeek, 2)

    def test_blank_required_text_drops_the_entity(self):
        payload = sample_draft_payload()
        payload["components"][0]["errorHandling"] = "   "
        payload["tasks"][0]["title"] = ""
        plan = assemble(PlanAuthoringDraft.model_validate(payload))

        self.assert_clean(plan)
        component_names = {c.name for c in (plan.architecture.components if plan.architecture else [])}
        self.assertNotIn("Booking API", component_names)
        self.assertNotIn("", [t.title for t in plan.tasks])


if __name__ == "__main__":
    unittest.main()
