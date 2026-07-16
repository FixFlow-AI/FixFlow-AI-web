"""FixFlowAI Python AI service (FastAPI).

Owns the four LLM features (AI-001..004). Stateless: it validates input, calls
Gemini, and returns JSON. It never touches the database or payments — the
TypeScript backend remains the gateway and system of record.
"""
from __future__ import annotations

import json
import logging
from typing import Any, List, Optional, Union, Literal

from uuid import uuid4
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .telemetry import set_request_id, get_request_id, get_metrics_summary
from .llm.circuit_breaker import primary_breaker

from .config import get_settings
from .features.brief_parser import parse_brief
from .features.confidence_grid import process_confidence_grid
from .features.extensions import generate_contract_extensions
from .features.github_scan import run_github_scan, stream_github_scan
from .features.interview import generate_interview_questions
from .schemas.confidence import ConfidenceGridResult
from .schemas.extensions import ContractExtensionsOutput
from .schemas.github import GithubScanRequest, GithubScanResult
from .schemas.interview import InterviewOutput
from .schemas.proposal import Proposal, ParseBriefResponse
from .schemas.opportunity import (
    Opportunity,
    OpportunityScore,
    ScoreOpportunityRequest,
)
from .features.opportunity import extract_opportunity, score_opportunity
from .schemas.growth import GrowthPlan, GrowthPlanRequest
from .features.growth import generate_growth_plan

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="FixFlowAI AI Service", version="1.0.0")


@app.middleware("http")
async def add_telemetry_and_request_id(request: Request, call_next):
    # Extract request ID from header or generate a new one
    rid = request.headers.get("x-request-id") or str(uuid4())
    set_request_id(rid)
    
    response = await call_next(request)
    
    # Inject request ID into response header
    response.headers["x-request-id"] = get_request_id()
    return response

settings = get_settings()

if not settings.model_valid:
    raise RuntimeError(f"Invalid GEMINI_MODEL: {settings.gemini_model}")

if not settings.fallback_model_valid:
    raise RuntimeError(f"Invalid GEMINI_FALLBACK_MODEL: {settings.gemini_fallback_model}")

logging.info(
    "FixFlowAI AI Service starting up. Primary model: %s, Fallback model: %s",
    settings.gemini_model,
    settings.gemini_fallback_model
)


# --------------------------------------------------------------------------
# Auth (optional shared secret) + AI-key guard
# --------------------------------------------------------------------------

async def verify_token(x_ai_service_token: Optional[str] = Header(default=None)) -> None:
    if settings.ai_service_token and x_ai_service_token != settings.ai_service_token:
        raise HTTPException(status_code=401, detail="Invalid or missing x-ai-service-token.")


def require_ai() -> None:
    if not settings.ai_enabled:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the AI service.",
        )


# --------------------------------------------------------------------------
# Request models
# --------------------------------------------------------------------------

class ParseBriefRequest(BaseModel):
    briefText: str = Field(min_length=1)


class EvaluateRequest(BaseModel):
    briefText: str = Field(min_length=1)
    proposal: Proposal


class InterviewRequest(BaseModel):
    briefText: str = Field(min_length=1)
    githubScan: Union[str, dict] = ""
    proposal: Optional[Proposal] = None
    missingSkills: List[str] = Field(default_factory=list)


class ExtensionsRequest(BaseModel):
    completedDeliverables: Union[str, list] = ""
    chatSummary: str = ""


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "aiEnabled": settings.ai_enabled,
        "model": settings.gemini_model,
        "modelValid": settings.model_valid,
        "fallbackModel": settings.gemini_fallback_model,
        "fallbackModelValid": settings.fallback_model_valid,
        "allowedModels": sorted(list(settings.ALLOWED_MODELS)),
        "metrics": get_metrics_summary(),
        "circuitBreaker": {
            "state": primary_breaker.state,
            "failureCount": primary_breaker.failure_count,
        },
    }


@app.post("/ai/brief/parse", response_model=ParseBriefResponse, dependencies=[Depends(verify_token)])
async def brief_parse(body: ParseBriefRequest) -> ParseBriefResponse:
    require_ai()
    return await parse_brief(body.briefText)


