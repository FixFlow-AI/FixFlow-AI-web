from __future__ import annotations

import hashlib
import logging
from typing import List
from ..schemas.opportunity import Opportunity, OpportunityScore, FactorScores
from .skill_gap import normalize_skill
from ..llm.client import generate_structured

logger = logging.getLogger(__name__)

EXTRACTOR_PROMPT = """You are the Opportunity Intelligence Agent for FixFlow AI.
Your job is to read raw project/job description postings and extract structural information to populate the Opportunity schema.

Make sure you:
- Identify required technical skills.
- Identify nice-to-have/preferred skills.
- Extract budget details (min and max values, default to 0 if not stated).
- Determine urgency based on project deadlines/timeline mentions.
- Flag any potential risks or red flags (vague criteria, unrealistically low budget, requests for free work).

Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""


def generate_dedupe_key(title: str, source: str, min_budget: int, max_budget: int) -> str:
    """Generate a stable deduplication hash for an opportunity."""
    norm_title = title.strip().lower().replace(" ", "")
    norm_source = source.strip().lower().replace(" ", "")
    payload = f"{norm_title}|||{norm_source}|||{min_budget}|||{max_budget}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def extract_opportunity(raw_text: str) -> Opportunity:
    """Call Gemini to extract structural opportunity from raw posting text."""
    if not raw_text or not raw_text.strip():
        raise ValueError("Opportunity extraction failed: Input text is empty.")

    try:
        opp = await generate_structured(
            system_instruction=EXTRACTOR_PROMPT,
            contents=f"Raw Job/Lead text:\n{raw_text}",
            response_schema=Opportunity,
            temperature=0.1,
        )
        # Populate dedupe key post extraction
        opp.dedupe_key = generate_dedupe_key(
            opp.title, opp.source, opp.budget.min_budget, opp.budget.max_budget
        )
        return opp
    except Exception as e:
        logger.error("Failed to extract opportunity via LLM, applying fallback: %s", str(e))
        return _fallback_opportunity(raw_text)


def _fallback_opportunity(raw_text: str) -> Opportunity:
    """Safely return a basic Opportunity on extraction failures."""
    title = raw_text.split("\n")[0][:60] if raw_text else "Fallback Opportunity Lead"
    opp = Opportunity(
        title=title,
        summary="Failed to parse job description. Falling back to default container.",
        required_skills=[],
        nice_to_have_skills=[],
        budget={"min_budget": 0, "max_budget": 0},
        currency="USD",
        urgency="Medium",
        remote=True,
        red_flags=["Failed semantic parsing analysis"],
        source="email_fallback",
    )
    opp.dedupe_key = generate_dedupe_key(
        opp.title, opp.source, opp.budget.min_budget, opp.budget.max_budget
    )
    return opp


def score_opportunity(
    opportunity: Opportunity,
    verified_skills: List[str],
    client_rating: int = 80,
) -> OpportunityScore:
    """Deterministically score an opportunity against a freelancer's verified skills."""
    # 1. Skill Fit
    verified_norm = {normalize_skill(s) for s in verified_skills}
    req_norm = [normalize_skill(s) for s in opportunity.required_skills]
    nice_norm = [normalize_skill(s) for s in opportunity.nice_to_have_skills]

    matched = []
    missing = []

    for s in req_norm:
        if s in verified_norm:
            matched.append(s)
        else:
            missing.append(s)

    matched_nice = [s for s in nice_norm if s in verified_norm]

    total_req = len(req_norm)
    if total_req == 0:
        skill_fit = 100
    else:
        req_match_ratio = len(matched) / total_req
        nice_match_ratio = len(matched_nice) / len(nice_norm) if nice_norm else 1.0
        skill_fit = round((0.8 * req_match_ratio + 0.2 * nice_match_ratio) * 100)

    # 2. Budget Adequacy (normalized against standard reference of $5000)
    max_budget = opportunity.budget.max_budget
    if max_budget <= 0:
        budget_score = 50
    else:
        budget_score = min(100, round((max_budget / 5000) * 100))

    # 3. Urgency Score
    urgency_map = {"High": 100, "Medium": 70, "Low": 40}
    urgency_score = urgency_map.get(opportunity.urgency, 70)

    # 4. Client Quality Score
    client_score = max(0, min(100, client_rating))

    # 5. Red Flag Penalty (deduct 15 points per flag)
    penalty = len(opportunity.red_flags) * 15
    penalty = min(100, penalty)

    # Calculate weighted total
    weighted = (
        0.40 * skill_fit
        + 0.25 * budget_score
        + 0.15 * urgency_score
        + 0.20 * client_score
    )
    overall_score = max(0, min(100, round(weighted - penalty)))

    dedupe = opportunity.dedupe_key
    if not dedupe:
        dedupe = generate_dedupe_key(
            opportunity.title,
            opportunity.source,
            opportunity.budget.min_budget,
            opportunity.budget.max_budget,
        )

    opp_id = hashlib.md5(opportunity.title.encode("utf-8")).hexdigest()[:8]

    return OpportunityScore(
        opportunity_id=opp_id,
        overall_score=overall_score,
        factors=FactorScores(
            skill_fit=skill_fit,
            budget_adequacy=budget_score,
            urgency=urgency_score,
            client_quality=client_score,
            red_flag_penalty=penalty,
        ),
        matched_skills=matched + matched_nice,
        missing_skills=missing,
        dedupe_key=dedupe,
    )
