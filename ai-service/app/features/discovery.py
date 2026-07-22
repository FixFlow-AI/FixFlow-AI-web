"""Requirement Discovery Agent (Talent section only).

Transforms an incomplete client request into a complete project brief by asking
the highest-value follow-up question at a time (multiple-choice where possible),
adapting to prior answers, and stopping once confidence is high enough. It never
generates proposals, pricing, or timelines — only discovery.

Stateless: the caller passes the initial request plus the full answer history on
every turn; the agent returns either the next question or the finished brief.
"""
from __future__ import annotations

import logging
from typing import List

from ..llm.gemini import generate_structured
from ..schemas.discovery import (
    DiscoveryAnswer,
    DiscoveryOption,
    DiscoveryQuestion,
    DiscoveryTurn,
    ProjectBrief,
)

logger = logging.getLogger(__name__)

# Confidence at/above which discovery is considered complete.
COMPLETE_THRESHOLD = 90

SYSTEM_PROMPT = """You are FixFlow AI's Requirement Discovery Agent.
Your ONLY objective is to transform an incomplete client request into a complete project brief that is detailed enough for proposal generation.
Do NOT generate proposals, pricing, timelines, contracts, or technical solutions. You are an experienced business analyst running project discovery.

QUESTIONING STRATEGY
Identify missing information across these categories only:
Project Goal, Target Users, Platform, Scope, Features, Design Expectations, Technical Preferences, Existing Assets, Timeline, Budget, Success Criteria, Integrations, Authentication, Admin Panel, AI Requirements, Deployment, Maintenance.
Only ask about categories still unknown. Never ask about information already provided or already answered.

RULES
- Ask exactly ONE question per turn.
- Prefer multiple-choice: provide 3-6 concise options with keys A, B, C, ... Always allow a custom answer (set allow_custom true).
- Ask the highest-impact unknown first. Priority: Goal > Platform > Users > Core Features > Timeline > Budget > nice-to-haves.
- Questions MUST adapt to previous answers. Never repeat a question. Never ask irrelevant or low-value questions.
- If an answer is "I don't know", make the most common industry-standard assumption and move on (record it in the brief, do not re-ask).
- Never overwhelm the user.

OUTPUT PROTOCOL (strict JSON matching the schema)
- While information is still missing: status = "questioning", set next_question (with category, question, options, allow_custom), set confidence (0-100) reflecting how complete the brief is, and list missing_information.
- Once ALL critical requirements are known (confidence >= 90): status = "complete", set the full brief object, and leave next_question null.
- Never set status "complete" with confidence < 90. Never set "questioning" without a next_question.
Output strictly the JSON for the schema. No markdown, no extra prose."""


def _sanitize_text(text: str, max_len: int = 500) -> str:
    if not text:
        return ""
    # Strip backticks, system instruction injection tokens, and control chars
    clean = text.replace("```", "").replace("System:", "").replace("SYSTEM:", "")
    # Remove control characters except standard whitespace
    clean = "".join(ch for ch in clean if ch.isprintable() or ch in "\n\r\t")
    return clean.strip()[:max_len]


def _build_contents(initial_request: str, answers: List[DiscoveryAnswer]) -> str:
    safe_req = _sanitize_text(initial_request, max_len=1000)
    lines = [f"INITIAL CLIENT REQUEST:\n{safe_req}\n"]
    if answers:
        lines.append("ANSWERS COLLECTED SO FAR (most recent last):")
        for i, a in enumerate(answers, start=1):
            q_clean = _sanitize_text(a.question, max_len=300)
            ans_clean = _sanitize_text(a.answer, max_len=300)
            lines.append(f"{i}. Q: {q_clean}\n   A: {ans_clean}")
    else:
        lines.append("No follow-up answers collected yet. Ask the highest-impact question first.")
    lines.append(
        "\nDecide the single next question, OR finish with the structured brief if confidence >= 90."
    )
    return "\n".join(lines)



