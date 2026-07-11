"""GitHub data fetcher — the deterministic 'facts' layer (no LLM).

Uses the GraphQL API to batch repo metadata in a couple of requests, then a
bounded, best-effort REST pass to read dependency manifests (for framework
detection). All numbers here come straight from GitHub — never an LLM.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from ...config import get_settings

logger = logging.getLogger(__name__)

GITHUB_GRAPHQL = "https://api.github.com/graphql"
GITHUB_REST = "https://api.github.com"

# GitHub's GraphQL endpoint intermittently returns 502/503/504 (transient
# gateway errors) — especially for expensive queries over many repos. These are
# almost always resolved by a retry with a short backoff.
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_RETRIES = 4
_BASE_BACKOFF_SEC = 1.5

# One query pulls everything we need per repo. `pushedAt DESC` puts active work first.
_REPOS_QUERY = """
query($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    repositories(
      first: $first,
      after: $after,
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER],
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        description
        isFork
        isArchived
        stargazerCount
        forkCount
        pushedAt
        createdAt
        primaryLanguage { name }
        owner { login }
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
        repositoryTopics(first: 12) { nodes { topic { name } } }
        defaultBranchRef { target { ... on Commit { history { totalCount } } } }
      }
    }
  }
}
"""


def _resolve_token(access_token: Optional[str]) -> str:
    token = (access_token or "").strip() or get_settings().github_token
    if not token:
        raise ValueError(
            "A GitHub token is required (pass accessToken, or set GITHUB_TOKEN)."
        )
    return token


async def _graphql(client: httpx.AsyncClient, token: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    """POST a GraphQL query, retrying transient gateway errors with backoff.

    GitHub returns 502/503/504 for expensive queries under load. We retry those
    (and 429 rate-limit) up to `_MAX_RETRIES` times. On GraphQL-level errors we
    tolerate partial data (e.g. a single unreadable repo) as long as the `user`
    node came back; we only raise when there's nothing usable.
    """
    last_error: Optional[Exception] = None

    for attempt in range(_MAX_RETRIES):
        try:
            resp = await client.post(
                GITHUB_GRAPHQL,
                headers={"Authorization": f"Bearer {token}", "User-Agent": "FixFlowAI"},
                json={"query": _REPOS_QUERY, "variables": variables},
            )
        except httpx.HTTPError as exc:  # network/timeout — retry
            last_error = exc
            logger.warning(
                "GitHub GraphQL network error (attempt %d/%d): %s",
                attempt + 1, _MAX_RETRIES, exc,
            )
            await asyncio.sleep(_BASE_BACKOFF_SEC * (2 ** attempt))
            continue

        if resp.status_code in _RETRYABLE_STATUS and attempt < _MAX_RETRIES - 1:
            logger.warning(
                "GitHub GraphQL transient %d (attempt %d/%d) — retrying.",
                resp.status_code, attempt + 1, _MAX_RETRIES,
            )
            await asyncio.sleep(_BASE_BACKOFF_SEC * (2 ** attempt))
            continue

        resp.raise_for_status()
        data = resp.json()

        # Tolerate partial results: if we got a usable `user` payload, proceed
        # even when GitHub reports per-field errors (common for one bad repo).
        payload = data.get("data")
        if data.get("errors"):
            if payload and payload.get("user"):
                logger.warning(
                    "GitHub GraphQL returned partial data with errors: %s",
                    data["errors"],
                )
                return payload
            raise RuntimeError(f"GitHub GraphQL error: {data['errors']}")
        return payload

    # Exhausted retries without a usable response.
    raise RuntimeError(
        f"GitHub GraphQL failed after {_MAX_RETRIES} attempts: {last_error or 'transient gateway errors'}"
    )


async def _fetch_manifest(
    client: httpx.AsyncClient, token: str, owner: str, repo: str, path: str
) -> Optional[str]:
    """Best-effort raw file read via the REST contents API. None on any failure."""
    try:
        resp = await client.get(
            f"{GITHUB_REST}/repos/{owner}/{repo}/contents/{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.raw+json",
                "User-Agent": "FixFlowAI",
            },
        )
        if resp.status_code == 200:
            return resp.text
    except Exception:  # noqa: BLE001 - best effort
        pass
    return None


def _parse_manifest_deps(name: str, text: str) -> List[str]:
    """Extract dependency names from package.json / requirements.txt."""
    deps: List[str] = []
    try:
        if name == "package.json":
            obj = json.loads(text)
            for key in ("dependencies", "devDependencies", "peerDependencies"):
                deps.extend((obj.get(key) or {}).keys())
        elif name == "requirements.txt":
            for line in text.splitlines():
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                pkg = line.split("==")[0].split(">=")[0].split("<=")[0]
                pkg = pkg.split("~=")[0].split("[")[0].strip()
                if pkg:
                    deps.append(pkg.lower())
    except Exception:  # noqa: BLE001
        pass
    return deps


async def _enrich_manifests(
    client: httpx.AsyncClient, token: str, repos: List[Dict[str, Any]], concurrency: int
) -> None:
    """Populate repo['manifestDeps'] in place, bounded by a semaphore."""
    sem = asyncio.Semaphore(max(1, concurrency))

    async def one(repo: Dict[str, Any]) -> None:
        owner = repo["owner"]
        name = repo["name"]
        lang = (repo.get("primaryLanguage") or "").lower()
        targets: List[str] = []
        if lang in ("javascript", "typescript"):
            targets.append("package.json")
        if lang == "python":
            targets.append("requirements.txt")
        if not targets:
            # Unknown language: try package.json cheaply; skip otherwise.
            targets.append("package.json")
        async with sem:
            for path in targets:
                text = await _fetch_manifest(client, token, owner, name, path)
                if text:
                    repo["manifestDeps"].extend(_parse_manifest_deps(path, text))
                    break

    await asyncio.gather(*(one(r) for r in repos), return_exceptions=True)


def _node_to_repo(node: Dict[str, Any], login: str) -> Dict[str, Any]:
    languages: Dict[str, int] = {}
    for edge in ((node.get("languages") or {}).get("edges") or []):
        lang_name = ((edge or {}).get("node") or {}).get("name")
        if lang_name:
            languages[lang_name] = int(edge.get("size") or 0)
    topics = [
        ((t or {}).get("topic") or {}).get("name")
        for t in ((node.get("repositoryTopics") or {}).get("nodes") or [])
    ]
    topics = [t for t in topics if t]
    commit_total = 0
    ref = node.get("defaultBranchRef") or {}
    target = ref.get("target") or {}
    history = target.get("history") or {}
    commit_total = int(history.get("totalCount") or 0)
    owner_login = ((node.get("owner") or {}).get("login") or "")
    return {
        "name": node.get("name") or "",
        "description": node.get("description") or "",
        "isFork": bool(node.get("isFork")),
        "isArchived": bool(node.get("isArchived")),
        "stars": int(node.get("stargazerCount") or 0),
        "forks": int(node.get("forkCount") or 0),
        "pushedAt": node.get("pushedAt"),
        "createdAt": node.get("createdAt"),
        "primaryLanguage": ((node.get("primaryLanguage") or {}).get("name") or ""),
        "languages": languages,
        "topics": topics,
        "totalCommits": commit_total,
        "owner": owner_login,
        "isOwner": owner_login.lower() == login.lower(),
        "manifestDeps": [],
    }


async def fetch_profile_repos(
    username: str,
    access_token: Optional[str],
    top_n: int,
) -> tuple[int, List[Dict[str, Any]]]:
    """Return (reposDiscovered, analyzedRepos[]).

    Pulls repos via GraphQL (paginated), filters forks/empty/archived, caps to
    top_n by a recency+stars pre-sort, then best-effort enriches manifests.
    """
    settings = get_settings()
    token = _resolve_token(access_token)
    concurrency = settings.github_scan_concurrency

    discovered = 0
    raw_nodes: List[Dict[str, Any]] = []
    after: Optional[str] = None

    # Smaller pages keep each GraphQL query cheap enough that GitHub doesn't
    # time it out into a 502. We page more times to compensate.
    page_size = 50
    async with httpx.AsyncClient(timeout=45.0) as client:
        # Page through repositories (cap pages so a huge account can't run away).
        for _ in range(6):  # up to 300 repos
            data = await _graphql(
                client, token, {"login": username, "first": page_size, "after": after}
            )
            user = data.get("user")
            if not user:
                raise ValueError(f"GitHub user '{username}' not found.")
            conn = user["repositories"]
            discovered = int(conn.get("totalCount") or 0)
            raw_nodes.extend(conn.get("nodes") or [])
            page = conn.get("pageInfo") or {}
            if page.get("hasNextPage") and len(raw_nodes) < max(top_n, 100):
                after = page.get("endCursor")
            else:
                break

        repos = [_node_to_repo(n, username) for n in raw_nodes if n]
        # Filter out noise: forks with no stars, archived-only, empty repos.
        repos = [
            r
            for r in repos
            if not r["isArchived"]
            and not (r["isFork"] and r["stars"] == 0)
            and (r["languages"] or r["totalCommits"] > 0 or r["stars"] > 0)
        ]
        # Pre-rank cheaply (recency proxy via pushedAt string + stars) and cap.
        repos.sort(key=lambda r: (r["stars"], r.get("pushedAt") or ""), reverse=True)
        repos = repos[: max(1, top_n)]

        await _enrich_manifests(client, token, repos, concurrency)

    logger.info(
        "GitHub scan fetched: discovered=%d analyzed=%d user=%s",
        discovered, len(repos), username,
    )
    return discovered, repos
