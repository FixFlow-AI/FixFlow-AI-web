"""AI-002 — Multi-Agent Confidence Grid + Self-Correction.

Ports ``backend/src/skills/confidenceGrid.ts``:
- Auditor + Feasibility agents run in parallel (asyncio.gather).
- Confidence index = mean of the 4 scores.
- If below threshold, a single optimization cycle revises the proposal.
Each agent has a safe fallback so the pipeline never blocks.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List

from ..config import get_settings
from ..llm.gemini import generate_structured
from ..schemas.confidence import (
    AuditorEvaluation,
    ConfidenceGridResult,
    FeasibilityEvaluation,
    CycleRecord,
)
from ..schemas.proposal import Proposal

logger = logging.getLogger(__name__)

AUDITOR_PROMPT = """You are the Lead Auditor Agent for FixFlow AI.
Your task is to analyze a client brief and a generated technical proposal to evaluate:
1. Budget Alignment: Check if the features/costs conform to any explicitly stated or implicit budget constraints in the brief.
2. Deliverable Coverage: Check if all requested deliverables, functional features, and milestones in the brief are fully accounted for.

Provide a numeric score (0-100) for each, along with a list of specific issues and detailed findings.
Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""

FEASIBILITY_PROMPT = """You are the Lead Technical Feasibility Agent for FixFlow AI.
Your task is to analyze a client brief and a generated technical proposal to evaluate:
1. Technical Feasibility: Check if the recommended stack and technical approaches are realistic, appropriate, and achievable.
2. Timeline Realism: Verify that durations, tasks, dependencies, and weekly delivery plans are realistic and logical.

Provide a numeric score (0-100) for each, along with a list of specific issues and detailed findings.
Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""

OPTIMIZER_PROMPT = """You are the Lead Optimization Agent for FixFlow AI.
Your job is to revise a technical project proposal based on feedback from audit and feasibility agents.
You will be provided with:
1. The original brief text.
2. The current proposal JSON draft.
3. A list of critical issues that must be fixed.

Ensure you correct the proposal details:
- Align deliverables with the budget.
- Refine technical approaches for better feasibility.
- Re-align timeline durations and week schedules.
- Correct overlapping or missing week task mappings.

