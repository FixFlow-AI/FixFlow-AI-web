from __future__ import annotations

import logging
from typing import List, Tuple
from ..schemas.github import ProfileConfidence, VerifiedSkill, ExperienceSignals, ConfidenceBand
from ..schemas.growth import GrowthPlan, ActionItem, SuggestedProject
from ..llm.client import generate_structured
from ..config import get_settings

logger = logging.getLogger(__name__)

GROWTH_PLAN_PROMPT = """You are the Lead Career Growth and AI Vetting Coach for FixFlow AI.
Your job is to read a freelancer's public profile confidence metrics and generate a personalized, actionable growth plan.

You will be provided with:
1. The freelancer's current confidence score and band.
2. The score breakdown per factor (sorted weakest first).
3. Their currently verified skills.
4. Suggested target skills to learn.

Generate:
- Actionable steps for their weakest factors, providing concrete instructions (e.g. "Add a detailed README", "Commit weekly").
- Map each action to its corresponding factor, estimated impact, and effort.
- 1 or 2 specific mock projects they could build to practice new skills.

Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""


def _deterministic_plan(
    score: int,
    current_band: ConfidenceBand,
    target_band: ConfidenceBand,
    weakest_factors: List[Tuple[str, int]],
    target_skills: List[str],
) -> GrowthPlan:
    """Deterministically compile a GrowthPlan using templates on weakest factors."""
    factor_recommendations = {
        "skillBreadthDepth": {
            "action": "Learn new languages or frameworks like TypeScript/Node.js to increase repository breadth and technical capability.",
            "impact": "High",
            "effort": "Medium",
        },
        "projectStrength": {
            "action": "Build higher-complexity projects with databases, auth, and automated testing rather than simple static templates.",
            "impact": "High",
            "effort": "High",
        },
        "recency": {
            "action": "Make weekly commits to active repositories to maintain a recent activity footprint in public profile graphs.",
            "impact": "Medium",
            "effort": "Low",
        },
        "contributionVolume": {
            "action": "Increase overall lines authored and commit frequencies by contributing to open-source or expanding side projects.",
            "impact": "Medium",
            "effort": "Medium",
        },
        "documentation": {
            "action": "Write comprehensive README.md files for your top repos, detailing installation guides, architecture, and API routes.",
            "impact": "High",
            "effort": "Low",
        },
    }

    prioritized_actions = []
    for factor, _ in weakest_factors:
        rec = factor_recommendations.get(factor)
        if rec:
            prioritized_actions.append(
                ActionItem(
                    factor=factor,
                    action=rec["action"],
                    impact=rec["impact"],
                    effort=rec["effort"],
                )
            )

    suggested_projects = []
    if any(k == "projectStrength" for k, _ in weakest_factors[:2]):
        suggested_projects.append(
            SuggestedProject(
                title="Full-Stack Escrow Payment System",
                description="Build a multi-milestone escrow delivery system with WebSockets, postgres, and unit tests.",
                skills_to_practice=["typescript", "postgresql", "websockets"],
            )
        )
    else:
        suggested_projects.append(
            SuggestedProject(
                title="API Service Containerization",
                description="Package your existing Node.js or Python APIs inside Docker containers and run them locally.",
                skills_to_practice=["docker", "aws"],
            )
        )

    return GrowthPlan(
        currentBand=current_band,
        targetBand=target_band,
        overallScore=score,
        prioritizedActions=prioritized_actions,
        targetSkills=target_skills,
        suggestedProjects=suggested_projects,
    )


async def generate_growth_plan(
    confidence: ProfileConfidence,
    verified_skills: List[VerifiedSkill],
    experience: ExperienceSignals | None = None,
) -> GrowthPlan:
    """Generate a personalized career growth plan, supporting both AI-enabled and fallback paths."""
    settings = get_settings()

    # 1. Deterministic gap analysis & ranking
    factors = confidence.factorBreakdown.model_dump()
    weakest_factors = sorted(factors.items(), key=lambda x: x[1])

    current_band = confidence.band
    if current_band == "emerging":
        target_band = "developing"
    elif current_band == "developing":
        target_band = "match_ready"
    else:
        target_band = "match_ready"

    # Identify target skills based on what's missing
    existing_skills_norm = {s.name.lower() for s in verified_skills}
    demand_skills = ["typescript", "nodejs", "postgresql", "docker", "aws", "graphql", "websockets"]
    target_skills = [s for s in demand_skills if s not in existing_skills_norm][:3]
    if not target_skills:
        target_skills = ["docker", "kubernetes", "aws"]

    # 2. Return deterministic plan directly if AI is disabled (AIE-07 fallback/AI off requirement)
    if not settings.ai_enabled:
        logger.info("AI disabled, generating deterministic growth plan.")
        return _deterministic_plan(
            confidence.score, current_band, target_band, weakest_factors, target_skills
        )

    # 3. Call Gemini for last-mile phrasing
    contents = (
        f"Freelancer Profile Confidence Score: {confidence.score}/100 ({current_band})\n"
        f"Target Confidence Band: {target_band}\n"
        f"Score Breakdown per Factor (0-100, weakest first):\n"
        f"{', '.join([f'{k}: {v}' for k, v in weakest_factors])}\n\n"
        f"Verified Skills: {', '.join([s.name for s in verified_skills])}\n"
        f"Recommended Target Skills to learn: {', '.join(target_skills)}"
    )

    try:
        plan = await generate_structured(
            system_instruction=GROWTH_PLAN_PROMPT,
            contents=contents,
            response_schema=GrowthPlan,
            temperature=0.2,
        )
        # Ensure confidence numbers cannot be altered by LLM
        plan.currentBand = current_band
        plan.targetBand = target_band
        plan.overallScore = confidence.score
        return plan
    except Exception as e:
        logger.error(
            "Failed to generate growth plan via LLM, falling back to deterministic plan: %s", str(e)
        )
        return _deterministic_plan(
            confidence.score, current_band, target_band, weakest_factors, target_skills
        )
