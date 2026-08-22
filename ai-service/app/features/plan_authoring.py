"""Plan authoring — the single LLM pass that supplies plan *content*.

One bounded Gemini call constrained to :class:`PlanAuthoringDraft`. The model is
asked for qualitative depth only: scope modules with verifiable acceptance
criteria, a real component architecture with typed edges, week-by-week
objectives and client actions, tasks with spans and dependencies, checkpoints,
and risk links. It is told — and structurally prevented, because the draft
schema has no numeric field beyond ordinal week positions — that it may not
supply hours, severities, percentages, or any other figure. Every number on the
emitted plan is computed downstream by ``plan_assembly``.

``author_plan_draft`` never raises. A missing API key, a timeout, a transport
error, or a draft that fails validation all return ``None``. The caller has
already built the deterministic baseline plan, so a ``None`` here costs nothing
but the enrichment (R9.3, R9.4).
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from ..config import get_settings
from ..llm.gemini import generate_structured
from ..schemas.plan_draft import PlanAuthoringDraft
from ..schemas.proposal import Proposal
from .fallback_logger import log_fallback

logger = logging.getLogger(__name__)

_FEATURE = "plan_authoring"

# The brief is context, not the payload — bound it so a pasted transcript cannot
# push the authoring call past its budget.
_MAX_BRIEF_CHARS = 12_000
# Ordinal week ceiling handed to the model. The assembler clamps spans anyway;
# this just keeps the ask plausible.
_MAX_WEEKS = 26
_DEFAULT_WEEKS = 4


PLAN_SYSTEM_PROMPT = """You are the lead delivery architect for FixFlow AI.
You are given an approved project proposal and (when available) the original client brief. Author the deep execution plan behind that proposal: the scope boundaries, the architecture, and the week-by-week plan of work.

You author CONTENT ONLY. You do not author numbers.

ABSOLUTE NUMERIC RULE:
Do not supply any hour figure, effort estimate, duration in hours or days, severity, score, percentage, count, cost, budget, or calendar date — anywhere, including inside prose. The only numbers you may emit are ordinal week positions (`weekNumber`, `startWeek`, `endWeek`), and they are positions in the plan, not measurements. The service computes every figure deterministically: task hours from `complexity`, risk severity from the matched proposal risk, role capacity from peak demand. Express size through `complexity` (High/Medium/Low) and `priority` (must/should/could), never through a quantity.

DRAFT-LOCAL KEYS:
Every cross-reference uses a `key` you define in this same draft (short, lowercase, hyphenated, unique within its collection). A reference that does not resolve to a key defined here is DROPPED — the content is lost, not repaired. So: reference only keys you actually defined, and define every key you reference.
- `requirementKeys` -> `requirements[].key`
- `componentKeys`, `dependencyComponentKeys`, `fromKey`, `toKey` -> `components[].key`
- `moduleKey`, `affectedModuleKeys` -> `scopeModules[].key`
- `workstreamKey` -> `workstreams[].id`
- `ownerRoleKey` -> one of the exact strings in `roles`
- `taskKeys`, `dependencyTaskKeys`, `linkedTaskKeys`, `mitigationTaskKeys` -> `tasks[].key`
- `checkpointKeys`, `mitigationCheckpointKeys` -> `checkpoints[].key`
- `assumptionIds` / `openQuestions[].id` are keys you mint the same way.

