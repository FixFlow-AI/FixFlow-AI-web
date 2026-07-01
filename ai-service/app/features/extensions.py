"""AI-004 — Contextual Contract Extensions.

Ports ``backend/src/skills/contextExtensions.ts``: analyze completed deliverables
and a chat summary to suggest follow-up milestones and draft a client offer.
Falls back to a maintenance/optimization suggestion on any failure.
"""
from __future__ import annotations

import json
import logging
from typing import Any, List, Union

from ..llm.gemini import generate_structured
from ..schemas.extensions import ContractExtensionsOutput, ExtensionMilestone

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Lead Project Strategy Agent for FixFlow AI.
Your job is to analyze completed project milestones/deliverables and recent chat discussion summaries to recommend logical follow-up phases.

These follow-ups could represent:
- Post-launch support, bug fixing, or monitoring.
- Optimization of speed, database queries, or SEO.
- Advanced features/enhancements discussed in the chat but not included in the original scope.
- Training or onboarding documentation.

Generate:
1. Clear strategic reasoning explaining why these extension milestones are recommended.
2. A list of 1 to 3 new suggested milestones (title, description, estimated duration, complexity, and estimated budget percentage relative to original).
3. A pre-written, polite, and persuasive message draft that the freelancer can send to the client.

Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose."""


async def generate_contract_extensions(
    completed_deliverables: Union[str, list, Any],
    chat_summary: str,
) -> ContractExtensionsOutput:
    deliverables_str = (
        completed_deliverables
        if isinstance(completed_deliverables, str)
        else json.dumps(completed_deliverables, indent=2)
    )

    contents = (
        f"Completed Deliverables:\n{deliverables_str}\n\n"
        f"Chat Discussion Summary:\n{chat_summary}"
    )

    try:
        return await generate_structured(
            system_instruction=SYSTEM_PROMPT,
            contents=contents,
            response_schema=ContractExtensionsOutput,
            temperature=0.2,
        )
    except Exception as error:  # noqa: BLE001
        logger.error("Context Extensions Exception, applying fallback: %s", error)
        return _fallback()


def _fallback() -> ContractExtensionsOutput:
    return ContractExtensionsOutput(
        extensionReasoning=(
            "Initial milestones successfully verified. Suggested maintenance and optimization "
            "follow-up due to default safety fallback trigger."
        ),
        suggestedMilestones=[
            ExtensionMilestone(
                title="Post-Delivery Support & Maintenance",
                description=(
                    "A 2-week support period to monitor systems, fix production issues, and make "
                    "minor design tweaks."
                ),
                estimatedDuration="14 days",
                complexity="Low",
                estimatedBudgetPct=15,
            ),
            ExtensionMilestone(
                title="Performance Optimization & Monitoring Setup",
                description=(
                    "Integrate performance logging, core web vitals optimization, and crash "
                    "analytics dashboard."
                ),
                estimatedDuration="7 days",
                complexity="Medium",
                estimatedBudgetPct=10,
            ),
        ],
        extensionOfferDraft=(
            "Hi! Now that we've successfully completed the first phase of deliverables, I recommend "
            "setting up a short support and optimization milestone to monitor performance and "
            "resolve any initial feedback. Let me know if you would like me to add these milestones "
            "to our active escrow contract!"
        ),
    )
