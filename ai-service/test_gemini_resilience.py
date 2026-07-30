"""AIA-05 — LLM call resilience tests (timeout / retry / fallback swap).

Runs without any provider API key by replacing the provider-construction seam
``app.llm.client._build_llm`` with a scripted fake, so no network calls are
made. Since the refactor to the LangChain provider abstraction, ``client.py``
no longer talks to the ``google-genai`` SDK directly: it obtains a LangChain
chat model from ``LLMFactory`` (via ``_build_llm``), calls
``with_structured_output(schema, include_raw=True)`` on it, and awaits
``ainvoke(messages)`` which yields ``{"parsed", "raw", "parsing_error"}``.

Covered behaviors (unchanged in intent from the google-genai era):

  - success on the first attempt (no retries, no fallback)
  - transient error retried, then success (model swaps to the fallback)
  - all-transient exhausts the retry budget and re-raises
  - a hung call is bounded by the per-call timeout and treated as transient
  - permanent errors fail fast on the first attempt (no retry, no fallback)
  - retry count honors LLM_MAX_RETRIES
  - a caller-pinned model is never swapped
  - backoff is applied between retries (attempts-1 times)

Plus focused unit tests for the pure helpers ``_is_transient`` and
``_backoff_delay``.

The file is both pytest-discoverable and runnable standalone
(`python test_gemini_resilience.py`), matching `test_confidence_grid.py`.
"""
from __future__ import annotations

import asyncio
import time
from contextlib import contextmanager

from pydantic import BaseModel, ValidationError

import app.llm.client as g
import app.llm.cache as cache_mod
from app.config import get_settings


class Out(BaseModel):
    ok: bool = True


class Strict(BaseModel):
    """Schema with a required, non-coercible field used to force a
    ``ValidationError`` on the manual-validation fallback path (BUG-10)."""

    value: int


class _StatusError(Exception):
    """Stand-in for a provider SDK error carrying an HTTP status code, the way
    LangChain integrations surface transient (429/5xx) vs permanent (4xx)
    conditions via a ``status_code`` attribute."""

    def __init__(self, status_code: int) -> None:
        super().__init__(f"simulated {status_code}")
        self.status_code = status_code


def _status_error(code: int) -> _StatusError:
    return _StatusError(code)


class _FakeRaw:
    """Minimal stand-in for a LangChain ``AIMessage`` (the ``raw`` field)."""

    def __init__(self, content: str = "", usage=None) -> None:
        self.content = content
        self.usage_metadata = usage or {"input_tokens": 1, "output_tokens": 2}


class _FakeStructured:
    """Stand-in for ``llm.with_structured_output(...)``; scripts one ``ainvoke``.

    ``step`` is a ``(kind, payload)`` tuple:
      - ("ok",    parsed)   -> return {"parsed": parsed, "raw": _FakeRaw(), ...}
      - ("dict",  result)   -> return ``result`` verbatim (for parse-error paths)
      - ("raise", exc)      -> raise ``exc``
      - ("hang",  secs)     -> ``await asyncio.sleep(secs)`` (to trip the timeout)
    """

    def __init__(self, step: tuple[str, object]) -> None:
        self.step = step

    async def ainvoke(self, messages):
        kind, payload = self.step
        if kind == "hang":
            await asyncio.sleep(float(payload))  # type: ignore[arg-type]
            return {"parsed": Out(), "raw": _FakeRaw(), "parsing_error": None}
        if kind == "raise":
            raise payload  # type: ignore[misc]
        if kind == "dict":
            return payload  # type: ignore[return-value]
        # "ok"
        return {"parsed": payload, "raw": _FakeRaw(), "parsing_error": None}


class _FakeLLM:
    def __init__(self, step: tuple[str, object]) -> None:
        self.step = step

    def with_structured_output(self, schema, include_raw: bool = False):
        return _FakeStructured(self.step)


class _FakeBuilder:
    """Scripted ``_build_llm`` stand-in.

    ``steps`` is a list of ``(kind, payload)`` applied per call (the last entry
    repeats once exhausted). Every call's requested ``model`` is recorded in
    ``self.calls`` so tests can assert primary/fallback routing.
    """

    def __init__(self, steps: list[tuple[str, object]]) -> None:
        self.steps = steps
        self.calls: list[str | None] = []
        self._i = 0

    def build(self, provider, model, temperature):
        self.calls.append(model)
        step = self.steps[min(self._i, len(self.steps) - 1)]
        self._i += 1
        return _FakeLLM(step)


