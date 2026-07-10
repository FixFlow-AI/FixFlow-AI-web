"""Deterministic aggregation — turns raw repos into a compact summary.

Zero LLM. This is where facts become the profile: language percentages,
framework detection (from dependency manifests + topics), and the rollup
signals the agents score against.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

# Canonical skill names — the LLM only sees the long tail this table misses.
SYNONYMS: Dict[str, str] = {
    "reactjs": "React", "react": "React",
    "nextjs": "Next.js", "next": "Next.js",
    "nodejs": "Node.js", "node": "Node.js",
    "js": "JavaScript", "ts": "TypeScript",
    "postgres": "PostgreSQL", "pg": "PostgreSQL",
    "k8s": "Kubernetes",
}

# dependency / topic token  ->  (canonical skill, category)
DEP_TO_SKILL: Dict[str, tuple[str, str]] = {
    # frameworks
    "react": ("React", "framework"),
    "next": ("Next.js", "framework"),
    "vue": ("Vue", "framework"),
    "@angular/core": ("Angular", "framework"),
    "svelte": ("Svelte", "framework"),
    "express": ("Express", "framework"),
    "fastapi": ("FastAPI", "framework"),
    "django": ("Django", "framework"),
    "flask": ("Flask", "framework"),
    "nestjs": ("NestJS", "framework"),
    "@nestjs/core": ("NestJS", "framework"),
    # data / infra tools
    "prisma": ("Prisma", "tool"),
    "@prisma/client": ("Prisma", "tool"),
    "mongoose": ("MongoDB", "tool"),
    "pg": ("PostgreSQL", "tool"),
    "psycopg2": ("PostgreSQL", "tool"),
    "redis": ("Redis", "tool"),
    "ioredis": ("Redis", "tool"),
    "graphql": ("GraphQL", "tool"),
    "socket.io": ("WebSockets", "tool"),
    "ws": ("WebSockets", "tool"),
    "zod": ("Zod", "tool"),
    "tailwindcss": ("Tailwind CSS", "tool"),
    "docker": ("Docker", "tool"),
    "kubernetes": ("Kubernetes", "tool"),
    # cloud / payments
    "boto3": ("AWS", "tool"),
    "@aws-sdk/client-dynamodb": ("AWS", "tool"),
    "stripe": ("Stripe", "tool"),
    "razorpay": ("Razorpay", "tool"),
    # ml / data
    "torch": ("PyTorch", "framework"),
    "tensorflow": ("TensorFlow", "framework"),
    "pandas": ("pandas", "tool"),
    "numpy": ("NumPy", "tool"),
    # testing
    "jest": ("Jest", "tool"),
    "pytest": ("pytest", "tool"),
    "vitest": ("Vitest", "tool"),
}


def normalize(token: str) -> str:
    t = (token or "").strip().lower()
    return SYNONYMS.get(t, token)


def _parse_iso(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def aggregate_repos(repos: List[Dict[str, Any]]) -> Dict[str, Any]:
    languages: Dict[str, int] = {}
    language_repos: Dict[str, List[str]] = {}
    frameworks: Dict[str, Dict[str, Any]] = {}

    total_commits = 0
    total_stars = 0
    collaboration_repos = 0
    documented = 0
    dates: List[datetime] = []

    for r in repos:
        total_commits += r.get("totalCommits", 0)
        total_stars += r.get("stars", 0)
        if not r.get("isOwner", True):
            collaboration_repos += 1
        if r.get("description") and r.get("topics"):
            documented += 1
        for d in (_parse_iso(r.get("createdAt")), _parse_iso(r.get("pushedAt"))):
            if d:
                dates.append(d)

        # languages (bytes)
        for lang, size in (r.get("languages") or {}).items():
            languages[lang] = languages.get(lang, 0) + int(size)
            language_repos.setdefault(lang, [])
            if r["name"] not in language_repos[lang]:
                language_repos[lang].append(r["name"])

        # frameworks/tools from manifest deps + topics
        tokens = list(r.get("manifestDeps") or []) + [
            t.lower() for t in (r.get("topics") or [])
        ]
        for tok in tokens:
            hit = DEP_TO_SKILL.get(tok)
            if not hit:
                continue
            canonical, category = hit
            fw = frameworks.setdefault(
                canonical, {"category": category, "repos": [], "evidence": []}
            )
            if r["name"] not in fw["repos"]:
                fw["repos"].append(r["name"])
                fw["evidence"].append(
                    {"repo": r["name"], "signal": "dependency", "detail": f"uses {tok}"}
                )

    total_bytes = sum(languages.values()) or 1
    language_percents = {
        lang: round(size * 100 / total_bytes) for lang, size in languages.items()
    }

    repos_n = len(repos) or 1
    active_years = 0.0
    if dates:
        span = (max(dates) - min(dates)).days / 365.25
        active_years = round(max(span, 0.0), 1)

    documentation_quality = round(documented * 100 / repos_n)

    # Domain hints for the Projects Agent (non-framework topics).
    domain_topics: List[str] = []
    for r in repos:
        for t in (r.get("topics") or []):
            if t.lower() not in DEP_TO_SKILL and t not in domain_topics:
                domain_topics.append(t)

    return {
        "languages": languages,
        "languagePercents": language_percents,
        "languageRepos": language_repos,
        "frameworks": frameworks,
        "repos": repos,
        "reposAnalyzed": len(repos),
        "totalCommits": total_commits,
        "avgStars": round(total_stars / repos_n, 1),
        "activeYears": active_years,
        "collaborationRepos": collaboration_repos,
        "documentationQuality": documentation_quality,
        "domainTopics": domain_topics[:20],
        "mostRecentPush": max((r.get("pushedAt") or "") for r in repos) if repos else "",
    }
