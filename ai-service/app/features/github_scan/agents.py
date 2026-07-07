"""The parallel segment agents.

Each agent owns one segment, runs independently, and degrades to a deterministic
fallback if the (optional) LLM step fails — so a scan always completes.

Only the Skills and Projects agents call the LLM, and only for the last-mile
semantic step (name normalization / short summaries), using the cheap
fallback model in a single batched call each. Experience and Confidence are
pure math (zero LLM).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from ...config import get_settings
from ...llm.gemini import generate_structured
from ...schemas.github import (
    ConfidenceBand,
    ConfidenceFactorBreakdown,
    ExperienceSignals,
    FreelancerProject,
    ProfileConfidence,
    ProjectSummariesOutput,
    SegmentState,
    SkillEvidence,
    SkillNormalizationOutput,
    VerifiedSkill,
)

logger = logging.getLogger(__name__)

_SKILL_NORM_PROMPT = """You are a skill normalizer for a developer profiling system.
You are given candidate skill names already extracted from real code, plus repository topics.
Your ONLY job is to return clean, canonical, de-duplicated skill names — never invent skills that aren't implied by the input.
For each input token, return the normalized display name (e.g. "reactjs" -> "React", "tf" -> "TensorFlow") and a category (language, framework, tool, or domain).
Output strict JSON for the requested schema. No markdown, no extra prose."""

_PROJECT_SUMMARY_PROMPT = """You are a technical writer summarizing a developer's top GitHub projects.
For each project you are given the repo name, description, topics, and detected stack.
Write a single concise sentence (max 25 words) describing what the project does, and infer a short domain label (e.g. "fintech", "devtools", "e-commerce", "ml").
Base the summary only on the provided facts — do not invent features.
Output strict JSON for the requested schema. No markdown, no extra prose."""


def _lite_model() -> str:
    """Force the cheap model for last-mile calls (cost control)."""
    return get_settings().gemini_fallback_model


def _parse_iso(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


# ───────────────────────── Skills Agent ─────────────────────────

def _deterministic_skills(agg: Dict[str, Any]) -> List[VerifiedSkill]:
    skills: List[VerifiedSkill] = []

    # Languages — confidence from byte-share % and how many repos use it.
    percents: Dict[str, int] = agg["languagePercents"]
    lang_repos: Dict[str, List[str]] = agg["languageRepos"]
    for lang, pct in sorted(percents.items(), key=lambda kv: kv[1], reverse=True):
        repos_using = lang_repos.get(lang, [])
        conf = min(100, 40 + int(pct * 0.4) + min(len(repos_using), 6) * 5)
        skills.append(
            VerifiedSkill(
                name=lang,
                category="language",
                confidence=conf,
                evidence=[
                    SkillEvidence(repo=r, signal="language", detail=f"{pct}% of code")
                    for r in repos_using[:5]
                ],
            )
        )

    # Frameworks / tools — confidence from how many repos use it.
    for name, info in agg["frameworks"].items():
        repos_using = info["repos"]
        conf = min(100, 50 + len(repos_using) * 15)
        skills.append(
            VerifiedSkill(
                name=name,
                category=info["category"],  # "framework" | "tool"
                confidence=conf,
                evidence=[SkillEvidence(**e) for e in info["evidence"][:5]],
            )
        )

    return skills


async def skills_agent(agg: Dict[str, Any]) -> Tuple[List[VerifiedSkill], SegmentState]:
    det = _deterministic_skills(agg)
    settings = get_settings()
    if not settings.ai_enabled:
        return det, "fallback"

    # topic -> repos, so any LLM-added topic skill still carries real evidence.
    topic_repos: Dict[str, List[str]] = {}
    for r in agg["repos"]:
        for t in (r.get("topics") or []):
            topic_repos.setdefault(t.lower(), []).append(r["name"])

    candidate_names = [s.name for s in det]
    topics = agg.get("domainTopics", [])
    if not topics and not candidate_names:
        return det, "fallback"

    contents = (
        f"Candidate skill names: {json.dumps(candidate_names)}\n"
        f"Repository topics: {json.dumps(topics)}"
    )
    try:
        out: SkillNormalizationOutput = await generate_structured(
            system_instruction=_SKILL_NORM_PROMPT,
            contents=contents,
            response_schema=SkillNormalizationOutput,
            temperature=0.1,
            model=_lite_model(),
        )
    except Exception as error:  # noqa: BLE001
        logger.warning("Skills Agent LLM step failed, using deterministic: %s", error)
        return det, "fallback"

    by_name = {s.name.lower(): s for s in det}
    for norm in out.skills:
        canonical = norm.normalized.strip()
        if not canonical or norm.category == "domain":
            continue
        raw_key = norm.raw.strip().lower()
        if raw_key in by_name:
            continue  # already have it deterministically (keep real evidence)
        # Only add a topic-derived skill that has real repo evidence.
        repos_for = topic_repos.get(raw_key, [])
        if not repos_for or canonical.lower() in by_name:
            continue
        skill = VerifiedSkill(
            name=canonical,
            category=norm.category,  # language|framework|tool
            confidence=55,
            evidence=[
                SkillEvidence(repo=r, signal="topic", detail=f"topic: {norm.raw}")
                for r in repos_for[:5]
            ],
        )
        det.append(skill)
        by_name[canonical.lower()] = skill

    return det, "done"


# ───────────────────────── Projects Agent ─────────────────────────

def _recency_score(pushed_at: Any) -> int:
    d = _parse_iso(pushed_at)
    if not d:
        return 20
    days = (datetime.now(timezone.utc) - d).days
    if days <= 90:
        return 100
    if days <= 180:
        return 80
    if days <= 365:
        return 60
    if days <= 730:
        return 40
    return 20


def _commit_share(repo: Dict[str, Any]) -> int:
    # Ownership/authorship proxy (accurate author-history is a future refinement).
    if repo.get("isOwner") and not repo.get("isFork"):
        return 90
    if repo.get("isOwner"):
        return 60
    return 40


def _repo_stack(repo: Dict[str, Any], agg: Dict[str, Any]) -> List[str]:
    stack: List[str] = []
    if repo.get("primaryLanguage"):
        stack.append(repo["primaryLanguage"])
    for name, info in agg["frameworks"].items():
        if repo["name"] in info["repos"]:
            stack.append(name)
    return stack[:8]


def _rank_repos(agg: Dict[str, Any], top_k: int = 8) -> List[Dict[str, Any]]:
    scored = []
    for r in agg["repos"]:
        score = (
            r.get("stars", 0) * 3
            + _commit_share(r)
            + _recency_score(r.get("pushedAt"))
            + (15 if r.get("description") else 0)
        )
        scored.append((score, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:top_k]]


async def projects_agent(agg: Dict[str, Any]) -> Tuple[List[FreelancerProject], SegmentState]:
    top = _rank_repos(agg)
    settings = get_settings()

    # Deterministic base (also the fallback).
    base: List[FreelancerProject] = []
    for r in top:
        stack = _repo_stack(r, agg)
        base.append(
            FreelancerProject(
                repoName=r["name"],
                summary=r.get("description") or f"{(r.get('primaryLanguage') or 'Software')} project.",
                domain=(r.get("topics") or [None])[0],
                stack=stack,
                stars=r.get("stars", 0),
                commitShare=_commit_share(r),
                lastActiveAt=r.get("pushedAt"),
                rankScore=r.get("stars", 0) * 3 + _commit_share(r) + _recency_score(r.get("pushedAt")),
            )
        )

    if not settings.ai_enabled or not base:
        return base, "fallback"

    payload = [
        {
            "repoName": p.repoName,
            "description": p.summary,
            "topics": (next((r.get("topics") for r in top if r["name"] == p.repoName), []) or [])[:6],
            "stack": p.stack,
        }
        for p in base
    ]
    try:
        out: ProjectSummariesOutput = await generate_structured(
            system_instruction=_PROJECT_SUMMARY_PROMPT,
            contents=f"Projects: {json.dumps(payload)}",
            response_schema=ProjectSummariesOutput,
            temperature=0.2,
            model=_lite_model(),
        )
    except Exception as error:  # noqa: BLE001
        logger.warning("Projects Agent LLM step failed, using deterministic: %s", error)
        return base, "fallback"

    summaries = {s.repoName: s for s in out.projects}
    for p in base:
        s = summaries.get(p.repoName)
        if s:
            p.summary = s.summary or p.summary
            p.domain = s.domain or p.domain
    return base, "done"


# ───────────────────────── Experience Agent (pure math) ─────────────────────────

def experience_agent(agg: Dict[str, Any]) -> Tuple[ExperienceSignals, SegmentState]:
    return (
        ExperienceSignals(
            totalCommits=agg["totalCommits"],
            reposAnalyzed=agg["reposAnalyzed"],
            activeYears=agg["activeYears"],
            avgStars=agg["avgStars"],
            collaborationRepos=agg["collaborationRepos"],
            documentationQuality=agg["documentationQuality"],
        ),
        "done",
    )


# ───────────────────────── Confidence Agent (pure math) ─────────────────────────

def _band(score: int, threshold: int) -> ConfidenceBand:
    if score >= threshold:
        return "match_ready"
    if score >= 50:
        return "developing"
    return "emerging"


def confidence_agent(
    skills: List[VerifiedSkill],
    projects: List[FreelancerProject],
    experience: ExperienceSignals,
    agg: Dict[str, Any],
) -> ProfileConfidence:
    # Skill breadth × depth (30%)
    avg_conf = round(sum(s.confidence for s in skills) / len(skills)) if skills else 0
    skill_score = min(100, round(min(100, len(skills) * 6) * 0.5 + avg_conf * 0.5))

    # Project strength (25%)
    project_score = min(100, len(projects) * 12 + min(int(experience.avgStars * 2), 40))

    # Recency (20%)
    recency_score = _recency_score(agg.get("mostRecentPush"))

    # Contribution volume (15%)
    contribution_score = min(100, round(experience.totalCommits / 10))

    # Documentation (10%)
    documentation_score = experience.documentationQuality

    total = round(
        0.30 * skill_score
        + 0.25 * project_score
        + 0.20 * recency_score
        + 0.15 * contribution_score
        + 0.10 * documentation_score
    )
    total = max(0, min(100, total))
    threshold = get_settings().profile_confidence_threshold

    return ProfileConfidence(
        score=total,
        band=_band(total, threshold),
        factorBreakdown=ConfidenceFactorBreakdown(
            skillBreadthDepth=skill_score,
            projectStrength=project_score,
            recency=recency_score,
            contributionVolume=contribution_score,
            documentation=documentation_score,
        ),
    )
