"""AI-002 / AIE-09 — Hybrid Confidence Grid + Self-Correction.

The four grid factors are **measured deterministically** from the brief and the
proposal (see ``scoring.py``). The Auditor and Feasibility LLM agents run in
parallel and contribute only qualitative ``issues``/``findings`` and a *bounded*
modifier per factor — they never emit the headline number. The confidence index
is a documented weighted blend of the available factors (budget is excluded when
the brief states no budget).

If an LLM agent fails, its modifiers default to zero, so the factor falls back
to its **deterministic-only** base (honest partial score, not a flat constant).
The self-correction loop and its regression guard (AIE-03) are unchanged.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List

from ..config import get_settings
from ..llm.client import generate_structured
from ..schemas.confidence import (
    AuditorEvaluation,
    AuditorFeedback,
    ConfidenceGridResult,
    CycleRecord,
    FactorScore,
    FeasibilityEvaluation,
    FeasibilityFeedback,
)
from ..schemas.proposal import Proposal
from .scoring import (
    FactorResult,
    blend_factor,
    compute_deterministic_factors,
    weighted_confidence_index,
)

logger = logging.getLogger(__name__)

AUDITOR_PROMPT = """You are the Lead Auditor Agent for FixFlow AI.
You review a client brief and a generated technical proposal for two concerns:
1. Budget Alignment: do the features/costs conform to any stated or implicit budget constraints?
2. Deliverable Coverage: are all requested deliverables, features, and milestones accounted for?

The numeric factor scores are computed deterministically by the system — you do NOT set them.
Your job is to add qualitative judgment on top of that measured baseline:
- List specific `issues` (empty list if none).
- Write concise `findings`.
- Provide a small integer modifier in the range -15..+15 for each factor, nudging the
  deterministic base up (clear strength the math missed) or down (subtle problem the math missed).
  Use 0 when you have no evidence to adjust the baseline.

Output strictly in JSON conforming to the requested schema. Do not output markdown or extra prose."""

FEASIBILITY_PROMPT = """You are the Lead Technical Feasibility Agent for FixFlow AI.
You review a client brief and a generated technical proposal for two concerns:
1. Technical Feasibility: is the recommended stack/approach realistic and achievable?
2. Timeline Realism: are durations, tasks, dependencies, and the weekly plan logical?

The numeric factor scores are computed deterministically by the system — you do NOT set them.
Your job is to add qualitative judgment on top of that measured baseline:
- List specific `issues` (empty list if none).
- Write concise `findings`.
- Provide a small integer modifier in the range -15..+15 for each factor, nudging the
  deterministic base up (clear strength the math missed) or down (subtle problem the math missed).
  Use 0 when you have no evidence to adjust the baseline.