Output strictly in JSON conforming to the original Proposal Schema. Do not output markdown decorators or extra prose."""


async def run_auditor_agent(brief_text: str, proposal: Proposal) -> AuditorEvaluation:
    contents = f"Brief:\n{brief_text}\n\nProposal JSON:\n{proposal.model_dump_json(indent=2)}"
    try:
        return await generate_structured(
            system_instruction=AUDITOR_PROMPT,
            contents=contents,
            response_schema=AuditorEvaluation,
            temperature=0.1,
        )
    except Exception as error:  # noqa: BLE001
        logger.error("Auditor Agent Evaluation Exception: %s", error)
        return AuditorEvaluation(
            budget_alignment_score=70,
            deliverable_coverage_score=70,
            issues=["Auditor agent failed to complete review, fallback applied."],
            findings=f"An error occurred during auditor evaluation: {error}",
        )


async def run_feasibility_agent(brief_text: str, proposal: Proposal) -> FeasibilityEvaluation:
    contents = f"Brief:\n{brief_text}\n\nProposal JSON:\n{proposal.model_dump_json(indent=2)}"
    try:
        return await generate_structured(
            system_instruction=FEASIBILITY_PROMPT,
            contents=contents,
            response_schema=FeasibilityEvaluation,
            temperature=0.1,
        )
    except Exception as error:  # noqa: BLE001
        logger.error("Feasibility Agent Evaluation Exception: %s", error)
        return FeasibilityEvaluation(
            technical_feasibility_score=70,
            timeline_realism_score=70,
            issues=["Feasibility agent failed to complete review, fallback applied."],
            findings=f"An error occurred during feasibility evaluation: {error}",
        )


async def optimize_proposal(
    brief_text: str, proposal: Proposal, issues: List[str]
) -> tuple[Proposal, bool]:
    logger.info(
        "Initiating self-correction optimization. Correcting %d flagged issues.", len(issues)
    )
    contents = (
        f"Original Brief:\n{brief_text}\n\n"
        f"Proposal Draft JSON:\n{proposal.model_dump_json(indent=2)}\n\n"
        f"Issues to Resolve:\n{issues}"
    )
    try:
        return await generate_structured(
            system_instruction=OPTIMIZER_PROMPT,
            contents=contents,
            response_schema=Proposal,
            temperature=0.2,
        ), True
    except Exception as error:  # noqa: BLE001
        logger.error("Failed to autonomously optimize proposal: %s", error)
        return proposal, False


async def evaluate_proposal(
    brief_text: str,
    proposal: Proposal,
) -> tuple[AuditorEvaluation, FeasibilityEvaluation, int]:
    auditor_eval, feasibility_eval = await asyncio.gather(
        run_auditor_agent(brief_text, proposal),
        run_feasibility_agent(brief_text, proposal),
    )

    confidence_index = round(
        (
            auditor_eval.budget_alignment_score
            + auditor_eval.deliverable_coverage_score
            + feasibility_eval.technical_feasibility_score
            + feasibility_eval.timeline_realism_score
        )
        / 4
    )

    return auditor_eval, feasibility_eval, confidence_index


async def process_confidence_grid(brief_text: str, proposal: Proposal) -> ConfidenceGridResult:
    if not brief_text or not brief_text.strip():
        raise ValueError("Confidence Grid processing failed: Brief text is empty.")

    settings = get_settings()
    threshold = settings.confidence_threshold
    max_cycles = settings.max_correction_cycles
    min_improvement = settings.confidence_min_improvement

    current = proposal
    cycle_records: list[CycleRecord] = []
    best_cycle = 0
    best_proposal = proposal
    best_confidence_index = -1
    cycle = 0

    auditor_eval, feasibility_eval, confidence_index = await evaluate_proposal(
        brief_text,
        current,
        )
    while True:
        prev_score = cycle_records[-1].confidenceIndex if cycle_records else None
        logger.info(
            "Confidence Grid Cycle %d completed. Consensual Confidence Index: %d",
            cycle,
            confidence_index,
        )

        if confidence_index > best_confidence_index:
            best_confidence_index = confidence_index
            best_proposal = current
            best_cycle = cycle

        combined_issues = [*auditor_eval.issues, *feasibility_eval.issues]
        if not combined_issues:
            combined_issues.append(
                "Scores indicate overall misalignment across deliverables and timelines."
            )
        
        improved_over_previous = None if prev_score is None else (confidence_index > prev_score)
        if confidence_index >= threshold or cycle >= max_cycles:
            cycle_records.append(
                CycleRecord(
                    cycle=cycle,
                    auditor=auditor_eval,
                    feasibility=feasibility_eval,
                    confidenceIndex=confidence_index,
                    issuesFed=combined_issues,
                    optimizationApplied=False,
                    improvedOverPrevious=improved_over_previous,
                )
            )
            break


        optimized_proposal, optimizer_succeeded = await optimize_proposal(
            brief_text,
            current,
            combined_issues,
        )

        if not optimizer_succeeded:
            cycle_records.append(
                CycleRecord(
                    cycle=cycle,
                    auditor=auditor_eval,
                    feasibility=feasibility_eval,
                    confidenceIndex=confidence_index,
                    issuesFed=combined_issues,
                    optimizationApplied=False,
                    improvedOverPrevious=improved_over_previous,
                    )
            )
            break

        new_auditor, new_feasibility, new_confidence = await evaluate_proposal(
            brief_text,
            optimized_proposal,
        )

        improved = new_confidence >= best_confidence_index + min_improvement
        cycle_records.append(
            CycleRecord(
                cycle=cycle,
                auditor=auditor_eval,
                feasibility=feasibility_eval,
                confidenceIndex=confidence_index,
                issuesFed=combined_issues,
                optimizationApplied=improved,
                improvedOverPrevious=improved_over_previous,
            )
        )

        if not improved:
            break

        current = optimized_proposal
        auditor_eval, feasibility_eval, confidence_index = new_auditor, new_feasibility, new_confidence
        cycle += 1
    return ConfidenceGridResult(
        auditor=cycle_records[best_cycle].auditor,
        feasibility=cycle_records[best_cycle].feasibility,
        confidenceIndex=best_confidence_index,
        optimized=any(r.optimizationApplied for r in cycle_records),
        finalProposal=best_proposal,
        cycles=cycle_records,
        bestCycle=best_cycle,
    )
