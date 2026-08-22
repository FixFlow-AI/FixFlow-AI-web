"""Proposal depth policy — pure, LLM-free (spec §A; R1.1, R1.3, R2.1, R2.2, R9.4).

Three questions, three functions, no side effects:

  1. **How much material did the brief carry?** :func:`brief_substance` counts
     words, distinct topic words, and discovery-answer markers.
  2. **How much depth may we therefore ask for?** :func:`targets_for` returns
     :data:`FULL_TARGETS` when the brief clears
     :data:`SUBSTANCE_WORD_THRESHOLD` words and :data:`REDUCED_TARGETS`
     otherwise, so a thin brief is never asked to fill six feature slots (R1.3).
  3. **How much depth did we actually get?** :func:`assess_depth` reports the
     actual count of every section against its target, and
     :func:`shortfall_instruction` names the short sections for the single
     bounded re-ask in ``brief_parser.parse_brief``.

The load-bearing constraint: this module **assesses, it never pads**.
:func:`assess_depth` does not mutate the proposal and constructs no
``Feature`` / ``Risk`` / ``MarketItem`` / ``ImpactItem`` — a shortfall is
*reported* (``depthLimited`` + a user-facing ``note``) rather than filled with
generic entries (R1.3, R2.5, R9.4). The only synthesising code in the parse
path is ``sanitize_and_patch_brief``, which runs on the explicitly-labelled
degraded path.

The features upper bound (``maxFeatures``) is Requirement 1.1's "stays
reviewable" cap. Exceeding it produces an ``over_cap`` note; nothing is ever
truncated.
"""
from __future__ import annotations

import re
from typing import List, Optional

from ..schemas.depth import BriefSubstance, DepthReport, DepthTargets, SectionDepth
from ..schemas.proposal import Proposal

# A brief at or above this word count gets the full depth targets (R1.1).
SUBSTANCE_WORD_THRESHOLD = 40

# Topic words must be at least this long to count as a distinct topic, which
# filters most function words without needing a language model.
_MIN_TOPIC_LENGTH = 4

FULL_TARGETS = DepthTargets(
    minFeatures=6,
    maxFeatures=12,
    minRisks=5,
    minRiskCategories=2,
    minMarket=3,
    minImpact=3,
    minTimelinePhases=3,
    minEffort=3,
    minCriteriaPerModule=2,
)
"""Depth expected of a brief with real substance (R1.1, R2.1, R2.2)."""

REDUCED_TARGETS = DepthTargets(
    minFeatures=2,
    # The reviewable cap is a presentation concern, so it does not relax.
    maxFeatures=12,
    # No floors: a thin brief cannot support them, and inventing items to hit a
    # floor is exactly what R1.3 forbids. Scope modules still carry their
    # schema-enforced two acceptance criteria.
    minRisks=0,
    minRiskCategories=0,
    minMarket=0,
    minImpact=0,
    minTimelinePhases=0,
    minEffort=0,
    minCriteriaPerModule=0,
)
"""Depth expected of a brief below the substance threshold (R1.3)."""

# Very common function words that would otherwise inflate the topic count.
_STOPWORDS = frozenset(
    {
        "about", "after", "also", "and", "any", "are", "been", "being", "both",
        "but", "can", "does", "each", "for", "from", "had", "has", "have",
        "here", "into", "its", "just", "like", "more", "most", "much", "must",
        "need", "needs", "not", "only", "other", "our", "out", "over", "own",
        "should", "some", "such", "than", "that", "the", "their", "them",
        "then", "there", "these", "they", "this", "those", "through", "very",
        "was", "were", "what", "when", "where", "which", "while", "will",
        "with", "would", "your",
    }
)

# A word is any run of characters carrying at least one alphanumeric. Kept
# unicode-aware so a non-English brief is measured, not discarded.
_WORD_RE = re.compile(r"[^\W_]+(?:['\u2019\-][^\W_]+)*", re.UNICODE)

