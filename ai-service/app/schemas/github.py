"""Pydantic schemas for the GitHub onboarding scan (roles/01, 01a).

Two groups:
  1. Public result models returned to the TS backend (mirror the DynamoDB
     tables: freelancer_skills, freelancer_projects, profile_confidence,
     github_scan_jobs).
  2. Small LLM-only schemas used for the last-mile semantic step (skill
     name normalization + project summaries). Facts never go through the LLM.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

SkillCategory = Literal["language", "framework", "tool", "domain"]
ConfidenceBand = Literal["emerging", "developing", "match_ready"]
SegmentState = Literal["pending", "running", "done", "fallback", "error"]


# ───────────────────────── Request ─────────────────────────

class GithubScanRequest(BaseModel):
    githubUsername: str = Field(min_length=1)
    # The freelancer's OAuth access token (from GitHub sign-in). GraphQL needs a
    # token; if omitted, the service falls back to the server GITHUB_TOKEN.
    accessToken: Optional[str] = None
    topN: Optional[int] = Field(default=None, ge=1, le=200)


# ───────────────────────── Segment outputs ─────────────────────────

class SkillEvidence(BaseModel):
    repo: str
    signal: str          # e.g. "language", "dependency", "topic"
    detail: str          # e.g. "812kb TypeScript", "depends on: react"


class VerifiedSkill(BaseModel):
    name: str
    category: SkillCategory
    confidence: int = Field(ge=0, le=100)
    evidence: List[SkillEvidence] = Field(default_factory=list)
    source: Literal["github_scan"] = "github_scan"
    editable: Literal[False] = False   # tamper-proof by construction


class FreelancerProject(BaseModel):
    repoName: str
    summary: str
    domain: Optional[str] = None
    stack: List[str] = Field(default_factory=list)
    stars: int = 0
    commitShare: int = 0               # 0-100 (ownership/authorship proxy)
    lastActiveAt: Optional[str] = None
    rankScore: int = 0


class ExperienceSignals(BaseModel):
    totalCommits: int = 0              # commits AUTHORED by the user (measured)
    reposAnalyzed: int = 0
    activeYears: float = 0.0
    avgStars: float = 0.0
    collaborationRepos: int = 0        # others' repos where the user authored commits
    documentationQuality: int = Field(default=0, ge=0, le=100)
    linesAuthored: int = 0             # net lines the user wrote (top repos, best-effort)
    pullRequests: int = 0              # PRs opened in the trailing year
    accountAgeYears: float = 0.0       # GitHub account tenure
    followers: int = 0


class ConfidenceFactorBreakdown(BaseModel):
    skillBreadthDepth: int = 0
    projectStrength: int = 0
    recency: int = 0
    contributionVolume: int = 0
    documentation: int = 0


class ProfileConfidence(BaseModel):
    score: int = Field(ge=0, le=100)
    band: ConfidenceBand
    factorBreakdown: ConfidenceFactorBreakdown


class SegmentStatus(BaseModel):
    skills: SegmentState = "pending"
    projects: SegmentState = "pending"
    experience: SegmentState = "pending"


# ───────────────────────── Full result ─────────────────────────

class GithubScanResult(BaseModel):
    githubUsername: str
    reposDiscovered: int
    reposAnalyzed: int
    languages: dict[str, int] = Field(default_factory=dict)  # name -> percent
    skills: List[VerifiedSkill] = Field(default_factory=list)
    projects: List[FreelancerProject] = Field(default_factory=list)
    experience: ExperienceSignals = Field(default_factory=ExperienceSignals)
    confidence: ProfileConfidence
    segmentStatus: SegmentStatus
    scannedAt: str


# ───────────────────────── LLM-only schemas (last-mile) ─────────────────────────

class NormalizedSkill(BaseModel):
    raw: str
    normalized: str
    category: SkillCategory


class SkillNormalizationOutput(BaseModel):
    """LLM cleans/dedupes long-tail skill tokens the lookup table missed."""
    skills: List[NormalizedSkill]


class ProjectSummary(BaseModel):
    repoName: str
    summary: str = Field(min_length=1)
    domain: str


class ProjectSummariesOutput(BaseModel):
    """One batched call summarizes all top projects at once."""
    projects: List[ProjectSummary]
