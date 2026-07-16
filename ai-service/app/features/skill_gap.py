from __future__ import annotations

import hashlib
import logging
import re
from typing import List, Set
from pydantic import BaseModel

from ..schemas.github import VerifiedSkill
from ..schemas.proposal import Proposal

logger = logging.getLogger(__name__)

# Canonical alias map for technology naming normalization (AIA-03)
ALIAS_MAP = {
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "golang": "go",
    "postgres": "postgresql",
    "dynamo": "dynamodb",
    "next.js": "nextjs",
    "next": "nextjs",
    "react.js": "react",
    "reactjs": "react",
    "tailwind css": "tailwindcss",
    "tailwind": "tailwindcss",
    "node.js": "nodejs",
    "node": "nodejs",
    "express.js": "express",
    "vue.js": "vue",
    "vuejs": "vue",
    "docker container": "docker",
    "k8s": "kubernetes",
    "django framework": "django",
    "flask framework": "flask",
    "nest.js": "nestjs",
    "nestjs framework": "nestjs",
    "web3.js": "web3",
    "ethers.js": "web3",
    "solidity contract": "solidity",
    "smart contract": "solidity",
    "smart_contract": "solidity",
    "websocket": "websockets",
    "ws": "websockets",
    "totp": "mfa",
    "otp": "mfa",
    "two factor": "mfa",
    "multi factor": "mfa",
    "mfa": "mfa",
}

# The set of known technologies we target for matching
KNOWN_TECHS = {
    "javascript",
    "typescript",
    "python",
    "go",
    "rust",
    "solidity",
    "java",
    "c++",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "dynamodb",
    "aws",
    "docker",
    "kubernetes",
    "react",
    "nextjs",
    "vue",
    "angular",
    "nodejs",
    "express",
    "nestjs",
    "django",
    "flask",
    "tailwind",
    "graphql",
    "websockets",
    "solana",
    "ethereum",
    "web3",
    "escrow",
    "razorpay",
    "stripe",
    "git",
    "mfa",
    "totp",
    "fsm",
    "opt",
    "otp",
}


class SkillGapReport(BaseModel):
    required_skills: List[str]
    covered_skills: List[str]
    missing_skills: List[str]
    coverage_pct: int


def normalize_skill(name: str) -> str:
    """Normalize skill names to a canonical form using the alias map."""
    cleaned = name.strip().lower()
    cleaned = cleaned.replace("-", "").replace("_", "").replace(" ", "")
    return ALIAS_MAP.get(cleaned, cleaned)


def extract_required_skills(brief_text: str, proposal: Proposal | None = None) -> Set[str]:
    """Collect required technology tokens from brief text and optionally the Proposal."""
    text_to_scan = brief_text.lower()
    
    if proposal:
        text_to_scan += f" {proposal.project_summary.lower()}"
        for feature in proposal.features:
            text_to_scan += (
                f" {feature.title.lower()} {feature.description.lower()} "
                f"{feature.technical_approach.lower()} {feature.area.lower()}"
            )
        for risk in proposal.risks:
            text_to_scan += f" {risk.label.lower()} {risk.mitigation.lower()} {risk.category.lower()}"

    required = set()
    # Simple regex token extraction
    tokens = re.findall(r"[a-zA-Z0-9\.\-\+_]+", text_to_scan)
    for t in tokens:
        norm = normalize_skill(t)
        if norm in KNOWN_TECHS:
            required.add(norm)

    # Substring search for multi-word or compound phrases
    for tech in KNOWN_TECHS:
        if tech in text_to_scan:
            required.add(tech)

    # Manual mapping adjustments for known phrases
    if "smart contract" in text_to_scan:
        required.add("solidity")
    if "next.js" in text_to_scan:
        required.add("nextjs")
    if "node.js" in text_to_scan:
        required.add("nodejs")
    if "two-factor" in text_to_scan or "multi-factor" in text_to_scan or "two factor" in text_to_scan:
        required.add("mfa")
    if "websocket" in text_to_scan or "ws" in text_to_scan:
        required.add("websockets")

    return required


def derive_missing_skills(
    required_skills: Set[str],
    verified_skills: List[VerifiedSkill],
    confidence_threshold: int = 70,
) -> SkillGapReport:
    """Compare required skills against candidate's verified skills deterministically."""
    verified_normalized = set()
    for skill in verified_skills:
        if skill.confidence >= confidence_threshold:
            verified_normalized.add(normalize_skill(skill.name))

    covered = required_skills.intersection(verified_normalized)
    missing = required_skills.difference(verified_normalized)

    if not required_skills:
        coverage_pct = 100
    else:
        coverage_pct = round((len(covered) / len(required_skills)) * 100)

    return SkillGapReport(
        required_skills=sorted(list(required_skills)),
        covered_skills=sorted(list(covered)),
        missing_skills=sorted(list(missing)),
        coverage_pct=coverage_pct,
    )
