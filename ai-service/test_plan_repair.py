"""Tests for AI-008 subtractive plan repair (spec §9.1, §9.3, §9.4).

Each test starts from the deterministic, validator-clean baseline plan, injects
one class of defect, and proves a single ``repair_plan`` pass removes the
diagnostic without mutating the input or inventing descriptive content.
"""
import unittest

from app.features.plan_generator import derive_execution_plan_from_proposal
from app.features.plan_repair import repair_plan
from app.features.timeline_validation import validate_execution_plan
from app.schemas.execution_plan import Deliverable, ExecutionPlan, ScopeModule
from test_plan_generator import sample_proposal


def clean_plan() -> ExecutionPlan:
    return derive_execution_plan_from_proposal(sample_proposal())


def repair(plan: ExecutionPlan) -> tuple[ExecutionPlan, "object"]:
    """Validate, repair once, re-validate — the orchestrator's sequence."""
    before = validate_execution_plan(plan)
    repaired = repair_plan(plan, before)
    return repaired, validate_execution_plan(repaired)


def errors(diag) -> list[str]:
    return [f"{i.code}: {i.message}" for i in diag.issues if i.severity == "error"]


class TestPlanRepair(unittest.TestCase):
    def test_baseline_is_clean_and_survives_repair(self):
        plan = clean_plan()
        repaired, after = repair(plan)
        self.assertEqual(after.errorCount, 0, msg=errors(after))
        self.assertEqual(
            plan.model_dump(exclude={"diagnostics"}),
            repaired.model_dump(exclude={"diagnostics"}),
        )
        self.assertIsNone(repaired.diagnostics)

    def test_repair_never_mutates_the_input_plan(self):
        plan = clean_plan()
        plan.tasks[0].dependencyTaskIds = ["task-ghost"]
        plan.weeks[0].taskIds.append("task-ghost")
        snapshot = plan.model_dump()

        repair(plan)

        self.assertEqual(snapshot, plan.model_dump())

    def test_dangling_references_are_pruned(self):
        plan = clean_plan()
        plan.tasks[0].dependencyTaskIds = ["task-ghost"]
        plan.weeks[0].taskIds.append("task-ghost")
        plan.weeks[0].deliverableIds.append("del-ghost")
        plan.weeks[0].checkpointIds.append("cp-ghost")
        plan.weeks[0].dependencyWeekIds = ["wk-ghost"]
        plan.weeks[0].workstreamIds.append("ws-ghost")
        plan.scopeModules[0].requirementIds.append("req-ghost")
        plan.scopeModules[0].componentIds.append("cmp-ghost")
        plan.scopeModules[0].dependencyModuleIds = ["mod-ghost"]
        plan.checkpoints[0].linkedTaskIds.append("task-ghost")
        plan.risks[0].affectedModuleIds = ["mod-ghost"]
        plan.risks[0].affectedWeekNumbers = [99]
        before = validate_execution_plan(plan)
        self.assertGreater(before.errorCount, 0)

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        self.assertEqual(repaired.tasks[0].dependencyTaskIds, [])
        self.assertNotIn("task-ghost", repaired.weeks[0].taskIds)
        self.assertNotIn("req-ghost", repaired.scopeModules[0].requirementIds)
        self.assertEqual(repaired.scopeModules[0].dependencyModuleIds, [])
        self.assertEqual(repaired.risks[0].affectedWeekNumbers, [])

    def test_module_whose_only_requirement_dangles_is_dropped_with_its_tasks(self):
        plan = clean_plan()
        plan.scopeModules[1].requirementIds = ["req-ghost"]
        doomed_module = plan.scopeModules[1].id
        doomed_tasks = {t.id for t in plan.tasks if t.moduleId == doomed_module}
        self.assertTrue(doomed_tasks)

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        self.assertNotIn(doomed_module, {m.id for m in repaired.scopeModules})
        self.assertFalse(doomed_tasks & {t.id for t in repaired.tasks})
        for week in repaired.weeks:
            self.assertFalse(doomed_tasks & set(week.taskIds))

    def test_discontinuous_weeks_are_renumbered_and_references_remapped(self):
        plan = clean_plan()
        plan.weeks[1].weekNumber = 5
        for task in plan.tasks:
            if task.startWeek == 2:
                task.startWeek = task.endWeek = 5
        for cp in plan.checkpoints:
            if cp.weekNumber == 2:
                cp.weekNumber = 5
        plan.risks[0].affectedWeekNumbers = [5]

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        self.assertEqual([w.weekNumber for w in repaired.weeks], [1, 2])
        self.assertLessEqual(max(t.endWeek for t in repaired.tasks), 2)
        self.assertEqual(repaired.risks[0].affectedWeekNumbers, [2])

    def test_out_of_range_spans_are_clamped(self):
        plan = clean_plan()
        plan.tasks[0].endWeek = 99
        plan.checkpoints[0].weekNumber = 42

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        max_week = max(w.weekNumber for w in repaired.weeks)
        self.assertEqual(repaired.tasks[0].endWeek, max_week)
        self.assertLessEqual(repaired.checkpoints[0].weekNumber, max_week)

    def test_dependency_cycle_loses_the_reported_back_edge(self):
        plan = clean_plan()
        first, second = plan.tasks[0], plan.tasks[1]
        second.startWeek = second.endWeek = first.startWeek  # same week: ordering stays legal
        first.dependencyTaskIds = [second.id]
        second.dependencyTaskIds = [first.id]
        before = validate_execution_plan(plan)
        self.assertIn("dependency_cycle", {i.code for i in before.issues})
        self.assertEqual(before.criticalPathTaskIds, [])

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        self.assertNotIn("dependency_cycle", {i.code for i in after.issues})
        self.assertTrue(after.criticalPathTaskIds)
        remaining = {
            (t.id, dep) for t in repaired.tasks for dep in t.dependencyTaskIds
        }
        self.assertEqual(len(remaining), 1)

    def test_module_without_a_task_gets_a_covering_task(self):
        plan = clean_plan()
        plan.scopeModules.append(
            ScopeModule(
                id="mod-extra",
                name="Audit log",
                businessObjective="Record who changed what.",
                outOfScope=["Anything not described for this module in the brief."],
                acceptanceCriteria=["Changes are recorded.", "The client can read the log."],
                requirementIds=[plan.requirements[0].id],
                complexity="Low",
            )
        )
        before = validate_execution_plan(plan)
        self.assertIn("module_no_task", {i.code for i in before.issues})

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        covering = [t for t in repaired.tasks if t.moduleId == "mod-extra"]
        self.assertEqual(len(covering), 1)
        task = covering[0]
        # Reuses the module's own name and the deterministic hours table only.
        self.assertEqual(task.title, "Implement Audit log")
        self.assertEqual(task.estimateHours, 8.0)
        self.assertIn("Low complexity", task.estimateBasis or "")
        self.assertIn(task.id, repaired.weeks[-1].taskIds)
        self.assertIn(task.workstreamId, {w.id for w in repaired.workstreams})
        self.assertIn(task.ownerRoleId, {c.roleId for c in repaired.teamCapacity})

    def test_unmitigated_high_risk_is_attached_to_the_risk_review_checkpoint(self):
        plan = clean_plan()
        high = next(r for r in plan.risks if r.severity >= 70)
        high.mitigationCheckpointIds = []
        high.mitigationTaskIds = []
        high.status = "open"
        before = validate_execution_plan(plan)
        self.assertIn("high_risk_unmitigated", {i.code for i in before.issues})

        repaired, after = repair(plan)

        self.assertEqual(after.errorCount, 0, msg=errors(after))
        repaired_risk = next(r for r in repaired.risks if r.id == high.id)
        self.assertIn("cp-risk-review", repaired_risk.mitigationCheckpointIds)
        self.assertEqual(repaired_risk.status, "mitigated")

    def test_orphan_deliverable_is_dropped(self):
        plan = clean_plan()
        plan.deliverables.append(Deliverable(id="del-orphan", title="Unscheduled handbook"))
        before = validate_execution_plan(plan)
        self.assertIn("orphan_deliverable", {i.code for i in before.issues})

        repaired, after = repair(plan)

        self.assertNotIn("del-orphan", {d.id for d in repaired.deliverables})
        self.assertNotIn("orphan_deliverable", {i.code for i in after.issues})
        self.assertEqual(after.errorCount, 0, msg=errors(after))

    def test_all_defects_at_once_are_repaired_in_one_pass(self):
        plan = clean_plan()
        plan.tasks[0].dependencyTaskIds = ["task-ghost"]
        plan.tasks[0].endWeek = 99
        plan.weeks[1].weekNumber = 7
        plan.weeks[0].checkpointIds.append("cp-ghost")
        plan.deliverables.append(Deliverable(id="del-orphan", title="Unscheduled handbook"))
        for risk in plan.risks:
            risk.mitigationCheckpointIds = []
            risk.status = "open"
        before = validate_execution_plan(plan)

        repaired, after = repair(plan)

        self.assertGreater(before.errorCount, 0)
        self.assertLess(after.errorCount, before.errorCount)
        self.assertEqual(after.errorCount, 0, msg=errors(after))
        self.assertEqual([w.weekNumber for w in repaired.weeks], [1, 2])


if __name__ == "__main__":
    unittest.main()
