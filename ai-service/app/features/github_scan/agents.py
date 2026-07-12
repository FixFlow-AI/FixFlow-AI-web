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

_SKILL_NORM_PROMPT = """You normalize developer skill names for a trust-critical profiling system.
INPUT: candidate skill tokens already extracted from a user's REAL code + their repository topics.
YOUR ONLY JOB: map each input token to a clean, canonical display name and a category.

HARD RULES (a client's hiring decision depends on this — accuracy over creativity):
- NEVER invent, infer, or add a skill that is not directly present in the input tokens.
- NEVER output confidence, percentages, seniority, or years — those are computed elsewhere from measured data. You output names and categories ONLY.
- Return exactly one entry per DISTINCT canonical skill; drop duplicates and near-duplicates (e.g. "reactjs"+"react" -> one "React").
- category must be one of: language, framework, tool, domain.
- Examples: "reactjs" -> {normalized:"React", category:"framework"}; "tf" -> {normalized:"TensorFlow", category:"framework"}; "postgres" -> {normalized:"PostgreSQL", category:"tool"}.
- If a token is meaningless or not a real technology, omit it.
Output strict JSON for the requested schema. No markdown, no prose."""

_PROJECT_SUMMARY_PROMPT = """You summarize a developer's real GitHub projects for a client-facing profile.
For each project you get: repo name, its actual description, real topics, and the detected tech stack.

HARD RULES (this is shown to paying clients — no fabrication):
- Write ONE factual sentence (max 25 words) describing what the project does, grounded ONLY in the provided description/topics/stack.
- If the description is empty, describe it conservatively from the stack/topics (e.g. "A TypeScript web application.") — do NOT invent features, users, or metrics.
- Infer a short lowercase domain label from the evidence (e.g. "fintech", "devtools", "e-commerce", "ml", "web"). If unclear, use "software".
- Never mention stars, popularity, or claims you cannot derive from the input.
Output strict JSON for the requested schema. No markdown, no prose."""


import math

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


# ───────────────────────── Scoring primitives (0..1) ─────────────────────────
#
# Every skill confidence is a weighted blend of *measured* signals. Nothing is
# a flat constant, so two skills with different real footprints get different
# scores — and the number is fully explainable from the evidence we attach.

# ~200 KB of code you actually authored in a language ≈ deep proficiency.
_VOLUME_REF_BYTES = 200_000.0
_STAR_REF = 120.0


def _log_ratio(value: float, reference: float) -> float:
    if value <= 0:
        return 0.0
    return min(1.0, math.log1p(value) / math.log1p(reference))


def _recency_unit(pushed_at: Any) -> float:
    """1.0 for active-this-quarter down to ~0.1 for years-stale."""
    d = _parse_iso(pushed_at)
    if not d:
        return 0.2
    days = (datetime.now(timezone.utc) - d).days
    if days <= 90:
        return 1.0
    if days <= 180:
        return 0.85
    if days <= 365:
        return 0.65
    if days <= 730:
        return 0.45
    if days <= 1460:
        return 0.25
    return 0.1


def _avg(values: List[float]) -> float:
    return (sum(values) / len(values)) if values else 0.0


def _blend(weights: Dict[str, float], scores: Dict[str, float]) -> int:
    total = sum(weights.values()) or 1.0
    acc = sum(weights[k] * scores.get(k, 0.0) for k in weights)
    return max(1, min(100, round(100 * acc / total)))


# ───────────────────────── Skills Agent ─────────────────────────