@app.post(
    "/ai/confidence/evaluate",
    response_model=ConfidenceGridResult,
    dependencies=[Depends(verify_token)],
)
async def confidence_evaluate(body: EvaluateRequest) -> ConfidenceGridResult:
    require_ai()
    return await process_confidence_grid(body.briefText, body.proposal)


@app.post(
    "/ai/interview/generate",
    response_model=InterviewOutput,
    dependencies=[Depends(verify_token)],
)
async def interview_generate(body: InterviewRequest) -> InterviewOutput:
    require_ai()
    
    missing = body.missingSkills
    if not missing and body.githubScan:
        try:
            import json
            raw_scan = body.githubScan
            if isinstance(raw_scan, str):
                try:
                    raw_scan = json.loads(raw_scan)
                except Exception:
                    raw_scan = {}
            
            skills_list = []
            if isinstance(raw_scan, dict):
                skills_raw = raw_scan.get("skills", [])
                if not skills_raw and "skills" not in raw_scan:
                    # Maybe it's a map representing skills
                    pass
                else:
                    skills_list = skills_raw
            elif isinstance(raw_scan, list):
                skills_list = raw_scan

            from .schemas.github import VerifiedSkill
            verified_skills = []
            for s in skills_list:
                try:
                    verified_skills.append(VerifiedSkill.model_validate(s))
                except Exception:
                    pass

            from .features.skill_gap import extract_required_skills, derive_missing_skills
            required = extract_required_skills(body.briefText, body.proposal)
            report = derive_missing_skills(required, verified_skills)
            missing = report.missing_skills
            logging.info("Derived missing skills server-side: %s", missing)
        except Exception as e:
            logging.warning("Failed to derive missing skills, falling back to empty list: %s", str(e))
            missing = []

    return await generate_interview_questions(
        body.briefText, body.githubScan, missing
    )


@app.post(
    "/ai/extensions/generate",
    response_model=ContractExtensionsOutput,
    dependencies=[Depends(verify_token)],
)
async def extensions_generate(body: ExtensionsRequest) -> ContractExtensionsOutput:
    require_ai()
    return await generate_contract_extensions(body.completedDeliverables, body.chatSummary)


# --------------------------------------------------------------------------
# GitHub onboarding (roles/01, 01a) — deterministic core + parallel agents.
# NOTE: no require_ai() guard: this works WITHOUT a Gemini key (facts-only
# results at lower confidence). The LLM is a last-mile enhancement.
# --------------------------------------------------------------------------

@app.post(
    "/ai/github/scan",
    response_model=GithubScanResult,
    dependencies=[Depends(verify_token)],
)
async def github_scan(body: GithubScanRequest) -> GithubScanResult:
    try:
        return await run_github_scan(
            body.githubUsername,
            body.accessToken,
            body.topN,
            profile_readme=body.profileReadme,
            profile_bio=body.profileBio,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/github/scan/stream", dependencies=[Depends(verify_token)])
async def github_scan_stream(body: GithubScanRequest) -> StreamingResponse:
    """Server-Sent Events: emits each segment as it completes (progressive reveal).

    The TS gateway proxies these events to the browser's EventSource so the
    freelancer dashboard reveals Skills / Projects / Experience one by one.
    """
    async def event_source():
        async for event, payload in stream_github_scan(
            body.githubUsername,
            body.accessToken,
            body.topN,
            profile_readme=body.profileReadme,
            profile_bio=body.profileBio,
        ):
            yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post(
    "/ai/opportunity/score",
    response_model=OpportunityScore,
    dependencies=[Depends(verify_token)],
)
async def opportunity_score(body: ScoreOpportunityRequest) -> OpportunityScore:
    """Evaluate and score a job opportunity lead deterministically against freelancer's verified skills."""
    return score_opportunity(
        body.opportunity,
        body.verified_skills,
        body.client_rating if body.client_rating is not None else 80,
    )


@app.post(
    "/ai/growth/plan",
    response_model=GrowthPlan,
    dependencies=[Depends(verify_token)],
)
async def growth_plan(body: GrowthPlanRequest) -> GrowthPlan:
    """Generate a personalized, actionable growth plan based on freelancer profile confidence breakdown."""
    return await generate_growth_plan(
        body.confidence,
        body.verified_skills,
        body.experience,
    )