WHAT DEPTH MEANS HERE:
1. `requirements` — one entry per distinct thing the client needs, including needs implied rather than stated. Set `source` honestly: `brief` when stated, `discovery` when it came from clarification, `client` when the client asserted it, `inferred` when you deduced it. Set `priority` to reflect what the project fails without.
2. `scopeModules` — break the work into several genuinely separate modules, one per coherent area of capability, not one per feature title. Each carries a business objective, its actors, what is in scope, an explicit `outOfScope` boundary (what a reader might assume is included but is not), at least two acceptance criteria that a reviewer could actually verify pass/fail, the requirement keys it satisfies, plus data entities, integrations and security controls where they apply.
3. `workstreams` and `roles` — the parallel streams of work, and the role names that own tasks. Use role names a client would recognise.
4. `components` and `edges` — a real component architecture, not a restatement of the modules. Each component states its responsibility, its data boundary (what data it owns and what it must never touch), its interfaces, how it handles errors, and its failure impact. Use `openDecisions` only for design choices genuinely still unresolved, and `decisions` for choices already made. Then connect them with typed edges, direction from caller/producer to callee/consumer:
   - `sync` — a blocking request/response the caller waits on
   - `async` — a queued or background hand-off the caller does not wait on
   - `data` — a read/write of shared persisted state
   - `event` — a published notification with no expectation of a reply
   Draw the edges that actually exist; no self-edges, no edge to a component you did not define, and prefer an acyclic flow.
5. `weeks` — one entry per week from 1 upward with no gaps, each with a label and a concrete objective for that week. Every week must carry at least one task, deliverable, checkpoint, or client action; an empty week is reported as a gap. `clientActions` are the things only the client can do (approvals, access, content, test data) — set `required` to true when the schedule genuinely stops until the client acts, and false when the work can continue without it.
6. `tasks` — the units of work behind the modules. Each names the module it serves, its workstream, its owner role, its week span (`startWeek` <= `endWeek`, within the week range given below), its acceptance criteria, and the evidence a reviewer needs to accept it. `dependencyTaskKeys` are real prerequisites only: a dependency must finish no later than its dependent starts, and the dependency graph must contain no cycles. Set `complexity` carefully — it is the only signal the service has for sizing.
7. `checkpoints` — the review gates that de-risk the plan (design review, demo, client approval, security review, release readiness), each in a specific week, with an owner role, exit criteria, the evidence required, and the tasks it reviews. Mark `blocking` when later work must not start until the gate passes.
8. `risks` — project the proposal's risks onto the plan. Reuse each risk's `label` from the supplied proposal EXACTLY as given, so the service can inherit its computed severity, and state the modules and weeks it threatens plus the tasks and checkpoints that mitigate it. Do not restate severity in any form.
9. `planningAssumptions` and `openQuestions` — what you had to assume, and what you still need answered. Mark an open question `blocking` when work cannot responsibly start without the answer, and link it to the requirements it blocks.

