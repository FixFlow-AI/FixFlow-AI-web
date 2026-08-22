"""Route-level tests for the AI-008 plan endpoints.

Covers what the unit suites cannot: that `/ai/plan/generate` actually awaits the
async generator and answers 200 with `authoringSource` plus freshly computed
diagnostics, and that neither plan route trusts diagnostics supplied by the
caller (Requirement 9.2).
"""
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app, verify_token
from app.features.plan_generator import derive_execution_plan_from_proposal
from test_plan_generator import sample_proposal


# A diagnostics blob no deterministic validator would ever produce, used to prove
# inbound diagnostics are discarded rather than echoed back.
SMUGGLED_DIAGNOSTICS = {
    "valid": True,
    "computedAt": "1999-01-01T00:00:00+00:00",
    "issues": [],
    "capacity": [],
    "scopeCoverage": [],
    "criticalPathTaskIds": ["smuggled-task"],
    "coveredRequirementCount": 999,
    "totalRequirementCount": 999,
    "unresolvedQuestionCount": 999,
    "weekCount": 999,
    "taskCount": 999,
    "errorCount": 0,
    "warningCount": 999,
}


def plan_payload() -> dict:
    plan = derive_execution_plan_from_proposal(sample_proposal())
    return plan.model_dump(mode="json")


class TestPlanRoutes(unittest.TestCase):
    def setUp(self) -> None:
        # Token auth is environment-dependent; the routes under test are the
        # subject here, not the shared-secret guard (covered in test_hardening).
        app.dependency_overrides[verify_token] = lambda: None
        self.client = TestClient(app)
        # Keep the route offline and deterministic: no authoring pass, so the
        # deterministic baseline is returned.
        self._authoring = patch(
            "app.features.plan_generator.author_plan_draft",
            new=self._no_draft,
        )
        self._authoring.start()

    def tearDown(self) -> None:
        self._authoring.stop()
        app.dependency_overrides.clear()

    @staticmethod
    async def _no_draft(*args, **kwargs):
        return None

    def test_generate_returns_plan_with_authoring_source_and_diagnostics(self):
        r = self.client.post(
            "/ai/plan/generate",
            json={"proposal": sample_proposal().model_dump(mode="json")},
        )
        self.assertEqual(r.status_code, 200, msg=r.text)
        body = r.json()

        self.assertIn(body["authoringSource"], {"authored", "repaired", "derived", "degraded"})
        self.assertEqual(body["authoringSource"], "derived")
        self.assertEqual(body["executionPlan"]["authoringSource"], "derived")

        diagnostics = body["diagnostics"]
        self.assertEqual(diagnostics["errorCount"], 0)
        self.assertTrue(diagnostics["valid"])
        self.assertIsNotNone(diagnostics["computedAt"])
        self.assertGreater(diagnostics["taskCount"], 0)

    def test_generate_discards_diagnostics_supplied_on_the_existing_plan(self):
        existing = plan_payload()
        existing["diagnostics"] = SMUGGLED_DIAGNOSTICS

        r = self.client.post(
            "/ai/plan/generate",
            json={
                "proposal": sample_proposal().model_dump(mode="json"),
                "scope": "timeline",
                "existingPlan": existing,
                "preserveClientEdits": True,
            },
        )
        self.assertEqual(r.status_code, 200, msg=r.text)
        body = r.json()

        diagnostics = body["diagnostics"]
        self.assertNotEqual(diagnostics["computedAt"], SMUGGLED_DIAGNOSTICS["computedAt"])
        self.assertNotEqual(diagnostics["taskCount"], 999)
        self.assertNotEqual(diagnostics["warningCount"], 999)
        self.assertNotIn("smuggled-task", diagnostics["criticalPathTaskIds"])
        self.assertEqual(diagnostics["taskCount"], len(body["executionPlan"]["tasks"]))
        self.assertEqual(diagnostics["errorCount"], 0)

    def test_validate_discards_diagnostics_supplied_on_the_plan(self):
        plan = plan_payload()
        plan["diagnostics"] = SMUGGLED_DIAGNOSTICS

        r = self.client.post("/ai/plan/validate", json={"executionPlan": plan})
        self.assertEqual(r.status_code, 200, msg=r.text)
        diagnostics = r.json()

        self.assertNotEqual(diagnostics["computedAt"], SMUGGLED_DIAGNOSTICS["computedAt"])
        self.assertNotEqual(diagnostics["taskCount"], 999)
        self.assertNotEqual(diagnostics["warningCount"], 999)
        self.assertNotIn("smuggled-task", diagnostics["criticalPathTaskIds"])
        self.assertEqual(diagnostics["taskCount"], len(plan["tasks"]))
        self.assertEqual(diagnostics["errorCount"], 0)


if __name__ == "__main__":
    unittest.main()
