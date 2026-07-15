"""AIA-05 — Gemini call resilience tests (timeout / retry / fallback swap).

Runs without a Gemini key by replacing the module-scope ``genai.Client`` in
``app.llm.gemini`` with a scripted fake, so no network calls are made. Covers:

  - success on the first attempt (no retries, no fallback)
  - transient error retried, then success (model swaps to the fallback)
  - all-transient exhausts the retry budget and re-raises
  - a hung call is bounded by the per-call timeout and treated as transient
  - permanent errors fail fast on the first attempt (no retry, no fallback)
  - retry count honors GEMINI_MAX_RETRIES
  - a caller-pinned model is never swapped
  - backoff is applied between retries (attempts-1 times)

Plus focused unit tests for the pure helpers ``_is_transient`` and
``_backoff_delay``.

The file is both pytest-discoverable and runnable standalone
(`python test_gemini_resilience.py`), matching `test_confidence_grid.py`.
"""
from __future__ import annotations

import asyncio
from contextlib import contextmanager

from google.genai.errors import APIError
from pydantic import BaseModel

import app.llm.gemini as g
from app.config import get_settings


class Out(BaseModel):
    ok: bool = True


class _Resp:
    """Minimal stand-in for a google-genai response object."""

    def __init__(self, parsed=None, text: str = "") -> None:
        self.parsed = parsed
        self.text = text


def _api_error(code: int) -> APIError:
    """Build an ``APIError`` with a given status code without invoking the
    SDK constructor (which couples to response shapes we don't need here)."""
    err = APIError.__new__(APIError)
    err.code = code
    err.message = f"simulated {code}"
    return err


class _FakeModels:
    """Scripted ``client.aio.models`` stand-in.

    ``steps`` is a list of ``(kind, payload)`` applied per call (the last entry
    repeats once exhausted):
      - ("ok",    resp) -> return ``resp``
      - ("raise", exc)  -> raise ``exc``
      - ("hang",  secs) -> ``await asyncio.sleep(secs)`` (to trip the timeout)
    Every call's ``model`` name is recorded in ``self.calls``.
    """

    def __init__(self, steps: list[tuple[str, object]]) -> None:
        self.steps = steps
        self.calls: list[str] = []
        self._i = 0

    async def generate_content(self, *, model, contents, config):
        self.calls.append(model)
        kind, payload = self.steps[min(self._i, len(self.steps) - 1)]
        self._i += 1
        if kind == "hang":
            await asyncio.sleep(float(payload))  # type: ignore[arg-type]
            return _Resp(parsed=Out())
        if kind == "raise":
            raise payload  # type: ignore[misc]
        return payload


class _FakeClient:
    def __init__(self, models: _FakeModels) -> None:
        self.aio = type("Aio", (), {"models": models})()


@contextmanager
def _patched(
    steps: list[tuple[str, object]],
    *,
    max_retries: int = 3,
    timeout: float = 5.0,
    base_delay: float = 0.001,
    max_delay: float = 0.005,
):
    """Install the fake client + fast, deterministic resilience policy."""
    settings = get_settings()
    fake = _FakeModels(steps)
    saved_client = g._client
    saved = (
        settings.gemini_max_retries,
        settings.gemini_timeout_sec,
        settings.gemini_retry_base_delay_sec,
        settings.gemini_retry_max_delay_sec,
    )
    g._client = _FakeClient(fake)  # type: ignore[assignment]
    settings.gemini_max_retries = max_retries
    settings.gemini_timeout_sec = timeout
    settings.gemini_retry_base_delay_sec = base_delay
    settings.gemini_retry_max_delay_sec = max_delay
    try:
        yield fake
    finally:
        g._client = saved_client
        (
            settings.gemini_max_retries,
            settings.gemini_timeout_sec,
            settings.gemini_retry_base_delay_sec,
            settings.gemini_retry_max_delay_sec,
        ) = saved


def _run(fake_ctx_kwargs=None, **call_kwargs):
    """Helper: run ``generate_structured`` with default args."""
    return asyncio.run(
        g.generate_structured(
            system_instruction="sys",
            contents="content",
            response_schema=Out,
            **call_kwargs,
        )
    )


# ── helper: models resolved from settings ──────────────────────────────────
def _models():
    s = get_settings()
    return s.gemini_model, s.gemini_fallback_model


# ── behavior tests ──────────────────────────────────────────────────────────
def test_success_first_attempt():
    """One successful call: no retries, no fallback swap."""
    primary, _ = _models()
    with _patched([("ok", _Resp(parsed=Out()))]) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary]
    print("  [ok] success on first attempt -> single call, no swap")


def test_transient_then_success_swaps_to_fallback():
    """A transient failure retries and swaps to the fallback model."""
    primary, fallback = _models()
    steps = [("raise", asyncio.TimeoutError()), ("ok", _Resp(parsed=Out()))]
    with _patched(steps, max_retries=3) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary, fallback]
    print("  [ok] transient then success -> [primary, fallback]")


def test_all_transient_exhausts_retries():
    """All attempts fail transiently: re-raises after GEMINI_MAX_RETRIES calls."""
    primary, fallback = _models()
    with _patched([("raise", asyncio.TimeoutError())], max_retries=3) as fake:
        raised = False
        try:
            _run()
        except asyncio.TimeoutError:
            raised = True
    assert raised is True
    assert len(fake.calls) == 3
    assert fake.calls == [primary, fallback, fallback]
    print("  [ok] all transient -> 3 attempts, [primary, fallback, fallback], re-raised")


