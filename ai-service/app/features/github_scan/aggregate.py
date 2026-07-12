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


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _years_between(a: datetime | None, b: datetime | None) -> float:
    if not a or not b:
        return 0.0
    return round(max((b - a).days / 365.25, 0.0), 1)


def aggregate_repos(
    repos: List[Dict[str, Any]], user_meta: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    """Turn raw repos + user identity into an attribution-aware summary.

    The central idea: every language/framework signal is weighted by how much of
    the repo the user actually authored (ownershipShare), so proficiency
    reflects *their* code — not code that merely sits in a repo they forked or
    joined. All numbers are measured; none are assumed.
    """
    user_meta = user_meta or {}

    # Per-language rollups. `attributed_bytes` = bytes * authorship share.
    languages: Dict[str, int] = {}
    attributed_bytes: Dict[str, float] = {}
    language_repos: Dict[str, List[str]] = {}
    language_recent: Dict[str, str] = {}
    language_stars: Dict[str, int] = {}
    language_ownership: Dict[str, List[float]] = {}

    frameworks: Dict[str, Dict[str, Any]] = {}

    authored_commits = 0     # commits by THIS user (real ownership signal)
    all_branch_commits = 0   # commits by everyone (context only)
    total_stars = 0
    weighted_star_num = 0.0  # Σ stars·ownership — impact credited to authorship
    weighted_star_den = 0.0
    collaboration_repos = 0
    documented = 0
    user_lines = 0
    user_lines_known_repos = 0
    active_dates: List[datetime] = []   # dates for repos the user actually touched

    for r in repos:
        share = float(r.get("ownershipShare") or 0.0)
        authored_commits += int(r.get("userCommits") or 0)
        all_branch_commits += int(r.get("totalCommits") or 0)
        total_stars += r.get("stars", 0)
        # Only credit a repo's stars in proportion to what the user authored, so
        # a single commit to a famous repo can't masquerade as their achievement.
        weighted_star_num += int(r.get("stars") or 0) * share
        weighted_star_den += share

        # A "collaboration" is a repo owned by someone else where the user
        # nonetheless authored real commits — proof they work on teams.
        if not r.get("isOwner", True) and int(r.get("userCommits") or 0) > 0:
            collaboration_repos += 1
        if r.get("description") and r.get("topics"):
            documented += 1
        if "userAdditions" in r:
            user_lines += int(r.get("userAdditions") or 0)
            user_lines_known_repos += 1

        touched = int(r.get("userCommits") or 0) > 0 or r.get("isOwner")
        if touched:
            for d in (_parse_iso(r.get("createdAt")), _parse_iso(r.get("pushedAt"))):
                if d:
                    active_dates.append(d)

        # Languages, weighted by authorship.
        for lang, size in (r.get("languages") or {}).items():
            size = int(size)
            languages[lang] = languages.get(lang, 0) + size
            attributed_bytes[lang] = attributed_bytes.get(lang, 0.0) + size * share
            language_repos.setdefault(lang, [])
            if r["name"] not in language_repos[lang]:
                language_repos[lang].append(r["name"])
            pushed = r.get("pushedAt") or ""
            if pushed > language_recent.get(lang, ""):
                language_recent[lang] = pushed
            # Star impact credited by authorship (same honesty rule as above).
            language_stars[lang] = language_stars.get(lang, 0) + round(int(r.get("stars") or 0) * share)
            language_ownership.setdefault(lang, []).append(share)

        # Frameworks/tools from manifest deps + topics — track breadth, recency,
        # impact and ownership so confidence isn't a flat constant.
        seen_tokens: set[str] = set()
        tokens = list(r.get("manifestDeps") or []) + [
            t.lower() for t in (r.get("topics") or [])
        ]
        for tok in tokens:
            hit = DEP_TO_SKILL.get(tok)
            if not hit:
                continue
            canonical, category = hit
            fw = frameworks.setdefault(
                canonical,
                {
                    "category": category,
                    "repos": [],
                    "evidence": [],
                    "recent": "",
                    "stars": 0,
                    "ownership": [],
                    "directDep": False,
                },
            )
            if r["name"] not in fw["repos"]:
                fw["repos"].append(r["name"])
                is_dep = tok in (r.get("manifestDeps") or [])
                fw["directDep"] = fw["directDep"] or is_dep
                signal = "dependency" if is_dep else "topic"
                fw["evidence"].append(
                    {"repo": r["name"], "signal": signal, "detail": f"uses {tok}"}
                )
                fw["stars"] += round(int(r.get("stars") or 0) * share)
                fw["ownership"].append(share)
                pushed = r.get("pushedAt") or ""
                if pushed > fw["recent"]:
                    fw["recent"] = pushed
            seen_tokens.add(tok)

    # Language percentages from *authored* bytes (fall back to raw bytes only if
    # we somehow have zero attribution — e.g. no commit history anywhere).
    basis = attributed_bytes if sum(attributed_bytes.values()) > 0 else {
        k: float(v) for k, v in languages.items()
    }
    total_basis = sum(basis.values()) or 1.0
    language_percents = {
        lang: round(val * 100 / total_basis) for lang, val in basis.items()
    }

    repos_n = len(repos) or 1

    # Active span from the repos the user actually worked on + account tenure.
    active_years = 0.0
    if active_dates:
        active_years = _years_between(min(active_dates), max(active_dates))
    account_created = _parse_iso(user_meta.get("createdAt"))
    account_age_years = _years_between(account_created, _now()) if account_created else 0.0
    # Prefer the longer, tenure-aware figure but never exceed account age.
    if account_age_years:
        active_years = round(min(max(active_years, 0.0), account_age_years), 1)

    documentation_quality = round(documented * 100 / repos_n)

    # Contributions per week (trailing year commit contributions / 52 weeks).
    contributions_year = int(user_meta.get("commitContributionsYear") or 0)
    contributions_per_week = round(contributions_year / 52.0, 1)

    # Collaboration score (0-100) from REAL team-work signals: repos where the
    # user committed to someone else's project, PRs, and code reviews.
    pull_requests = int(user_meta.get("pullRequests") or 0)
    reviews = int(user_meta.get("reviews") or 0)
    collaboration_score = min(
        100,
        collaboration_repos * 12 + min(pull_requests, 30) * 2 + min(reviews, 20) * 2,
    )

    # Domain hints for the Projects Agent (non-framework topics).
    domain_topics: List[str] = []
    for r in repos:
        for t in (r.get("topics") or []):
            if t.lower() not in DEP_TO_SKILL and t not in domain_topics:
                domain_topics.append(t)

    return {
        "languages": languages,
        "attributedBytes": attributed_bytes,
        "languagePercents": language_percents,
        "languageRepos": language_repos,
        "languageRecent": language_recent,
        "languageStars": language_stars,
        "languageOwnership": language_ownership,
        "frameworks": frameworks,
        "repos": repos,
        "reposAnalyzed": len(repos),
        # authored = the user's own commits (what we surface); allBranch is context.
        "authoredCommits": authored_commits,
        "allBranchCommits": all_branch_commits,
        "userLinesAuthored": user_lines,
        "userLinesKnownRepos": user_lines_known_repos,
        # Ownership-weighted average stars — reflects the impact of the user's
        # OWN work, not stars on repos they merely touched.
        "avgStars": round(weighted_star_num / weighted_star_den, 1) if weighted_star_den > 0 else 0.0,
        "totalStars": total_stars,
        "activeYears": active_years,
        "accountAgeYears": account_age_years,
        "collaborationRepos": collaboration_repos,
        "collaborationScore": collaboration_score,
        "contributionsPerWeek": contributions_per_week,
        "documentationQuality": documentation_quality,
        "followers": int(user_meta.get("followers") or 0),
        "pullRequests": int(user_meta.get("pullRequests") or 0),
        "reviews": int(user_meta.get("reviews") or 0),
        "issues": int(user_meta.get("issues") or 0),
        "domainTopics": domain_topics[:20],
        "mostRecentPush": max((r.get("pushedAt") or "") for r in repos) if repos else "",
    }