# Discovery output reaches the parser as ``Label: value`` lines (see the
# frontend's ``briefToText``); the interview transcript form uses ``Q:``/``A:``.
_LABEL_LINE_RE = re.compile(r"^[^\S\n]*[^\W\d_][\w /&'\u2019-]{1,48}:[^\S\n]*\S", re.MULTILINE)
_QUESTION_LINE_RE = re.compile(r"^[^\S\n]*(?:\d+[.)]\s*)?Q\s*:", re.MULTILINE)
_ANSWER_LINE_RE = re.compile(r"^[^\S\n]*(?:\d+[.)]\s*)?A\s*:", re.MULTILINE)

# Minimum labelled lines before a brief reads as discovery-assembled rather
# than as prose that merely happens to contain a colon.
_MIN_DISCOVERY_LABELS = 3

# Section keys, in the order they are reported. Stable so the UI and the
# re-ask instruction always list sections the same way.
SECTION_FEATURES = "features"
SECTION_RISKS = "risks"
SECTION_RISK_CATEGORIES = "riskCategories"
SECTION_TIMELINE = "timeline"
SECTION_EFFORT = "effort"
SECTION_MARKET = "market"
SECTION_IMPACT = "impact"
SECTION_CRITERIA_PER_MODULE = "acceptanceCriteriaPerModule"

# Human phrasing for the user-facing note and the re-ask instruction.
_SECTION_LABELS = {
    SECTION_FEATURES: "scope items",
    SECTION_RISKS: "risks",
    SECTION_RISK_CATEGORIES: "distinct risk categories",
    SECTION_TIMELINE: "timeline phases",
    SECTION_EFFORT: "effort breakdown items",
    SECTION_MARKET: "market signals",
    SECTION_IMPACT: "impact items",
    SECTION_CRITERIA_PER_MODULE: "acceptance criteria on the thinnest scope module",
}


def brief_substance(brief_text: Optional[str]) -> BriefSubstance:
    """Measure how much material a brief actually supplied.

    Pure and deterministic. ``None``, empty, and whitespace-only text all yield
    zero counts and ``sufficient=False``.

    ``sufficient`` is decided by word count alone: Requirement 1.1 promises full
    depth for *any* brief of at least :data:`SUBSTANCE_WORD_THRESHOLD` words, so
    ``distinctTopicCount`` and ``hasDiscoveryAnswers`` are reported signals for
    the prompt and the note rather than additional gates.
    """
    text = brief_text or ""
    words = _WORD_RE.findall(text)
    topics = {
        word.casefold()
        for word in words
        if len(word) >= _MIN_TOPIC_LENGTH and word.casefold() not in _STOPWORDS
    }
    word_count = len(words)
    return BriefSubstance(
        wordCount=word_count,
        distinctTopicCount=len(topics),
        hasDiscoveryAnswers=_has_discovery_answers(text),
        sufficient=word_count >= SUBSTANCE_WORD_THRESHOLD,
    )


def _has_discovery_answers(text: str) -> bool:
    """Whether the brief looks assembled from discovery answers.

    Heuristic by design: either a ``Q:``/``A:`` transcript, or the several
    ``Label: value`` lines the discovery wizard emits.
    """
    if _QUESTION_LINE_RE.search(text) and _ANSWER_LINE_RE.search(text):
        return True
    return len(_LABEL_LINE_RE.findall(text)) >= _MIN_DISCOVERY_LABELS


def targets_for(substance: BriefSubstance) -> DepthTargets:
    """The depth targets a brief of this substance earns.

    Full targets exactly when the brief cleared the substance threshold,
    reduced targets otherwise (R1.1, R1.3).
    """
    return FULL_TARGETS if substance.sufficient else REDUCED_TARGETS


