"""FixFlowAI Python AI service (FastAPI).

Owns the four LLM features (AI-001..004). Stateless: it validates input, calls
Gemini, and returns JSON. It never touches the database or payments — the
TypeScript backend remains the gateway and system of record.
"""
from __future__ import annotations

import json
import logging
from typing import Any, List, Optional, Union

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

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
from .schemas.proposal import Proposal

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="FixFlowAI AI Service", version="1.0.0")

settings = get_settings()

if not settings.model_valid:
    raise RuntimeError(f"Invalid GEMINI_MODEL: {settings.gemini_model}")

if not settings.fallback_model_valid:
    raise RuntimeError(f"Invalid GEMINI_FALLBACK_MODEL: {settings.gemini_fallback_model}")


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


class ParseBriefResponse(BaseModel):
    proposal: Proposal


class EvaluateRequest(BaseModel):
    briefText: str = Field(min_length=1)
    proposal: Proposal


class InterviewRequest(BaseModel):
    briefText: str = Field(min_length=1)
    githubScan: Union[str, dict, Any] = ""
    missingSkills: List[str] = Field(default_factory=list)


class ExtensionsRequest(BaseModel):
    completedDeliverables: Union[str, list, Any] = ""
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
    }


@app.post("/ai/brief/parse", response_model=ParseBriefResponse, dependencies=[Depends(verify_token)])
async def brief_parse(body: ParseBriefRequest) -> ParseBriefResponse:
    require_ai()
    proposal = await parse_brief(body.briefText)
    return ParseBriefResponse(proposal=proposal)


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
    return await generate_interview_questions(
        body.briefText, body.githubScan, body.missingSkills
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
        return await run_github_scan(body.githubUsername, body.accessToken, body.topN)
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
            body.githubUsername, body.accessToken, body.topN
        ):
            yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
