"""AIE-03 — Confidence Grid self-correction tests (Step 3.5).

Runs without a Gemini key by replacing the structured-output wrapper
(`generate_structured`) with a deterministic fake. Covers the three required
scenarios plus the optimizer-failure path:

  (a) passes on the first cycle           -> no optimization, optimized=False
  (b) optimizer improves and is adopted   -> optimized=True, best is the new one
  (c) optimizer regresses and is reverted -> optimized=False, best is the original
  (d) optimizer raises (failure)          -> optimized=False, loop stops cleanly

Confirms the key invariant: `optimized` is never True when no improvement
occurred.

The file is both pytest-discoverable and runnable standalone
(`python test_confidence_grid.py`), matching the style of `smoke_test.py`.
"""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
from typing import Type, TypeVar

import app.features.confidence_grid as cg
from app.config import get_settings
from app.features.brief_parser import sanitize_and_patch_brief
from app.schemas.confidence import AuditorEvaluation, FeasibilityEvaluation
from app.schemas.proposal import Proposal

T = TypeVar("T")


def _base_proposal() -> Proposal:
    """A fully schema-valid Proposal built from the offline fallback path."""
    return sanitize_and_patch_brief({})


class _FakeLLM:
    """Deterministic stand-in for ``generate_structured``.

    ``scores`` holds one target index per *evaluation* (a paired Auditor +
    Feasibility run). Each evaluation applies its target to all four sub-scores,
    so the resulting ``confidenceIndex`` equals that target. Auditor and
    Feasibility calls are tracked with independent cursors because within one
    evaluation both are dispatched via ``asyncio.gather``.

    ``optimizer`` controls the optimization call:
      - "ok":    return a fresh proposal marked ``OPTIMIZED-{n}``
      - "raise": raise, simulating an optimizer failure
    """

    def __init__(self, base: Proposal, scores: list[int], optimizer: str = "ok") -> None:
        self._base = base
        self._scores = list(scores)
        self._optimizer = optimizer
        self._auditor_idx = 0
        self._feasibility_idx = 0
        self._optimize_count = 0
        self.optimizer_calls = 0

    def _make_optimized(self) -> Proposal:
        self._optimize_count += 1
        data = self._base.model_dump()
        data["project_summary"] = f"OPTIMIZED-{self._optimize_count}"
        return Proposal.model_validate(data)

    async def generate_structured(
        self,
        *,
        system_instruction: str,
        contents: str,
        response_schema: Type[T],
        temperature: float = 0.2,
        model: str | None = None,
    ) -> T:
        if response_schema is AuditorEvaluation:
            score = self._scores[self._auditor_idx]
            self._auditor_idx += 1
            return AuditorEvaluation(
                budget_alignment_score=score,
                deliverable_coverage_score=score,
                issues=[] if score >= 75 else ["budget/deliverable gap"],
                findings=f"auditor score {score}",
            )
        if response_schema is FeasibilityEvaluation:
            score = self._scores[self._feasibility_idx]
            self._feasibility_idx += 1
            return FeasibilityEvaluation(
                technical_feasibility_score=score,
                timeline_realism_score=score,
                issues=[] if score >= 75 else ["feasibility/timeline gap"],
                findings=f"feasibility score {score}",
            )
        if response_schema is Proposal:
            self.optimizer_calls += 1
            if self._optimizer == "raise":
                raise RuntimeError("simulated optimizer failure")
            return self._make_optimized()
        raise AssertionError(f"unexpected response_schema: {response_schema!r}")


@contextmanager
def _patched(fake: _FakeLLM, *, threshold: int, max_cycles: int, min_improvement: int):
    """Swap in the fake LLM and deterministic policy for the duration."""
    settings = get_settings()
    saved = (
        cg.generate_structured,
        settings.confidence_threshold,
        settings.max_correction_cycles,
        settings.confidence_min_improvement,
    )
    cg.generate_structured = fake.generate_structured  # type: ignore[assignment]
    settings.confidence_threshold = threshold
    settings.max_correction_cycles = max_cycles
    settings.confidence_min_improvement = min_improvement
    try:
        yield
    finally:
        (
            cg.generate_structured,  # type: ignore[assignment]
            settings.confidence_threshold,
            settings.max_correction_cycles,
            settings.confidence_min_improvement,
        ) = saved


def test_passes_first_cycle():
    """(a) Index clears the threshold immediately; no optimization runs."""
    base = _base_proposal()
    fake = _FakeLLM(base, scores=[80])
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
    fake = _FakeLLM(base, scores=[60, 85])
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
    fake = _FakeLLM(base, scores=[60, 50])
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
    fake = _FakeLLM(base, scores=[60], optimizer="raise")
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
        fake = _FakeLLM(base, scores=scores, optimizer=optimizer)
        with _patched(fake, threshold=75, max_cycles=1, min_improvement=0):
            result = asyncio.run(cg.process_confidence_grid("build an app", base))
        assert result.optimized == any(r.optimizationApplied for r in result.cycles)
    print("  [ok] optimized flag matches per-cycle optimizationApplied")


if __name__ == "__main__":
    print("AIE-03 confidence grid self-correction tests")
    test_passes_first_cycle()
    test_optimizer_improves_and_is_adopted()
    test_optimizer_regresses_and_is_reverted()
    test_optimizer_failure_stops_cleanly()
    test_optimized_flag_matches_cycle_records()
    print("ALL CONFIDENCE GRID TESTS PASSED")