STYLE:
Be specific to this project. Write the plan you would defend in a delivery review: concrete, verifiable, and honest about boundaries and unknowns. Never pad a collection to look thorough — an accurate five modules beats an invented eight. Output strict JSON conforming to the requested schema, with no markdown decorators and no commentary."""


# ---------------------------------------------------------------------------
# Prompt payload
# ---------------------------------------------------------------------------

def _week_count(proposal: Proposal) -> int:
    """Plan horizon in weeks, taken from the proposal's own delivery plan.

    The weekly delivery plan is already derived from the timeline phases, so its
    furthest ``endWeek`` is the horizon the client has effectively seen.
    """
    weeks = getattr(getattr(proposal, "delivery_plan", None), "weeks", None) or []
    horizon = 0
    for week in weeks:
        horizon = max(horizon, int(week.endWeek or 0), int(week.startWeek or 0))
    if horizon < 1:
        horizon = _DEFAULT_WEEKS
    return min(horizon, _MAX_WEEKS)


def _bullet(lines: List[str]) -> str:
    return "\n".join(f"- {line}" for line in lines) if lines else "- (none supplied)"


def _proposal_context(proposal: Proposal, week_count: int) -> str:
    """A compact, deterministic rendering of the proposal for the prompt.

    Numeric proposal fields (confidence, severity, relevance, impact, effort
    percentages) are deliberately omitted: the model has no use for them and
    showing them invites it to echo figures back.
    """
    features = [
        f"{f.title} [{f.area}, complexity {f.complexity}] — {f.description} "
        f"Approach: {f.technical_approach}"
        for f in proposal.features
    ]
    risks = [f"{r.label} [{r.category}] — mitigation: {r.mitigation}" for r in proposal.risks]
    phases = [
        f"{p.phase} ({p.duration}) — tasks: {'; '.join(p.tasks) or 'unspecified'}"
        for p in proposal.timeline
    ]
    effort = [f"{e.label} over {e.timeframe} — {e.description}" for e in proposal.effort]

    return (
        f"PROJECT SUMMARY\n{proposal.project_summary}\n\n"
        f"PLAN HORIZON\nThe plan covers weeks 1 to {week_count}. Every week in that "
        f"range must appear exactly once in `weeks`, and every task span must fall "
        f"inside it.\n\n"
        f"AGREED FEATURES\n{_bullet(features)}\n\n"
        f"IDENTIFIED RISKS (reuse these labels verbatim in `risks[].label`)\n{_bullet(risks)}\n\n"
        f"TIMELINE PHASES\n{_bullet(phases)}\n\n"
        f"EFFORT SHAPE\n{_bullet(effort)}"
    )


def _build_contents(proposal: Proposal, brief_text: Optional[str], week_count: int) -> str:
    parts = [
        "Author the execution plan behind the proposal below, conforming strictly "
        "to the requested schema.",
        _proposal_context(proposal, week_count),
    ]
    brief = (brief_text or "").strip()
    if brief:
        parts.append(f"ORIGINAL CLIENT BRIEF\n{brief[:_MAX_BRIEF_CHARS]}")
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# The authoring pass
# ---------------------------------------------------------------------------

def _effective_timeout(timeout_sec: float | None) -> float:
    """A usable positive budget, falling back to the configured plan timeout."""
    try:
        value = float(timeout_sec)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        value = 0.0
    if value > 0:
        return value
    return float(get_settings().gemini_plan_timeout_sec)


async def author_plan_draft(
    proposal: Proposal,
    brief_text: str | None,
    *,
    timeout_sec: float,
) -> PlanAuthoringDraft | None:
    """One bounded Gemini call constrained to :class:`PlanAuthoringDraft`.

    Returns the validated draft, or ``None`` on timeout, missing API key,
    transport error, or validation failure. Never raises into the request path:
    the caller already holds a valid deterministic baseline plan.
    """
    try:
        settings = get_settings()
        if not settings.gemini_api_key:
            # Nothing to call. Skipping is cheaper than an exception round-trip,
            # and this is the normal state in local/CI runs.
            logger.info("Plan authoring skipped: GEMINI_API_KEY is not configured.")
            return None

        week_count = _week_count(proposal)
        contents = _build_contents(proposal, brief_text, week_count)

        # ``generate_structured`` applies its own per-attempt timeout and bounded
        # retries; this wrapper is the authoritative budget for the whole pass,
        # so authoring can never overrun the request (R9.5).
        draft = await asyncio.wait_for(
            generate_structured(
                system_instruction=PLAN_SYSTEM_PROMPT,
                contents=contents,
                response_schema=PlanAuthoringDraft,
                temperature=0.2,
                model=settings.gemini_proposal_model,
            ),
            timeout=_effective_timeout(timeout_sec),
        )
    except (asyncio.TimeoutError, TimeoutError) as timeout_error:
        log_fallback(_FEATURE, "timeout", str(timeout_error))
        logger.warning("Plan authoring timed out; continuing with the derived plan.")
        return None
    except Exception as error:  # noqa: BLE001 - authoring is optional enrichment
        log_fallback(_FEATURE, "authoring_failed", str(error))
        logger.warning(
            "Plan authoring failed (%s); continuing with the derived plan.",
            type(error).__name__,
        )
        return None

    if not isinstance(draft, PlanAuthoringDraft):
        log_fallback(_FEATURE, "authoring_failed", f"unexpected draft type {type(draft)!r}")
        return None
    return draft
