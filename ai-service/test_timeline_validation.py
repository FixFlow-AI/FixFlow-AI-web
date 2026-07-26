"""Tests for the AI-008 deterministic execution-plan validator.

These are pure, LLM-free tests: they build a schema-valid ``ExecutionPlan`` and
assert the validator flags each specific defect (spec §12 schedule-validation
matrix). No network, no Gemini key required.
"""
import copy
import unittest

from app.schemas.execution_plan import (
    ArchitectureComponent,
    ArchitectureDocument,
    Checkpoint,
    Deliverable,
    ExecutionPlan,
    PlanRiskLink,
    PlanTask,
    PlanWeek,
    Requirement,
    ScopeModule,
    TeamCapacity,
    Workstream,
)
from app.features.timeline_validation import validate_execution_plan


def _codes(diag) -> set[str]:
    return {i.code for i in diag.issues}


def valid_plan() -> ExecutionPlan:
    """A minimal but fully valid two-week plan used as the mutation baseline."""
    return ExecutionPlan(
        requirements=[Requirement(id="R1", statement="Users can log in")],
        scopeModules=[
            ScopeModule(
                id="M1",
                name="Authentication",
                businessObjective="Let users sign in securely",
                outOfScope=["SSO"],
                acceptanceCriteria=["Valid creds succeed", "Invalid creds fail"],
                requirementIds=["R1"],
                componentIds=["C1"],
            )
        ],
        architecture=ArchitectureDocument(
            summary="Simple web app",
            components=[
                ArchitectureComponent(
                    id="C1",
                    name="Auth Service",
                    responsibility="Authenticate users",
                    moduleIds=["M1"],
                    dataBoundary="Owns the users table",
                    interfaces=["POST /login"],
                    errorHandling="Retry with backoff",
                )
            ],
            edges=[],
        ),
        workstreams=[Workstream(id="WS1", name="Backend")],
        teamCapacity=[TeamCapacity(roleId="DEV", roleName="Engineer", hoursPerWeek=40)],
        deliverables=[Deliverable(id="D1", title="Login endpoint")],
        tasks=[
            PlanTask(
                id="T1",
                title="Build login endpoint",
                description="Implement /login with validation",
                moduleId="M1",
                workstreamId="WS1",
                ownerRoleId="DEV",
                estimateHours=20,
                startWeek=1,
                endWeek=1,
                acceptanceCriteria=["Endpoint returns 200 on valid creds"],
            ),
            PlanTask(
                id="T2",
                title="Harden login",
                description="Add rate limiting",
                moduleId="M1",
                workstreamId="WS1",
                ownerRoleId="DEV",
                estimateHours=15,
                startWeek=2,
                endWeek=2,
                dependencyTaskIds=["T1"],
                acceptanceCriteria=["Rate limit enforced"],
            ),
        ],
        weeks=[
            PlanWeek(id="wk1", weekNumber=1, label="Week 1", objective="Ship login",
                     workstreamIds=["WS1"], taskIds=["T1"], deliverableIds=["D1"],
                     checkpointIds=["CP1"]),
            PlanWeek(id="wk2", weekNumber=2, label="Week 2", objective="Harden login",
                     workstreamIds=["WS1"], taskIds=["T2"], checkpointIds=["CP2"]),
        ],
        checkpoints=[
            Checkpoint(id="CP1", title="Login demo", type="demo", weekNumber=1,
                       ownerRoleId="DEV", blocking=True, exitCriteria=["Login works"],
                       evidenceRequired=["Recording"], linkedTaskIds=["T1"]),
            Checkpoint(id="CP2", title="Security review", type="security_review", weekNumber=2,
                       ownerRoleId="DEV", blocking=True, exitCriteria=["No criticals"],
                       evidenceRequired=["Scan report"], linkedTaskIds=["T2"]),
        ],
        risks=[
            PlanRiskLink(id="RK1", label="Credential stuffing", severity=80, category="security",
                         affectedModuleIds=["M1"], affectedWeekNumbers=[2],
                         mitigationCheckpointIds=["CP2"]),
        ],
    )


