"""Offline smoke test — no Gemini key required.

Verifies the service imports cleanly, the fallback engines produce
schema-valid output, and the FastAPI app wires up.
"""
import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.features.brief_parser import sanitize_and_patch_brief
from app.features.interview import _fallback as interview_fallback
from app.features.extensions import _fallback as extensions_fallback
from app.schemas.proposal import Proposal


def test_brief_fallback():
    proposal = sanitize_and_patch_brief({})
    assert isinstance(proposal, Proposal)
    assert proposal.features and proposal.risks and proposal.timeline
    assert proposal.delivery_plan.weeks
    print("  [ok] brief sanitize -> valid Proposal")


def test_brief_fallback_partial():
    proposal = sanitize_and_patch_brief({"features": [{"title": "X"}], "junk": 1})
    assert proposal.features[0].title == "X"
    assert proposal.features[0].confidence_pct == 75  # default patched
    print("  [ok] brief sanitize patches partial input")


def test_interview_fallback():
    out = interview_fallback(["Rust", "Solidity"])
    assert len(out.questions) >= 3
    assert "Rust" in out.questions[0].question
    print("  [ok] interview fallback -> customized questions")


def test_extensions_fallback():
    out = extensions_fallback()
    assert out.suggestedMilestones
    print("  [ok] extensions fallback -> suggested milestones")


def test_health_and_guards(monkeypatch):
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    print(f"  [ok] /health -> {body}")

    # With no provider API key configured, AI routes should 503 (require_ai
    # guard). ai_enabled is provider-aware, so clear every provider's key.
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GROQ_API_KEY", "")
    from app.config import get_settings
    get_settings.cache_clear()

    r = client.post("/ai/brief/parse", json={"briefText": "build an app"})
    assert r.status_code == 503, r.status_code
    print("  [ok] /ai/brief/parse guarded (503 without key)")

    # Restore key settings cache for subsequent tests
    get_settings.cache_clear()

    # Validation: empty briefText -> 422 from Pydantic request model.
    r = client.post("/ai/brief/parse", json={"briefText": ""})
    assert r.status_code == 422, r.status_code

    print("  [ok] request validation rejects empty briefText (422)")


if __name__ == "__main__":
    print("FixFlowAI AI service smoke test")
    test_brief_fallback()
    test_brief_fallback_partial()
    test_interview_fallback()
    test_extensions_fallback()
    test_health_and_guards()
    print("ALL SMOKE TESTS PASSED")