def _language_skill(lang: str, agg: Dict[str, Any]) -> VerifiedSkill:
    attributed = float((agg.get("attributedBytes") or {}).get(lang, 0.0))
    repos_using: List[str] = (agg.get("languageRepos") or {}).get(lang, [])
    ownership = _avg((agg.get("languageOwnership") or {}).get(lang, []))
    recency = _recency_unit((agg.get("languageRecent") or {}).get(lang))
    stars = int((agg.get("languageStars") or {}).get(lang, 0))
    pct = int((agg.get("languagePercents") or {}).get(lang, 0))

    scores = {
        "volume": _log_ratio(attributed, _VOLUME_REF_BYTES),   # bytes YOU wrote
        "breadth": min(1.0, len(repos_using) / 5.0),           # used across repos
        "recency": recency,                                    # still current
        "ownership": ownership,                                # your share of repos
        "impact": _log_ratio(stars, _STAR_REF),                # in notable work
    }
    weights = {"volume": 0.42, "breadth": 0.18, "recency": 0.15, "ownership": 0.15, "impact": 0.10}
    conf = _blend(weights, scores)

    kb = round(attributed / 1024)
    return VerifiedSkill(
        name=lang,
        category="language",
        confidence=conf,
        evidence=[
            SkillEvidence(
                repo=r,
                signal="language",
                detail=f"{pct}% of your authored code · ~{kb} KB written",
            )
            for r in repos_using[:5]
        ],
    )


def _framework_skill(name: str, info: Dict[str, Any]) -> VerifiedSkill:
    repos_using = info.get("repos") or []
    ownership = _avg(info.get("ownership") or [])
    recency = _recency_unit(info.get("recent"))
    stars = int(info.get("stars") or 0)
    direct = 1.0 if info.get("directDep") else 0.4  # a real dependency > a topic tag

    scores = {
        "breadth": min(1.0, len(repos_using) / 4.0),
        "recency": recency,
        "ownership": ownership,
        "evidence": direct,
        "impact": _log_ratio(stars, _STAR_REF),
    }
    weights = {"breadth": 0.34, "recency": 0.20, "ownership": 0.16, "evidence": 0.20, "impact": 0.10}
    conf = _blend(weights, scores)

    return VerifiedSkill(
        name=name,
        category=info["category"],  # "framework" | "tool"
        confidence=conf,
        evidence=[SkillEvidence(**e) for e in (info.get("evidence") or [])[:5]],
    )


def _deterministic_skills(agg: Dict[str, Any]) -> List[VerifiedSkill]:
    skills: List[VerifiedSkill] = []

    # Languages — multi-signal confidence (authored volume, breadth, recency,
    # ownership, impact). We skip languages the user barely authored so the
    # profile isn't padded with noise from forked/boilerplate files.
    percents: Dict[str, int] = agg.get("languagePercents") or {}
    attributed: Dict[str, float] = agg.get("attributedBytes") or {}
    for lang in sorted(percents, key=lambda k: percents[k], reverse=True):
        # Require some authored footprint OR a meaningful share to list it.
        if attributed.get(lang, 0.0) < 500 and percents.get(lang, 0) < 3:
            continue
        skills.append(_language_skill(lang, agg))

    # Frameworks / tools — from real dependencies + topics.
    for name, info in (agg.get("frameworks") or {}).items():
        skills.append(_framework_skill(name, info))

    skills.sort(key=lambda s: s.confidence, reverse=True)
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
        skill = _topic_skill(canonical, norm.category, norm.raw, repos_for, agg)
        det.append(skill)
        by_name[canonical.lower()] = skill

    det.sort(key=lambda s: s.confidence, reverse=True)
    return det, "done"


def _topic_skill(
    canonical: str, category: str, raw: str, repos_for: List[str], agg: Dict[str, Any]
) -> VerifiedSkill:
    """Confidence for a topic-declared skill — measured from the repos that
    declare it (breadth, recency, ownership), never a flat constant. Topic tags
    are self-declared, so we weight them a notch below code-proven skills."""
    repo_index = {r["name"]: r for r in agg.get("repos", [])}
    subset = [repo_index[n] for n in repos_for if n in repo_index]
    ownership = _avg([float(r.get("ownershipShare") or 0.0) for r in subset])
    recent = max((r.get("pushedAt") or "") for r in subset) if subset else ""
    stars = sum(int(r.get("stars") or 0) for r in subset)

    scores = {
        "breadth": min(1.0, len(repos_for) / 4.0),
        "recency": _recency_unit(recent),
        "ownership": ownership,
        "impact": _log_ratio(stars, _STAR_REF),
    }
    # Self-declared → capped lower than dependency/code evidence.
    weights = {"breadth": 0.4, "recency": 0.25, "ownership": 0.2, "impact": 0.15}
    conf = min(70, _blend(weights, scores))

    return VerifiedSkill(
        name=canonical,
        category=category if category in ("language", "framework", "tool") else "tool",
        confidence=conf,
        evidence=[
            SkillEvidence(repo=r, signal="topic", detail=f"declared topic: {raw}")
            for r in repos_for[:5]
        ],
    )


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
    """Real ownership: measured from commit authorship (or lines authored when
    the contributor-stats pass covered this repo). Never an assumption."""
    return max(0, min(100, round(float(repo.get("ownershipShare") or 0.0) * 100)))


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