Output strictly in JSON conforming to the requested schema. Do not output markdown or extra prose."""

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


async def run_auditor_agent(brief_text: str, proposal: Proposal) -> AuditorFeedback:
    contents = f"Brief:\n{brief_text}\n\nProposal JSON:\n{proposal.model_dump_json(indent=2)}"
    try:
        return await generate_structured(
            system_instruction=AUDITOR_PROMPT,
            contents=contents,
            response_schema=AuditorFeedback,
            temperature=0.1,
        )
    except Exception as error:  # noqa: BLE001
        logger.error("Auditor Agent Evaluation Exception: %s", error)
        # Honest fallback: no modifier, so the factors keep their deterministic base.
        return AuditorFeedback(
            budget_alignment_modifier=0,
            deliverable_coverage_modifier=0,
            issues=["Auditor agent failed to complete review; deterministic-only score applied."],
            findings=f"An error occurred during auditor evaluation: {error}",
        )


async def run_feasibility_agent(brief_text: str, proposal: Proposal) -> FeasibilityFeedback:
    contents = f"Brief:\n{brief_text}\n\nProposal JSON:\n{proposal.model_dump_json(indent=2)}"
    try:
        return await generate_structured(
            system_instruction=FEASIBILITY_PROMPT,
            contents=contents,
            response_schema=FeasibilityFeedback,
            temperature=0.1,
        )
    except Exception as error:  # noqa: BLE001
        logger.error("Feasibility Agent Evaluation Exception: %s", error)
        # Honest fallback: no modifier, so the factors keep their deterministic base.
        return FeasibilityFeedback(
            technical_feasibility_modifier=0,
            timeline_realism_modifier=0,
            issues=["Feasibility agent failed to complete review; deterministic-only score applied."],
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


def _to_factor_score(result: FactorResult, modifier: int, limit: int) -> FactorScore:
    """Blend a deterministic base with a bounded LLM modifier into a FactorScore."""
    bounded = max(-limit, min(limit, modifier))
    return FactorScore(
        name=result.name,
        score=blend_factor(result.base, modifier, limit),
        deterministic_base=result.base,
        llm_modifier=bounded,
        evidence=result.evidence,
    )


async def evaluate_proposal(
    brief_text: str,
    proposal: Proposal,
) -> tuple[AuditorEvaluation, FeasibilityEvaluation, int]:
    settings = get_settings()
    limit = settings.confidence_llm_modifier_limit

    # 1. Deterministic bases (pure, reproducible) — the anchor for every factor.
    factors = compute_deterministic_factors(brief_text, proposal)

    # 2. LLM agents run in parallel, contributing bounded modifiers + qualitative notes.
    auditor_fb, feasibility_fb = await asyncio.gather(
        run_auditor_agent(brief_text, proposal),
        run_feasibility_agent(brief_text, proposal),
    )

    # 3. Blend base + modifier per factor (budget stays None when unstated).
    deliverable = _to_factor_score(
        factors["deliverable_coverage"], auditor_fb.deliverable_coverage_modifier, limit
    )
    budget_result = factors["budget_alignment"]
    budget = (
        _to_factor_score(budget_result, auditor_fb.budget_alignment_modifier, limit)
        if budget_result is not None
        else None
    )
    technical = _to_factor_score(
        factors["technical_feasibility"], feasibility_fb.technical_feasibility_modifier, limit
    )
    timeline = _to_factor_score(
        factors["timeline_realism"], feasibility_fb.timeline_realism_modifier, limit
    )

    auditor_eval = AuditorEvaluation(
        budget_alignment=budget,
        deliverable_coverage=deliverable,
        issues=auditor_fb.issues,
        findings=auditor_fb.findings,
    )
    feasibility_eval = FeasibilityEvaluation(
        technical_feasibility=technical,
        timeline_realism=timeline,
        issues=feasibility_fb.issues,
        findings=feasibility_fb.findings,
    )

    # 4. Weighted blend over available factors (budget excluded when None).
    confidence_index = weighted_confidence_index(
        {
            "deliverable_coverage": deliverable.score,
            "timeline_realism": timeline.score,
            "technical_feasibility": technical.score,
            "budget_alignment": budget.score if budget is not None else None,
        },
        settings.CONFIDENCE_WEIGHTS,
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

    # 1. Run initial evaluation
    auditor_eval, feasibility_eval, confidence_index = await evaluate_proposal(
        brief_text,
        current,
    )
    best_confidence_index = confidence_index
    best_proposal = current
    best_cycle = 0

    while True:
        logger.info(
            "Confidence Grid Cycle %d completed. Consensual Confidence Index: %d",
            cycle,
            confidence_index,
        )

        combined_issues = [*auditor_eval.issues, *feasibility_eval.issues]
        if not combined_issues:
            combined_issues.append(
                "Scores indicate overall misalignment across deliverables and timelines."
            )

        # Check loop termination at threshold or max cycles
        if confidence_index >= threshold or cycle >= max_cycles:
            cycle_records.append(
                CycleRecord(
                    cycle=cycle,
                    auditor=auditor_eval,
                    feasibility=feasibility_eval,
                    confidenceIndex=confidence_index,
                    issuesFed=combined_issues,
                    optimizationApplied=False,
                    improvedOverPrevious=False,
                )
            )
            break

        # Optimize proposal
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
                    improvedOverPrevious=False,
                )
            )
            break

        # Evaluate the optimization outcome exactly once
        new_auditor, new_feasibility, new_confidence = await evaluate_proposal(
            brief_text,
            optimized_proposal,
        )

        # Determine improvement against current baseline (regression guard)
        improved = new_confidence >= confidence_index + min_improvement

        cycle_records.append(
            CycleRecord(
                cycle=cycle,
                auditor=auditor_eval,
                feasibility=feasibility_eval,
                confidenceIndex=confidence_index,
                issuesFed=combined_issues,
                optimizationApplied=improved,
                improvedOverPrevious=improved,
            )
        )

        if not improved:
            break

        # Commit proposal and evaluation to current loop state
        current = optimized_proposal
        auditor_eval, feasibility_eval, confidence_index = new_auditor, new_feasibility, new_confidence

        # Track the best proposal seen so far
        if confidence_index > best_confidence_index:
            best_confidence_index = confidence_index
            best_proposal = current
            best_cycle = cycle + 1

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
