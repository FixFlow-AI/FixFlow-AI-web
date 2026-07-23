"""AIE-03 — Confidence Grid self-correction loop tests (updated for AIE-09).

Covers the self-correction *loop mechanics* independently of the scoring
internals (those are covered in ``test_confidence_scoring.py``). Runs without a
Gemini key by:

  * patching ``cg.evaluate_proposal`` with a deterministic fake that yields a
    controlled confidence index per evaluation, and
  * patching ``cg.generate_structured`` so the optimizer returns a fresh
    proposal marked ``OPTIMIZED-{n}``.

Scenarios:
  (a) passes on the first cycle           -> no optimization, optimized=False
  (b) optimizer improves and is adopted   -> optimized=True, best is the new one
  (c) optimizer regresses and is reverted -> optimized=False, best is the original
  (d) optimizer raises (failure)          -> optimized=False, loop stops cleanly

Confirms the key invariant: `optimized` is never True when no improvement
occurred.

Runnable standalone (`python test_confidence_grid.py`) or via pytest.
"""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
from typing import Type, TypeVar

import app.features.confidence_grid as cg
from app.config import get_settings
from app.features.brief_parser import sanitize_and_patch_brief
from app.schemas.confidence import (
    AuditorEvaluation,
    FactorScore,
    FeasibilityEvaluation,
)
from app.schemas.proposal import Proposal

T = TypeVar("T")


def _base_proposal() -> Proposal:
    """A fully schema-valid Proposal built from the offline fallback path."""
    return sanitize_and_patch_brief({})


def _factor(name: str, score: int) -> FactorScore:
    return FactorScore(
        name=name,
        score=score,
        deterministic_base=score,
        llm_modifier=0,
        evidence=[f"{name} base {score}"],
    )


def _auditor_eval(score: int) -> AuditorEvaluation:
    return AuditorEvaluation(
        budget_alignment=_factor("budget_alignment", score),
        deliverable_coverage=_factor("deliverable_coverage", score),
        issues=[] if score >= 75 else ["budget/deliverable gap"],
        findings=f"auditor score {score}",
    )


def _feasibility_eval(score: int) -> FeasibilityEvaluation:
    return FeasibilityEvaluation(
        technical_feasibility=_factor("technical_feasibility", score),
        timeline_realism=_factor("timeline_realism", score),
        issues=[] if score >= 75 else ["feasibility/timeline gap"],
        findings=f"feasibility score {score}",
    )


class _FakeLoop:
    """Deterministic stand-ins for evaluate_proposal + the optimizer LLM call.

    ``scores`` holds one target confidence index per *evaluation*; each is
    consumed in order. ``optimizer`` controls the optimize call:
      - "ok":    return a fresh proposal marked ``OPTIMIZED-{n}``
      - "raise": raise, simulating an optimizer failure
    """

    def __init__(self, base: Proposal, scores: list[int], optimizer: str = "ok") -> None:
        self._base = base
        self._scores = list(scores)
        self._optimizer = optimizer
        self._eval_idx = 0
        self._optimize_count = 0
        self.optimizer_calls = 0

    @property
    def eval_count(self) -> int:
        return self._eval_idx

    async def evaluate_proposal(self, brief_text: str, proposal: Proposal):
        score = self._scores[self._eval_idx]
        self._eval_idx += 1
        return _auditor_eval(score), _feasibility_eval(score), score

    async def generate_structured(
        self,
        *,
        system_instruction: str,
        contents: str,
        response_schema: Type[T],
        temperature: float = 0.2,
        model: str | None = None,
    ) -> T:
        # Only the optimizer path reaches generate_structured now.
        assert response_schema is Proposal, f"unexpected schema: {response_schema!r}"
        self.optimizer_calls += 1
        if self._optimizer == "raise":
            raise RuntimeError("simulated optimizer failure")
        self._optimize_count += 1
        data = self._base.model_dump()
        data["project_summary"] = f"OPTIMIZED-{self._optimize_count}"
        return Proposal.model_validate(data)


@contextmanager
def _patched(fake: _FakeLoop, *, threshold: int, max_cycles: int, min_improvement: int):
    """Swap in the fake loop primitives and deterministic policy for the duration."""
    settings = get_settings()
    saved = (
        cg.evaluate_proposal,
        cg.generate_structured,
        settings.confidence_threshold,
        settings.max_correction_cycles,
        settings.confidence_min_improvement,
    )
    cg.evaluate_proposal = fake.evaluate_proposal  # type: ignore[assignment]
    cg.generate_structured = fake.generate_structured  # type: ignore[assignment]
    settings.confidence_threshold = threshold
    settings.max_correction_cycles = max_cycles
    settings.confidence_min_improvement = min_improvement
    try:
        yield
    finally:
        (
            cg.evaluate_proposal,  # type: ignore[assignment]
            cg.generate_structured,  # type: ignore[assignment]
            settings.confidence_threshold,
            settings.max_correction_cycles,
            settings.confidence_min_improvement,
        ) = saved


