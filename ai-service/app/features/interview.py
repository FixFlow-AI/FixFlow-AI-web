"""AI-003 — Interview & Technical Vetting Generation.

Ports ``backend/src/skills/interviewGenerator.ts``: generate 3-5 targeted
technical questions from a brief, a candidate GitHub scan, and detected skill
gaps. Falls back to a skill-gap-driven question set on any failure.
"""
from __future__ import annotations

import json
import logging
from typing import Any, List, Union

from ..llm.client import generate_structured
from ..schemas.interview import InterviewOutput, InterviewQuestion

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Lead Technical Interview Architect Agent for FixFlow AI.
Your job is to generate 3 to 5 highly targeted technical screening questions for a freelancer applying for a project.

You will be provided with:
1. The project description/brief.
2. The candidate's GitHub scan summary (used to see their strengths, repository topics, and languages).
3. A list of missing skills (skills required by the project brief that weren't detected in their GitHub scan).

Generate custom questions to address:
- How they plan to handle the technical aspects requiring their missing skills.
- Specific architectural or tool choices from the project brief.
- Relevant experience from their GitHub profile that maps to the project.

Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""


async def generate_interview_questions(
    brief_text: str,
    github_scan: Union[str, dict, Any],
    missing_skills: List[str],
) -> InterviewOutput:
    github_scan_str = (
        github_scan if isinstance(github_scan, str) else json.dumps(github_scan, indent=2)
    )
    missing_skills_str = ", ".join(missing_skills) if missing_skills else "None"

    contents = (
        f"Project Brief:\n{brief_text}\n\n"
        f"Candidate GitHub Scan:\n{github_scan_str}\n\n"
        f"Missing Skills:\n{missing_skills_str}"
    )

    try:
        return await generate_structured(
            system_instruction=SYSTEM_PROMPT,
            contents=contents,
            response_schema=InterviewOutput,
            temperature=0.2,
        )
    except Exception as error:  # noqa: BLE001
        logger.error("Interview Generator Exception, applying fallback: %s", error)
        return _fallback(missing_skills)


def _fallback(missing_skills: List[str]) -> InterviewOutput:
    questions: List[InterviewQuestion] = []

    for skill in (missing_skills or [])[:3]:
        questions.append(
            InterviewQuestion(
                question=(
                    f"The project requirements mention {skill}, which wasn't prominent in your "
                    f"recent public repositories. Can you describe your familiarity with {skill} "
                    "and how you would ramp up for this project?"
                ),
                rationale=f"Addresses detected skills gap for critical requirement: {skill}",
                expectedKeywords=[skill, "experience", "learning curve", "architecture"],
                idealAnswerSummary=(
                    "Candidate discusses their conceptual understanding, any private project "
                    "experience, and a plan to quickly master the skill."
                ),
            )
        )

    if len(questions) < 3:
        questions.append(
            InterviewQuestion(
                question=(
                    "Based on the project brief, how would you structure the milestones and "
                    "testing strategy to ensure stable deliveries?"
                ),
                rationale="Evaluates project planning, architectural strategy, and milestones setup.",
                expectedKeywords=["milestone", "deliverables", "testing", "CI/CD", "verification"],
                idealAnswerSummary=(
                    "Candidate provides a structured phased approach containing unit tests and "
                    "delivery feedback loops."
                ),
            )
        )

    if len(questions) < 3:
        questions.append(
            InterviewQuestion(
                question=(
                    "How do your previous projects on GitHub prepare you for the technical stack "
                    "requested in this brief?"
                ),
                rationale="Maps candidate's self-reported experience/GitHub footprint to the project.",
                expectedKeywords=["repositories", "development", "stack", "frameworks"],
                idealAnswerSummary=(
                    "Candidate connects specific public repos or commits to tasks required in the brief."
                ),
            )
        )

    return InterviewOutput(questions=questions[:5])