def _project_complexity(repo: Dict[str, Any], stack: List[str]) -> str:
    """Derive a Low/Medium/High complexity index from REAL repo structure —
    language spread, stack breadth, commit history depth, and codebase size.
    Deterministic and explainable (no hallucination)."""
    langs = len(repo.get("languages") or {})
    commits = int(repo.get("totalCommits") or 0)
    disk_kb = int(repo.get("diskUsage") or 0)   # GitHub reports KB
    stack_n = len(stack)

    score = 0
    score += min(langs, 6)
    score += min(stack_n, 6)
    score += 3 if commits >= 100 else 2 if commits >= 30 else 1 if commits >= 8 else 0
    score += 3 if disk_kb >= 20000 else 2 if disk_kb >= 5000 else 1 if disk_kb >= 800 else 0

    if score >= 11:
        return "High"
    if score >= 6:
        return "Medium"
    return "Low"


async def projects_agent(agg: Dict[str, Any]) -> Tuple[List[FreelancerProject], SegmentState]:
    top = _rank_repos(agg)
    settings = get_settings()

    # Deterministic base (also the fallback).
    base: List[FreelancerProject] = []
    for r in top:
        stack = _repo_stack(r, agg)
        owner = r.get("owner") or ""
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
                url=f"https://github.com/{owner}/{r['name']}" if owner else None,
                primaryLanguage=r.get("primaryLanguage") or None,
                languageCount=len(r.get("languages") or {}),
                complexity=_project_complexity(r, stack),
                commits=int(r.get("userCommits") or 0),
                commitActivity=[int(x) for x in (r.get("commitActivity") or [])],
                updatedAt=r.get("pushedAt"),
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

    # Grounding context (profile bio + README) helps the LLM infer accurate
    # domains/summaries. It is background only — the rules forbid inventing
    # anything not evidenced by each repo's own facts.
    context_parts: List[str] = []
    bio = (agg.get("profileBio") or "").strip()
    readme = (agg.get("profileReadme") or "").strip()
    if bio:
        context_parts.append(f"Developer bio: {bio}")
    if readme:
        context_parts.append(f"Developer profile README (context only):\n{readme[:2000]}")
    context_block = ("\n\n".join(context_parts) + "\n\n") if context_parts else ""

    try:
        out: ProjectSummariesOutput = await generate_structured(
            system_instruction=_PROJECT_SUMMARY_PROMPT,
            contents=f"{context_block}Projects: {json.dumps(payload)}",
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
            # The user's OWN authored commits — not everyone's on the branch.
            totalCommits=agg["authoredCommits"],
            reposAnalyzed=agg["reposAnalyzed"],
            activeYears=agg["activeYears"],
            avgStars=agg["avgStars"],
            collaborationRepos=agg["collaborationRepos"],
            documentationQuality=agg["documentationQuality"],
            linesAuthored=agg.get("userLinesAuthored", 0),
            pullRequests=agg.get("pullRequests", 0),
            accountAgeYears=agg.get("accountAgeYears", 0.0),
            followers=agg.get("followers", 0),
            totalStars=agg.get("totalStars", 0),
            contributionsPerWeek=agg.get("contributionsPerWeek", 0.0),
            collaborationScore=agg.get("collaborationScore", 0),
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

    # Contribution volume (15%) — authored commits + recent PR activity.
    contribution_score = min(
        100,
        round(experience.totalCommits / 12) + min(experience.pullRequests * 2, 30),
    )

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