def assess_depth(proposal: Proposal, targets: DepthTargets) -> DepthReport:
    """Report the depth ``proposal`` reached against ``targets``.

    Read-only: the proposal is never mutated and no proposal item is ever
    constructed, so padding a short section is structurally impossible (R9.4).

    ``depthLimited`` is set with a ``limitReason`` exactly when at least one
    target is unmet. Features above ``maxFeatures`` add an ``over_cap`` note
    without truncating anything (R1.1).
    """
    sections: List[SectionDepth] = [
        _section(SECTION_FEATURES, len(proposal.features), targets.minFeatures),
        _section(SECTION_RISKS, len(proposal.risks), targets.minRisks),
        _section(
            SECTION_RISK_CATEGORIES,
            len({risk.category.strip().casefold() for risk in proposal.risks}),
            targets.minRiskCategories,
        ),
        _section(SECTION_TIMELINE, len(proposal.timeline), targets.minTimelinePhases),
        _section(SECTION_EFFORT, len(proposal.effort), targets.minEffort),
        _section(SECTION_MARKET, len(proposal.market), targets.minMarket),
        _section(SECTION_IMPACT, len(proposal.impact), targets.minImpact),
    ]

    # Acceptance criteria live on the execution plan's scope modules, which only
    # exist once a plan has been authored. Absent a plan there is nothing to
    # assess, so the section is omitted rather than reported as a shortfall.
    modules = proposal.executionPlan.scopeModules if proposal.executionPlan else []
    if modules:
        sections.append(
            _section(
                SECTION_CRITERIA_PER_MODULE,
                min(len(module.acceptanceCriteria) for module in modules),
                targets.minCriteriaPerModule,
            )
        )

    short = [section for section in sections if not section.met]
    limited = bool(short)
    reason = None
    if limited:
        # Reduced targets are only in play for a brief below the substance
        # threshold, so falling short of them is a brief problem, not a model one.
        reason = "brief_too_short" if targets == REDUCED_TARGETS else "model_shortfall"

    return DepthReport(
        sections=sections,
        depthLimited=limited,
        limitReason=reason,
        note=_note(short, reason, len(proposal.features), targets.maxFeatures),
        reaskUsed=False,
    )


def _section(name: str, actual: int, target: int) -> SectionDepth:
    return SectionDepth(section=name, actual=actual, target=target, met=actual >= target)


def _note(
    short: List[SectionDepth],
    reason: Optional[str],
    feature_count: int,
    max_features: int,
) -> Optional[str]:
    """The user-facing depth sentence, or ``None`` when there is nothing to say."""
    parts: List[str] = []
    if short:
        listed = "; ".join(f"{_SECTION_LABELS[s.section]} {s.actual} of {s.target}" for s in short)
        if reason == "brief_too_short":
            parts.append(
                "Depth was limited by the level of detail in the brief "
                f"({listed}). Add more detail for a fuller proposal — "
                "nothing was padded with generic entries."
            )
        else:
            parts.append(
                f"This proposal fell short of the expected depth ({listed}). "
                "The shortfall is reported rather than padded with generic entries."
            )
    if feature_count > max_features:
        parts.append(
            f"over_cap: {feature_count} scope items were produced against a reviewable "
            f"cap of {max_features}; none were truncated."
        )
    return " ".join(parts) if parts else None


def shortfall_instruction(report: DepthReport) -> Optional[str]:
    """Name exactly which sections are short, for the single bounded re-ask.

    Returns ``None`` when nothing is short.
    """
    short = [section for section in report.sections if not section.met]
    if not short:
        return None
    listed = "\n".join(
        f"- {_SECTION_LABELS[s.section]}: you produced {s.actual}, at least {s.target} are required"
        for s in short
    )
    return (
        "Your previous response was short on the following sections:\n"
        f"{listed}\n"
        "Regenerate the full proposal with these sections expanded using genuine, "
        "brief-grounded detail. Do NOT pad with generic or duplicated entries: if the "
        "brief truly does not support more, keep the section as it is rather than "
        "inventing items, and do not invent numeric scores."
    )
