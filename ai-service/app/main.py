"""FixFlowAI Python AI service (FastAPI).

Owns the four LLM features (AI-001..004). Stateless: it validates input, calls
Gemini, and returns JSON. It never touches the database or payments — the
TypeScript backend remains the gateway and system of record.
"""
from __future__ import annotations

import hmac
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
from .schemas.discovery import DiscoveryRequest, DiscoveryTurn
from .features.discovery import run_discovery_turn
from .schemas.execution_plan import ExecutionPlan, PlanDiagnostics
from .features.plan_generator import generate_execution_plan
from .features.timeline_validation import validate_execution_plan
from .keep_alive import start_keep_alive, stop_keep_alive

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
    logging.warning("Invalid GEMINI_MODEL '%s'. Falling back to '%s'", settings.gemini_model, settings.DEFAULT_MODEL)

if not settings.fallback_model_valid:
    logging.warning("Invalid GEMINI_FALLBACK_MODEL '%s'. Falling back to '%s'", settings.gemini_fallback_model, settings.DEFAULT_FALLBACK_MODEL)

logging.info(
    "FixFlowAI AI Service starting up. Primary model: %s, Fallback model: %s",
    settings.gemini_model if settings.model_valid else settings.DEFAULT_MODEL,
    settings.gemini_fallback_model if settings.fallback_model_valid else settings.DEFAULT_FALLBACK_MODEL
)

if not settings.ai_service_token:
    logging.warning(
        "AI_SERVICE_TOKEN is not configured: the AI service accepts requests "
        "from anyone who can reach it. Set AI_SERVICE_TOKEN to gate the LLM routes."
    )


@app.on_event("startup")
async def _start_keep_alive() -> None:
    """Keep the peer services warm every 10 min while this service is awake."""
    start_keep_alive()


@app.on_event("shutdown")
async def _stop_keep_alive() -> None:
    stop_keep_alive()


# --------------------------------------------------------------------------
# Auth (optional shared secret) + AI-key guard
# --------------------------------------------------------------------------

async def verify_token(x_ai_service_token: Optional[str] = Header(default=None)) -> None:
    expected = get_settings().ai_service_token
    if not expected:
        return  # token auth disabled
    provided = x_ai_service_token or ""
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing x-ai-service-token.")


def require_ai() -> None:
    if not get_settings().ai_enabled:
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


# AI-008 — deep execution plan
class PlanGenerateRequest(BaseModel):
    proposal: Proposal
    briefText: Optional[str] = None
    scope: Literal["all", "architecture", "timeline"] = "all"
    existingPlan: Optional[ExecutionPlan] = None
    preserveClientEdits: bool = True


class PlanValidateRequest(BaseModel):
    executionPlan: ExecutionPlan


class PlanGenerateResponse(BaseModel):
    executionPlan: ExecutionPlan
    diagnostics: PlanDiagnostics
    # How the returned plan came to be: a clean authored pass, an authored pass
    # that needed one subtractive repair, the deterministic derivation, or the
    # degraded fallback. Requirement 9.5.
    authoringSource: Literal["authored", "repaired", "derived", "degraded"]


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


@app.post(
    "/ai/plan/generate",
    response_model=PlanGenerateResponse,
    dependencies=[Depends(verify_token)],
)
async def plan_generate(body: PlanGenerateRequest) -> PlanGenerateResponse:
    """AI-008 — build (or regenerate a section of) a deep v2 execution plan from
    a proposal. Deterministic and always returns a validator-clean plan; the
    numeric diagnostics are recomputed here, never trusted from any LLM."""
    existing = body.existingPlan
    if existing is not None:
        # Drop anything the caller sent as diagnostics: only this service's
        # deterministic validator may produce them, so they cannot be smuggled
        # in past the validator. Requirement 9.2.
        existing.diagnostics = None

    plan = await generate_execution_plan(
        body.proposal,
        scope=body.scope,
        existing_plan=existing,
        preserve_client_edits=body.preserveClientEdits,
        brief_text=body.briefText,
        timeout_sec=get_settings().gemini_plan_timeout_sec,
    )
    diagnostics = plan.diagnostics or validate_execution_plan(plan)
    return PlanGenerateResponse(
        executionPlan=plan,
        diagnostics=diagnostics,
        authoringSource=plan.authoringSource or "derived",
    )


@app.post(
    "/ai/plan/validate",
    response_model=PlanDiagnostics,
    dependencies=[Depends(verify_token)],
)
async def plan_validate(body: PlanValidateRequest) -> PlanDiagnostics:
    """AI-008 — recompute deterministic diagnostics for a plan (called by the
    backend after every accepted client edit). Pure; no LLM, no side effects."""
    # Any inbound diagnostics are discarded before the plan is read, so a caller
    # cannot smuggle a figure past the validator. Requirement 9.2.
    body.executionPlan.diagnostics = None
    return validate_execution_plan(body.executionPlan)


@app.post(
    "/ai/discovery/next",
    response_model=DiscoveryTurn,
    dependencies=[Depends(verify_token)],
)
async def discovery_next(body: DiscoveryRequest) -> DiscoveryTurn:
    """Requirement Discovery Agent (Talent section): given the initial request
    and the answers gathered so far, return the next adaptive question or the
    finished structured brief once confidence is high enough."""
    require_ai()
    return await run_discovery_turn(body.initialRequest, body.answers)