@contextmanager
def _patched(
    steps: list[tuple[str, object]],
    *,
    max_retries: int = 3,
    timeout: float = 5.0,
    base_delay: float = 0.001,
    max_delay: float = 0.005,
    provider: str = "gemini",
):
    """Install the fake provider builder + fast, deterministic resilience policy."""
    settings = get_settings()
    fake = _FakeBuilder(steps)
    saved_build = g._build_llm
    saved = (
        settings.llm_max_retries,
        settings.llm_timeout_sec,
        settings.llm_retry_base_delay_sec,
        settings.llm_retry_max_delay_sec,
    )
    # These tests exercise Gemini-specific routing (allowlist + same-provider
    # model fallback), so pin the provider rather than depend on the ambient
    # LLM_PROVIDER env (which may be set to groq in a dev .env).
    saved_provider = settings.llm_provider
    settings.llm_provider = provider
    # The primary circuit breaker is a module-global singleton whose state would
    # otherwise leak across tests (accumulated failures would trip it Open and
    # change routing). Snapshot and reset it to a clean Closed state per test.
    breaker = g.primary_breaker
    saved_breaker = (breaker.state, breaker.failure_count, breaker.last_state_change)
    breaker.state = "Closed"
    breaker.failure_count = 0
    breaker.last_state_change = time.time()
    # The in-memory response cache is also a module-global. A cache hit would
    # short-circuit generate_structured before the fake builder is ever called,
    # so start every test from an empty cache for deterministic routing.
    saved_cache = dict(cache_mod._local_cache)
    cache_mod._local_cache.clear()
    g._build_llm = fake.build  # type: ignore[assignment]
    settings.llm_max_retries = max_retries
    settings.llm_timeout_sec = timeout
    settings.llm_retry_base_delay_sec = base_delay
    settings.llm_retry_max_delay_sec = max_delay
    try:
        yield fake
    finally:
        g._build_llm = saved_build  # type: ignore[assignment]
        settings.llm_provider = saved_provider
        (
            settings.llm_max_retries,
            settings.llm_timeout_sec,
            settings.llm_retry_base_delay_sec,
            settings.llm_retry_max_delay_sec,
        ) = saved
        (breaker.state, breaker.failure_count, breaker.last_state_change) = saved_breaker
        cache_mod._local_cache.clear()
        cache_mod._local_cache.update(saved_cache)


def _run(**call_kwargs):
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
    with _patched([("ok", Out())]) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary]
    print("  [ok] success on first attempt -> single call, no swap")


def test_transient_then_success_swaps_to_fallback():
    """A transient failure retries and swaps to the fallback model."""
    primary, fallback = _models()
    steps = [("raise", asyncio.TimeoutError()), ("ok", Out())]
    with _patched(steps, max_retries=3) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary, fallback]
    print("  [ok] transient then success -> [primary, fallback]")


def test_all_transient_exhausts_retries():
    """All attempts fail transiently: re-raises after LLM_MAX_RETRIES calls."""
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
    steps = [("hang", 5.0), ("ok", Out())]
    with _patched(steps, max_retries=3, timeout=0.05) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary, fallback]
    print("  [ok] hung call bounded by timeout -> retried on fallback")


def test_permanent_status_error_fails_fast():
    """A 4xx provider error is permanent: one attempt, no retry, no fallback."""
    primary, _ = _models()
    with _patched([("raise", _status_error(400))], max_retries=3) as fake:
        raised_code = None
        try:
            _run()
        except _StatusError as e:
            raised_code = e.status_code
    assert raised_code == 400
    assert fake.calls == [primary]
    print("  [ok] permanent 400 -> fails fast, single call")


def test_non_status_error_fails_fast():
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
    print("  [ok] non-status error -> fails fast, single call")


def test_transient_status_503_is_retried():
    """A 503 provider error is transient and retried on the fallback model."""
    primary, fallback = _models()
    steps = [("raise", _status_error(503)), ("ok", Out())]
    with _patched(steps, max_retries=3) as fake:
        result = _run()
    assert result.ok is True
    assert fake.calls == [primary, fallback]
    print("  [ok] transient 503 -> retried on fallback")