async def run_discovery_turn(
    initial_request: str,
    answers: List[DiscoveryAnswer],
) -> DiscoveryTurn:
    contents = _build_contents(initial_request, answers)
    try:
        turn = await generate_structured(
            system_instruction=SYSTEM_PROMPT,
            contents=contents,
            response_schema=DiscoveryTurn,
            temperature=0.3,
        )
        return _normalize(turn)
    except Exception as error:  # noqa: BLE001
        logger.error("Discovery agent exception, applying deterministic fallback: %s", error)
        return _fallback(initial_request, answers)


def _normalize(turn: DiscoveryTurn) -> DiscoveryTurn:
    """Enforce the output protocol invariants regardless of model drift."""
    if turn.status == "complete":
        # A complete turn must carry a brief and clear the pending question.
        if turn.brief is None:
            turn.status = "questioning"
        else:
            turn.next_question = None
            turn.confidence = max(turn.confidence, COMPLETE_THRESHOLD)
            return turn

    # questioning: guarantee a question exists.
    if turn.next_question is None:
        turn.next_question = _generic_next_question([])
    turn.confidence = min(turn.confidence, COMPLETE_THRESHOLD - 1)
    return turn


# --------------------------------------------------------------------------
# Deterministic fallback: a fixed high-value question ladder so the flow still
# works without a Gemini key or on any LLM failure.
# --------------------------------------------------------------------------

_FALLBACK_LADDER = [
    DiscoveryQuestion(
        category="Platform",
        question="What platform do you need this to run on?",
        options=[
            DiscoveryOption(key="A", label="Website"),
            DiscoveryOption(key="B", label="Mobile app"),
            DiscoveryOption(key="C", label="Desktop application"),
            DiscoveryOption(key="D", label="Web + mobile"),
            DiscoveryOption(key="E", label="Not sure"),
        ],
    ),
    DiscoveryQuestion(
        category="Target Users",
        question="Who are the primary users?",
        options=[
            DiscoveryOption(key="A", label="Customers / consumers"),
            DiscoveryOption(key="B", label="Businesses (B2B)"),
            DiscoveryOption(key="C", label="Internal team / employees"),
            DiscoveryOption(key="D", label="Mixed"),
        ],
    ),
    DiscoveryQuestion(
        category="Timeline",
        question="What is your target timeline?",
        options=[
            DiscoveryOption(key="A", label="Under 2 weeks"),
            DiscoveryOption(key="B", label="2-4 weeks"),
            DiscoveryOption(key="C", label="1-3 months"),
            DiscoveryOption(key="D", label="Flexible"),
        ],
    ),
    DiscoveryQuestion(
        category="Budget",
        question="What is your approximate budget?",
        options=[
            DiscoveryOption(key="A", label="Under $1,000"),
            DiscoveryOption(key="B", label="$1,000 - $5,000"),
            DiscoveryOption(key="C", label="$5,000 - $20,000"),
            DiscoveryOption(key="D", label="Not decided"),
        ],
    ),
]


def _generic_next_question(answers: List[DiscoveryAnswer]) -> DiscoveryQuestion:
    idx = len(answers)
    if idx < len(_FALLBACK_LADDER):
        return _FALLBACK_LADDER[idx]
    return DiscoveryQuestion(
        category="Success Criteria",
        question="In one line, what does success look like for this project?",
        options=[],
        allow_custom=True,
    )


def _fallback(initial_request: str, answers: List[DiscoveryAnswer]) -> DiscoveryTurn:
    # After the fixed ladder is exhausted, assemble a low-confidence brief so the
    # user is never stuck — the proposal parser will still run on it.
    if len(answers) >= len(_FALLBACK_LADDER):
        answered = "; ".join(f"{a.question} → {a.answer}" for a in answers)
        return DiscoveryTurn(
            status="complete",
            confidence=COMPLETE_THRESHOLD,
            brief=ProjectBrief(
                project_goal=initial_request[:400],
                problem_statement=initial_request[:400],
                success_criteria=answered[:400] or "Deliver a working MVP that meets the stated goal.",
            ),
            missing_information=["Refined server-side (fallback mode — LLM unavailable)"],
        )
    return DiscoveryTurn(
        status="questioning",
        confidence=min(20 + len(answers) * 15, COMPLETE_THRESHOLD - 1),
        next_question=_generic_next_question(answers),
        missing_information=["platform", "users", "timeline", "budget"],
    )