class TestTimelineValidation(unittest.TestCase):
    def test_valid_plan_has_no_errors(self):
        diag = validate_execution_plan(valid_plan())
        self.assertTrue(diag.valid, msg=f"unexpected issues: {[i.message for i in diag.issues]}")
        self.assertEqual(diag.errorCount, 0)
        self.assertEqual(diag.coveredRequirementCount, 1)
        self.assertEqual(diag.totalRequirementCount, 1)
        self.assertEqual(diag.weekCount, 2)
        self.assertEqual(diag.taskCount, 2)

    def test_dangling_module_reference(self):
        plan = valid_plan()
        plan.tasks[0].moduleId = "GHOST"
        diag = validate_execution_plan(plan)
        self.assertFalse(diag.valid)
        self.assertIn("dangling_ref", _codes(diag))

    def test_orphan_owner_role(self):
        plan = valid_plan()
        plan.tasks[0].ownerRoleId = "UNKNOWN"
        diag = validate_execution_plan(plan)
        self.assertIn("orphan_role", _codes(diag))

    def test_dependency_cycle(self):
        plan = valid_plan()
        plan.tasks[0].dependencyTaskIds = ["T2"]  # T1<->T2 cycle
        diag = validate_execution_plan(plan)
        self.assertFalse(diag.valid)
        self.assertIn("dependency_cycle", _codes(diag))

    def test_dependency_scheduled_after_dependent(self):
        plan = valid_plan()
        # T2 depends on T1 but move T1 to start after T2.
        plan.tasks[0].startWeek = 2
        plan.tasks[0].endWeek = 2
        plan.tasks[1].startWeek = 1
        plan.tasks[1].endWeek = 1
        # keep weeks/checkpoints consistent enough; move CP1 handling aside
        diag = validate_execution_plan(plan)
        self.assertIn("dependency_after_dependent", _codes(diag))

    def test_invalid_span(self):
        plan = valid_plan()
        plan.tasks[0].startWeek = 2
        plan.tasks[0].endWeek = 1
        diag = validate_execution_plan(plan)
        self.assertIn("invalid_span", _codes(diag))

    def test_week_discontinuity(self):
        plan = valid_plan()
        plan.weeks[1].weekNumber = 5  # gap: 1 then 5
        diag = validate_execution_plan(plan)
        self.assertIn("week_discontinuity", _codes(diag))

    def test_capacity_over(self):
        plan = valid_plan()
        plan.tasks[0].estimateHours = 60  # 60h > 40h capacity in week 1
        diag = validate_execution_plan(plan)
        self.assertIn("capacity_over", _codes(diag))
        self.assertFalse(diag.valid)

    def test_capacity_unknown_when_no_hours(self):
        plan = valid_plan()
        plan.teamCapacity[0].hoursPerWeek = None
        diag = validate_execution_plan(plan)
        self.assertIn("capacity_unknown", _codes(diag))
        # unknown capacity is a warning, not an error
        self.assertTrue(diag.valid)

    def test_high_risk_unmitigated(self):
        plan = valid_plan()
        plan.risks[0].mitigationCheckpointIds = []
        plan.risks[0].mitigationTaskIds = []
        diag = validate_execution_plan(plan)
        self.assertIn("high_risk_unmitigated", _codes(diag))
        self.assertFalse(diag.valid)

    def test_blocking_checkpoint_precedes_work(self):
        plan = valid_plan()
        # CP1 is in week 1 but link a task that finishes in week 2.
        plan.checkpoints[0].linkedTaskIds = ["T2"]
        diag = validate_execution_plan(plan)
        self.assertIn("checkpoint_precedes_work", _codes(diag))

    def test_module_without_task(self):
        plan = valid_plan()
        plan.scopeModules.append(
            ScopeModule(
                id="M2", name="Reporting", businessObjective="Reports",
                outOfScope=["exports"], acceptanceCriteria=["a", "b"], requirementIds=["R1"],
            )
        )
        diag = validate_execution_plan(plan)
        self.assertIn("module_no_task", _codes(diag))

    def test_uncovered_requirement(self):
        plan = valid_plan()
        plan.requirements.append(Requirement(id="R2", statement="Users can reset password"))
        diag = validate_execution_plan(plan)
        self.assertIn("requirement_uncovered", _codes(diag))
        self.assertEqual(diag.totalRequirementCount, 2)
        self.assertEqual(diag.coveredRequirementCount, 1)

    def test_orphan_deliverable(self):
        plan = valid_plan()
        plan.deliverables.append(Deliverable(id="D2", title="Unused doc"))
        diag = validate_execution_plan(plan)
        self.assertIn("orphan_deliverable", _codes(diag))

    def test_validator_does_not_mutate_input(self):
        plan = valid_plan()
        before = copy.deepcopy(plan.model_dump())
        validate_execution_plan(plan)
        self.assertEqual(plan.model_dump(), before)


if __name__ == "__main__":
    unittest.main()