def test_retry_count_respects_max_retries():
    """The number of attempts equals LLM_MAX_RETRIES."""
    for n in (1, 2, 5):
        with _patched([("raise", asyncio.TimeoutError())], max_retries=n) as fake:
            try:
                _run()
            except asyncio.TimeoutError:
                pass
        assert len(fake.calls) == n, f"expected {n} attempts, got {len(fake.calls)}"
    print("  [ok] attempt count honors LLM_MAX_RETRIES (1, 2, 5)")


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


def test_pinned_gemini_model_ignored_on_non_gemini_provider():
    """A caller-pinned Gemini model must NOT leak to a non-Gemini provider.

    Regression guard: with LLM_PROVIDER=groq, brief_parser still pins the
    Gemini proposal model. Forwarding that name to Groq produced a live 404
    ``model_not_found``. The active provider must fall back to its own default
    model (recorded here as ``None`` -> provider default), and never swap.
    """
    groq_default = get_settings().groq_model
    with _patched([("ok", Out())], provider="groq") as fake:
        result = _run(model="gemini-3.5-flash")
    assert result.ok is True
    # The Gemini name is rejected and degrades to Groq's configured default;
    # it must never be forwarded to Groq. A pinned model is never swapped, so
    # there is exactly one attempt.
    assert fake.calls == [groq_default], fake.calls
    assert "gemini-3.5-flash" not in fake.calls
    print("  [ok] pinned gemini model ignored on groq provider -> uses groq default")


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


# ── BUG-10: manual-validation fallback raises ValidationError, not NameError ─
def test_schema_violation_raises_validation_error_with_raw_payload():
    """Malformed-but-parseable JSON on the manual fallback path must raise a
    ``pydantic.ValidationError`` carrying the parsed dict as ``raw_payload`` —
    not a ``NameError`` from an undefined ``ValidationError`` reference.

    Regression guard for BUG-10.
    """
    # `parsed` is None (structured parsing didn't populate it) but `raw.content`
    # is valid JSON that violates the schema: "abc" can't coerce to int `value`.
    bad_json = '{"value": "abc"}'
    result = {"parsed": None, "raw": _FakeRaw(content=bad_json), "parsing_error": None}
    with _patched([("dict", result)]):
        raised: Exception | None = None
        try:
            asyncio.run(
                g.generate_structured(
                    system_instruction="sys",
                    contents="content",
                    response_schema=Strict,
                )
            )
        except Exception as exc:  # noqa: BLE001 - capture to assert exact type
            raised = exc
    assert isinstance(raised, ValidationError), (
        f"expected pydantic.ValidationError, got {type(raised).__name__}: {raised}"
    )
    assert getattr(raised, "raw_payload", None) == {"value": "abc"}
    print("  [ok] schema violation -> ValidationError with raw_payload (BUG-10)")


# ── pure helper unit tests ────────────────────────────────────────────────
def test_is_transient_classification():
    assert g._is_transient(asyncio.TimeoutError()) is True
    assert g._is_transient(TimeoutError()) is True
    assert g._is_transient(ConnectionError()) is True
    assert g._is_transient(_status_error(429)) is True
    assert g._is_transient(_status_error(500)) is True
    assert g._is_transient(_status_error(503)) is True
    assert g._is_transient(_status_error(504)) is True
    assert g._is_transient(_status_error(400)) is False
    assert g._is_transient(_status_error(401)) is False
    assert g._is_transient(_status_error(404)) is False
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
    print("AIA-05 LLM resilience tests")
    test_success_first_attempt()
    test_transient_then_success_swaps_to_fallback()
    test_all_transient_exhausts_retries()
    test_timeout_is_bounded_and_retried()
    test_permanent_status_error_fails_fast()
    test_non_status_error_fails_fast()
    test_transient_status_503_is_retried()
    test_retry_count_respects_max_retries()
    test_pinned_model_is_never_swapped()
    test_pinned_gemini_model_ignored_on_non_gemini_provider()
    test_backoff_applied_between_retries()
    test_schema_violation_raises_validation_error_with_raw_payload()
    test_is_transient_classification()
    test_backoff_delay_bounds()
    print("ALL LLM RESILIENCE TESTS PASSED")