def test_passes_first_cycle():
    """(a) Index clears the threshold immediately; no optimization runs."""
    base = _base_proposal()
    fake = _FakeLoop(base, scores=[80])
    with _patched(fake, threshold=75, max_cycles=1, min_improvement=0):
        result = asyncio.run(cg.process_confidence_grid("build an app", base))

    assert result.confidenceIndex == 80
    assert result.optimized is False
    assert fake.optimizer_calls == 0
    assert len(result.cycles) == 1
    assert result.bestCycle == 0
    assert result.finalProposal.project_summary == base.project_summary
    print("  [ok] (a) passes first cycle -> no optimization")


def test_optimizer_improves_and_is_adopted():
    """(b) Below threshold, the optimized proposal scores higher and is kept."""
    base = _base_proposal()
    fake = _FakeLoop(base, scores=[60, 85])
    with _patched(fake, threshold=75, max_cycles=1, min_improvement=0):
        result = asyncio.run(cg.process_confidence_grid("build an app", base))

    assert fake.optimizer_calls == 1
    assert result.confidenceIndex == 85
    assert result.optimized is True
    assert result.bestCycle == 1
    assert len(result.cycles) == 2
    assert result.finalProposal.project_summary == "OPTIMIZED-1"
    assert result.cycles[0].optimizationApplied is True
    print("  [ok] (b) optimizer improves -> adopted")


def test_optimizer_regresses_and_is_reverted():
    """(c) Optimized proposal scores lower; original is kept, optimized=False."""
    base = _base_proposal()
    fake = _FakeLoop(base, scores=[60, 50])
    with _patched(fake, threshold=75, max_cycles=1, min_improvement=0):
        result = asyncio.run(cg.process_confidence_grid("build an app", base))

    assert fake.optimizer_calls == 1
    assert result.confidenceIndex == 60  # best (original) score retained
    assert result.optimized is False
    assert result.bestCycle == 0
    assert result.finalProposal.project_summary == base.project_summary
    assert all(r.optimizationApplied is False for r in result.cycles)
    print("  [ok] (c) optimizer regresses -> reverted")


def test_optimizer_failure_stops_cleanly():
    """(d) Optimizer raises; result reports optimized=False and stops."""
    base = _base_proposal()
    fake = _FakeLoop(base, scores=[60], optimizer="raise")
    with _patched(fake, threshold=75, max_cycles=1, min_improvement=0):
        result = asyncio.run(cg.process_confidence_grid("build an app", base))

    assert fake.optimizer_calls == 1
    assert result.confidenceIndex == 60
    assert result.optimized is False
    assert result.finalProposal.project_summary == base.project_summary
    assert all(r.optimizationApplied is False for r in result.cycles)
    print("  [ok] (d) optimizer failure -> optimized=False, stops cleanly")


def test_optimized_flag_matches_cycle_records():
    """Invariant: `optimized` is never True unless a cycle applied optimization."""
    base = _base_proposal()
    for scores, optimizer in ([80], "ok"), ([60, 50], "ok"), ([60], "raise"):
        fake = _FakeLoop(base, scores=scores, optimizer=optimizer)
        with _patched(fake, threshold=75, max_cycles=1, min_improvement=0):
            result = asyncio.run(cg.process_confidence_grid("build an app", base))
        assert result.optimized == any(r.optimizationApplied for r in result.cycles)
    print("  [ok] optimized flag matches per-cycle optimizationApplied")


def test_evaluation_counts_invariant():
    """Verify that total evaluations match optimization attempts + 1 (BUG-05)."""
    base = _base_proposal()
    # max_cycles=3. Scores: original=60, opt1=70, opt2=80 (threshold=75)
    #   evaluate original (60) -> optimize -> evaluate opt1 (70) improved
    #   -> optimize -> evaluate opt2 (80) improved -> 80 >= 75 break.
    # Total optimizations = 2, total evaluations = 3.
    fake = _FakeLoop(base, scores=[60, 70, 80])
    with _patched(fake, threshold=75, max_cycles=3, min_improvement=0):
        result = asyncio.run(cg.process_confidence_grid("build an app", base))

    assert fake.optimizer_calls == 2
    assert fake.eval_count == 3  # 3 evaluations
    assert len(result.cycles) == 3  # cycle 0, cycle 1, cycle 2
    print("  [ok] evaluation counts invariant verified (evaluations = optimizations + 1)")


if __name__ == "__main__":
    print("AIE-03 confidence grid self-correction tests")
    test_passes_first_cycle()
    test_optimizer_improves_and_is_adopted()
    test_optimizer_regresses_and_is_reverted()
    test_optimizer_failure_stops_cleanly()
    test_optimized_flag_matches_cycle_records()
    test_evaluation_counts_invariant()
    print("ALL CONFIDENCE GRID TESTS PASSED")