def test_timeout_is_bounded_and_retried():
    """A hung call is cut off by the per-call timeout and retried (transient)."""
    primary, fallback = _models()
    # First call hangs 5s but timeout is 50ms -> TimeoutError -> retry succeeds.
    steps = [("hang", 5.0), ("ok", _Resp(parsed=Out()))]
    with _patched(steps, max_retries=3, timeout=0.05) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary, fallback]
    print("  [ok] hung call bounded by timeout -> retried on fallback")


def test_permanent_apierror_fails_fast():
    """A 4xx APIError is permanent: one attempt, no retry, no fallback."""
    primary, _ = _models()
    with _patched([("raise", _api_error(400))], max_retries=3) as fake:
        raised_code = None
        try:
            _run()
        except APIError as e:
            raised_code = e.code
    assert raised_code == 400
    assert fake.calls == [primary]
    print("  [ok] permanent 400 -> fails fast, single call")


def test_non_apierror_fails_fast():
    """An arbitrary error (e.g. ValueError) is permanent: one attempt only."""
    primary, _ = _models()
    with _patched([("raise", ValueError("boom"))], max_retries=3) as fake:
        raised = False
        try:
            _run()
        except ValueError:
            raised = True
    assert raised is True
    assert fake.calls == [primary]
    print("  [ok] non-APIError -> fails fast, single call")


def test_transient_apierror_503_is_retried():
    """A 503 APIError is transient and retried on the fallback model."""
    primary, fallback = _models()
    steps = [("raise", _api_error(503)), ("ok", _Resp(parsed=Out()))]
    with _patched(steps, max_retries=3) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary, fallback]
    print("  [ok] transient 503 -> retried on fallback")


def test_retry_count_respects_max_retries():
    """The number of attempts equals GEMINI_MAX_RETRIES."""
    for n in (1, 2, 5):
        with _patched([("raise", asyncio.TimeoutError())], max_retries=n) as fake:
            try:
                _run()
            except asyncio.TimeoutError:
                pass
        assert len(fake.calls) == n, f"expected {n} attempts, got {len(fake.calls)}"
    print("  [ok] attempt count honors GEMINI_MAX_RETRIES (1, 2, 5)")


def test_pinned_model_is_never_swapped():
    """When the caller pins a model, every retry stays on that model."""
    primary, _ = _models()
    with _patched([("raise", asyncio.TimeoutError())], max_retries=3) as fake:
        try:
            _run(model=primary)
        except asyncio.TimeoutError:
            pass
    assert fake.calls == [primary, primary, primary]
    print("  [ok] pinned model -> no fallback swap")


def test_backoff_applied_between_retries():
    """Backoff runs exactly (attempts - 1) times, with 0-indexed attempts."""
    seen: list[int] = []
    real = g._backoff_delay

    def _spy(attempt, base, mx):
        seen.append(attempt)
        return 0.0  # no real sleep

    g._backoff_delay = _spy  # type: ignore[assignment]
    try:
        with _patched([("raise", asyncio.TimeoutError())], max_retries=3):
            try:
                _run()
            except asyncio.TimeoutError:
                pass
    finally:
        g._backoff_delay = real  # type: ignore[assignment]
    assert seen == [0, 1], f"expected backoff attempts [0, 1], got {seen}"
    print("  [ok] backoff applied between retries (attempts-1 times)")


# ── pure helper unit tests ────────────────────────────────────────────────
def test_is_transient_classification():
    assert g._is_transient(asyncio.TimeoutError()) is True
    assert g._is_transient(TimeoutError()) is True
    assert g._is_transient(ConnectionError()) is True
    assert g._is_transient(_api_error(429)) is True
    assert g._is_transient(_api_error(500)) is True
    assert g._is_transient(_api_error(503)) is True
    assert g._is_transient(_api_error(504)) is True
    assert g._is_transient(_api_error(400)) is False
    assert g._is_transient(_api_error(401)) is False
    assert g._is_transient(_api_error(404)) is False
    assert g._is_transient(ValueError("x")) is False
    print("  [ok] _is_transient classifies transient vs permanent")


def test_backoff_delay_bounds():
    base, mx = 1.0, 100.0
    # attempt n (uncapped): capped = base*2**n; delay in [capped, capped+base)
    for attempt, lo in ((0, 1.0), (1, 2.0), (2, 4.0), (3, 8.0)):
        d = g._backoff_delay(attempt, base, mx)
        assert lo <= d < lo + base, f"attempt {attempt}: {d} not in [{lo},{lo+base})"
    # large attempt is capped at max_delay (+ jitter up to base)
    d = g._backoff_delay(20, base, mx)
    assert mx <= d < mx + base, f"capped delay {d} not in [{mx},{mx+base})"
    print("  [ok] _backoff_delay respects exponential growth + cap + jitter")


if __name__ == "__main__":
    print("AIA-05 Gemini resilience tests")
    test_success_first_attempt()
    test_transient_then_success_swaps_to_fallback()
    test_all_transient_exhausts_retries()
    test_timeout_is_bounded_and_retried()
    test_permanent_apierror_fails_fast()
    test_non_apierror_fails_fast()
    test_transient_apierror_503_is_retried()
    test_retry_count_respects_max_retries()
    test_pinned_model_is_never_swapped()
    test_backoff_applied_between_retries()
    test_is_transient_classification()
    test_backoff_delay_bounds()
    print("ALL GEMINI RESILIENCE TESTS PASSED")
