import unittest
from unittest.mock import patch
import logging
from pydantic import ValidationError
import asyncio

# Set dummy env vars for test run
import os
os.environ["GEMINI_API_KEY"] = "fake-key"
os.environ["AI_SHARED_SECRET"] = "fake-secret"

from app.config import resolve_model, get_settings
from app.features.fallback_logger import log_fallback, logger as fallback_logger
from app.main import InterviewRequest, ExtensionsRequest
from app.features.brief_parser import parse_brief


class TestAIServiceHardening(unittest.TestCase):

    def test_aie_01_resolve_model(self):
        """Test model validation against ALLOWED_MODELS allowlist."""
        # 1. Valid models in allowlist
        self.assertEqual(resolve_model("gemini-2.5-flash"), "gemini-2.5-flash")
        self.assertEqual(resolve_model("gemini-3.1-pro"), "gemini-3.1-pro")

        # 2. None candidate resolves to default model
        settings = get_settings()
        self.assertEqual(resolve_model(None), settings.gemini_model)

        # 3. Invalid model raises ValueError
        with self.assertRaises(ValueError) as context:
            resolve_model("gemini-invalid-ultra")
        self.assertIn("not in the allowed list", str(context.exception))

    def test_aie_07_fallback_logger_hardening(self):
        """Test fallback logger doesn't crash on missing fields and formats correctly."""
        class CaptureHandler(logging.Handler):
            def __init__(self):
                super().__init__()
                self.records = []

            def emit(self, record):
                self.records.append(record)

        handler = CaptureHandler()
        fallback_logger.addHandler(handler)

        try:
            # 1. Call log_fallback directly with all fields
            log_fallback(feature="test_feat", reason="test_reason", error="test_err")
            self.assertEqual(len(handler.records), 1)
            self.assertEqual(handler.records[0].feature, "test_feat")
            self.assertEqual(handler.records[0].reason, "test_reason")
            self.assertEqual(handler.records[0].error, "test_err")

            # 2. Standard log record missing custom fields gets filtered safely
            fallback_logger.info("Message without extra fields")
            self.assertEqual(len(handler.records), 2)
            self.assertEqual(handler.records[1].feature, "-")
            self.assertEqual(handler.records[1].reason, "-")
            self.assertEqual(handler.records[1].error, "")
        finally:
            fallback_logger.removeHandler(handler)

    def test_aie_08_union_validation_hole(self):
        """Test request models reject invalid types (i.e. Any validation hole fix)."""
        # 1. InterviewRequest: githubScan should accept dict or str, but reject int/bool
        # Valid cases
        req = InterviewRequest(briefText="Valid text", githubScan="some scan")
        self.assertEqual(req.githubScan, "some scan")
        req2 = InterviewRequest(briefText="Valid text", githubScan={"repo": "name"})
        self.assertEqual(req2.githubScan, {"repo": "name"})

        # Invalid cases
        with self.assertRaises(ValidationError):
            InterviewRequest(briefText="Valid text", githubScan=12345)
        with self.assertRaises(ValidationError):
            InterviewRequest(briefText="Valid text", githubScan=True)

        # 2. ExtensionsRequest: completedDeliverables should accept list or str, but reject dict/int
        # Valid cases
        ext = ExtensionsRequest(completedDeliverables="task completed")
        self.assertEqual(ext.completedDeliverables, "task completed")
        ext2 = ExtensionsRequest(completedDeliverables=["task1", "task2"])
        self.assertEqual(ext2.completedDeliverables, ["task1", "task2"])

        # Invalid cases
        with self.assertRaises(ValidationError):
            ExtensionsRequest(completedDeliverables=123)
        with self.assertRaises(ValidationError):
            ExtensionsRequest(completedDeliverables={"a": 1})

    @patch("app.features.brief_parser.generate_structured")
    def test_aie_02_partial_salvage_fallback(self, mock_generate):
        """Test brief parser performs partial salvage recovery on ValidationError."""
        # 1. Create a ValidationError that includes raw_payload
        validation_error = ValidationError.from_exception_data(
            title="Proposal",
            line_errors=[]
        )
        # Attach the raw dictionary payload simulating partial LLM output
        setattr(validation_error, "raw_payload", {
            "project_summary": "Salvaged summary of the project",
            "features": [{"title": "Auth", "description": "Login support"}],
        })

        # Make the mock generator raise validation_error asynchronously
        async def mock_async_generate(*args, **kwargs):
            raise validation_error

        mock_generate.side_effect = mock_async_generate

        # Run parse_brief in an event loop using asyncio.run
        res = asyncio.run(parse_brief("Some mock brief text"))

        # Verify that degradedReason is partial_salvage and fields are recovered
        self.assertEqual(res.source, "fallback")
        self.assertEqual(res.degradedReason, "partial_salvage")
        self.assertIn("Salvaged summary", res.proposal.project_summary)
        self.assertEqual(len(res.proposal.features), 1)
        self.assertEqual(res.proposal.features[0].title, "Auth")

    def test_aia_02_result_cache(self):
        """Test cache storage and retrieval of validated Pydantic models."""
        from app.llm.cache import set_cached_response, get_cached_response
        from app.schemas.proposal import Proposal
        from app.features.brief_parser import sanitize_and_patch_brief

        # Create a valid Proposal using the sanitizer defaults
        dummy_prop = sanitize_and_patch_brief({})

        sys_inst = "sys-inst-test"
        contents = "content-test"

        # 1. Initially cache is empty
        res1 = asyncio.run(get_cached_response(sys_inst, contents, Proposal))
        self.assertIsNone(res1)

        # 2. Store in cache
        asyncio.run(set_cached_response(sys_inst, contents, Proposal, dummy_prop))

        # 3. Retrieve from cache
        res2 = asyncio.run(get_cached_response(sys_inst, contents, Proposal))
        self.assertIsNotNone(res2)
        self.assertEqual(res2.project_summary, dummy_prop.project_summary)

    def test_aia_07_circuit_breaker(self):
        """Test circuit breaker trips on failures and routes directly to fallback."""
        from app.llm.circuit_breaker import CircuitBreaker

        # Create a dedicated circuit breaker
        test_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout_sec=0.1)

        # 1. Closed state initially
        self.assertEqual(test_breaker.state, "Closed")
        self.assertTrue(test_breaker.is_allowed())

        # 2. Trip the breaker with failures
        test_breaker.record_failure()
        test_breaker.record_failure()
        self.assertEqual(test_breaker.state, "Closed") # Under threshold
        test_breaker.record_failure()
        self.assertEqual(test_breaker.state, "Open")
        self.assertFalse(test_breaker.is_allowed())

        # 3. Recover after timeout to Half-Open
        import time
        time.sleep(0.15)
        self.assertTrue(test_breaker.is_allowed())
        self.assertEqual(test_breaker.state, "Half-Open")

        # 4. Success closes circuit
        test_breaker.record_success()
        self.assertEqual(test_breaker.state, "Closed")

    def test_aia_03_deterministic_skill_gap_bridge(self):
        """Test skill gap bridge extraction, normalization, and diffing."""
        from app.features.skill_gap import (
            normalize_skill,
            extract_required_skills,
            derive_missing_skills,
        )
        from app.schemas.github import VerifiedSkill

        # 1. Normalization & Alias matching
        self.assertEqual(normalize_skill("ReactJS"), "react")
        self.assertEqual(normalize_skill("JS"), "javascript")
        self.assertEqual(normalize_skill("TS"), "typescript")
        self.assertEqual(normalize_skill("PostgreSQL"), "postgresql")

        # 2. Extract required skills from brief text
        required = extract_required_skills("Looking for a developer with React, Node.js, and multi-factor authentication (MFA)")
        self.assertIn("react", required)
        self.assertIn("nodejs", required)
        self.assertIn("mfa", required)

        # 3. Deterministic diffing with VerifiedSkill list
        verified = [
            VerifiedSkill(name="ReactJS", category="framework", confidence=85),
            VerifiedSkill(name="TypeScript", category="language", confidence=90),
            VerifiedSkill(name="Docker", category="tool", confidence=50), # Under confidence threshold (70)
        ]

        report = derive_missing_skills(required, verified, confidence_threshold=70)
        # Required: react, nodejs, mfa
        # Verified & match_ready: react (ReactJS -> react)
        # Missing: nodejs, mfa
        # Covered: react
        self.assertIn("react", report.covered_skills)
        self.assertIn("nodejs", report.missing_skills)
        self.assertIn("mfa", report.missing_skills)
        self.assertNotIn("docker", report.covered_skills) # because confidence was 50 < 70
        self.assertEqual(report.coverage_pct, 33) # 1/3

    def test_aie_06_opportunity_intelligence_scoring(self):
        """Test deterministic opportunity scoring, factors, and stable dedupe keys."""
        from app.schemas.opportunity import Opportunity, BudgetRange
        from app.features.opportunity import score_opportunity, generate_dedupe_key

        opp1 = Opportunity(
            title="Senior React Developer",
            summary="Looking for a React developer with WebSockets experience.",
            required_skills=["ReactJS", "WebSockets"],
            nice_to_have_skills=["TypeScript"],
            budget=BudgetRange(min_budget=2000, max_budget=4000),
            currency="USD",
            urgency="High",
            remote=True,
            red_flags=["Requests free test task"],
            source="LinkedIn",
        )

        verified_skills = ["react", "typescript", "websockets"]

        # 1. First evaluation
        score1 = score_opportunity(opp1, verified_skills, client_rating=90)
        
        # 2. Verify deterministic scores are identical
        score2 = score_opportunity(opp1, verified_skills, client_rating=90)
        self.assertEqual(score1.overall_score, score2.overall_score)
        self.assertEqual(score1.factors.skill_fit, score2.factors.skill_fit)
        self.assertEqual(score1.factors.budget_adequacy, score2.factors.budget_adequacy)
        self.assertEqual(score1.factors.urgency, score2.factors.urgency)
        self.assertEqual(score1.factors.client_quality, score2.factors.client_quality)
        self.assertEqual(score1.factors.red_flag_penalty, score2.factors.red_flag_penalty)
        self.assertEqual(score1.dedupe_key, score2.dedupe_key)

        # 3. Verify stable dedupe key generation
        expected_key = generate_dedupe_key("Senior React Developer", "LinkedIn", 2000, 4000)
        self.assertEqual(score1.dedupe_key, expected_key)

        # 4. Verify red flag penalty reduces score
        opp2 = Opportunity(
            title="Senior React Developer",
            summary="Looking for a React developer with WebSockets experience.",
            required_skills=["ReactJS", "WebSockets"],
            nice_to_have_skills=["TypeScript"],
            budget=BudgetRange(min_budget=2000, max_budget=4000),
            currency="USD",
            urgency="High",
            remote=True,
            red_flags=[], # No red flags
            source="LinkedIn",
        )
        score_no_flags = score_opportunity(opp2, verified_skills, client_rating=90)
        self.assertTrue(score_no_flags.overall_score > score1.overall_score)
        self.assertEqual(score1.factors.red_flag_penalty, 15)

    def test_ai_007_growth_plan_engine(self):
        """Test freelancer confidence growth plan deterministic logic and fallback."""
        from app.schemas.github import ProfileConfidence, ConfidenceFactorBreakdown
        from app.features.growth import generate_growth_plan

        confidence = ProfileConfidence(
            score=45,
            band="emerging",
            factorBreakdown=ConfidenceFactorBreakdown(
                skillBreadthDepth=30,     # Weakest
                projectStrength=50,
                recency=80,
                contributionVolume=40,    # Second weakest
                documentation=60
            )
        )

        # Force AI off to verify deterministic fallback path (required by story and AIE-07)
        from app.config import get_settings
        settings = get_settings()
        original_ai_enabled = settings.gemini_api_key
        settings.gemini_api_key = None # Trips settings.ai_enabled to False
        
        try:
            # We run the async generate_growth_plan using an event loop or simply async run
            import asyncio
            plan = asyncio.run(generate_growth_plan(confidence, []))
            
            # Assert deterministic target band and overall score match the inputs
            self.assertEqual(plan.currentBand, "emerging")
            self.assertEqual(plan.targetBand, "developing")
            self.assertEqual(plan.overallScore, 45)

            # Weakest factor must be skillBreadthDepth, followed by contributionVolume
            factors_ordered = [act.factor for act in plan.prioritizedActions]
            self.assertEqual(factors_ordered[0], "skillBreadthDepth")
            self.assertEqual(factors_ordered[1], "contributionVolume")

            # Check target skills and projects are generated
            self.assertTrue(len(plan.targetSkills) > 0)
            self.assertTrue(len(plan.suggestedProjects) > 0)
        finally:
            settings.gemini_api_key = original_ai_enabled

    def test_imp_01_constant_time_token_verification(self):
        """Test verify_token uses constant-time comparison and preserves disabled behavior."""
        from fastapi import HTTPException
        from app.main import verify_token
        from app.config import get_settings

        settings = get_settings()
        original_token = settings.ai_service_token

        try:
            # 1. Configured secret: correct token passes (returns None).
            settings.ai_service_token = "s3cret-token"
            self.assertIsNone(asyncio.run(verify_token("s3cret-token")))

            # 2. Configured secret: wrong token raises 401.
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(verify_token("wrong-token"))
            self.assertEqual(ctx.exception.status_code, 401)

            # 3. Configured secret: missing token (None) raises 401.
            with self.assertRaises(HTTPException) as ctx_missing:
                asyncio.run(verify_token(None))
            self.assertEqual(ctx_missing.exception.status_code, 401)

            # 4. Empty configured secret disables the check (auth disabled).
            settings.ai_service_token = ""
            self.assertIsNone(asyncio.run(verify_token(None)))
            self.assertIsNone(asyncio.run(verify_token("anything")))
        finally:
            settings.ai_service_token = original_token


if __name__ == "__main__":
    unittest.main()
