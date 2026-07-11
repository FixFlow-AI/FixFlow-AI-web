"""Orchestrator — wires the pipeline with asyncio.

fetch (facts) -> aggregate (facts) -> [skills ‖ projects ‖ experience] -> confidence.

Two entry points:
  - run_github_scan:    awaits everything, returns the full GithubScanResult.
  - stream_github_scan: async-generates ("segment_ready" / "scan_complete")
                        events as each segment finishes (progressive reveal).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional, Tuple

from ...config import get_settings
from ...schemas.github import (
    ExperienceSignals,
    GithubScanResult,
    SegmentStatus,
)
from . import agents
from .aggregate import aggregate_repos
from .client import fetch_profile_repos

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _prepare(username: str, access_token: Optional[str], top_n: Optional[int]) -> Tuple[int, dict]:
    settings = get_settings()
    n = top_n or settings.scan_top_n_repos
    discovered, repos, user_meta = await fetch_profile_repos(username, access_token, n)
    agg = aggregate_repos(repos, user_meta)
    return discovered, agg


async def _skills_wrapped(agg: dict):
    return ("skills", await agents.skills_agent(agg))


async def _projects_wrapped(agg: dict):
    return ("projects", await agents.projects_agent(agg))


async def run_github_scan(
    username: str,
    access_token: Optional[str] = None,
    top_n: Optional[int] = None,
) -> GithubScanResult:
    discovered, agg = await _prepare(username, access_token, top_n)

    # Skills + Projects (LLM last-mile) run in parallel; Experience is pure math.
    (skills, skills_state), (projects, projects_state) = await asyncio.gather(
        agents.skills_agent(agg),
        agents.projects_agent(agg),
    )
    experience, experience_state = agents.experience_agent(agg)
    confidence = agents.confidence_agent(skills, projects, experience, agg)

    return GithubScanResult(
        githubUsername=username,
        reposDiscovered=discovered,
        reposAnalyzed=agg["reposAnalyzed"],
        languages=agg["languagePercents"],
        skills=skills,
        projects=projects,
        experience=experience,
        confidence=confidence,
        segmentStatus=SegmentStatus(
            skills=skills_state, projects=projects_state, experience=experience_state
        ),
        scannedAt=_now(),
    )


async def stream_github_scan(
    username: str,
    access_token: Optional[str] = None,
    top_n: Optional[int] = None,
) -> AsyncIterator[Tuple[str, dict]]:
    """Yields (event, payload) tuples. Segments are emitted as they complete."""
    try:
        discovered, agg = await _prepare(username, access_token, top_n)
    except Exception as error:  # noqa: BLE001
        yield ("scan_error", {"error": str(error)})
        return

    yield (
        "scan_started",
        {"githubUsername": username, "reposDiscovered": discovered, "reposAnalyzed": agg["reposAnalyzed"]},
    )

    # Experience is deterministic and instant — reveal it immediately.
    experience, experience_state = agents.experience_agent(agg)
    yield (
        "segment_ready",
        {"segment": "experience", "state": experience_state, "payload": experience.model_dump()},
    )

    # Skills + Projects race — reveal each the moment it finishes.
    collected: dict[str, Any] = {"experience": experience}
    states: dict[str, str] = {"experience": experience_state}
    tasks = [
        asyncio.create_task(_skills_wrapped(agg)),
        asyncio.create_task(_projects_wrapped(agg)),
    ]
    for coro in asyncio.as_completed(tasks):
        name, (data, state) = await coro
        collected[name] = data
        states[name] = state
        payload = [item.model_dump() for item in data]
        yield ("segment_ready", {"segment": name, "state": state, "payload": payload})

    # Confidence after all three land (pure math).
    confidence = agents.confidence_agent(
        collected["skills"], collected["projects"], collected["experience"], agg
    )

    result = GithubScanResult(
        githubUsername=username,
        reposDiscovered=discovered,
        reposAnalyzed=agg["reposAnalyzed"],
        languages=agg["languagePercents"],
        skills=collected["skills"],
        projects=collected["projects"],
        experience=collected["experience"],
        confidence=confidence,
        segmentStatus=SegmentStatus(
            skills=states.get("skills", "fallback"),
            projects=states.get("projects", "fallback"),
            experience=states.get("experience", "done"),
        ),
        scannedAt=_now(),
    )
    yield ("scan_complete", result.model_dump())
