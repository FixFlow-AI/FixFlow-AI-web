"""Async structured-output entry point for the AI service.

Historically this module talked to the ``google-genai`` SDK directly, which
tightly coupled every feature to Gemini. It now delegates client construction
to :class:`app.llm.factory.LLMFactory`, so the active LLM (Gemini, Groq, …) is a
single configuration switch (``LLM_PROVIDER``) and no feature code changes.

The public contract is unchanged: every feature calls
:func:`generate_structured` with a system instruction, the user contents, and a
Pydantic ``response_schema`` the model is constrained to. The parsed Pydantic
instance is returned directly. Caching, the circuit breaker, bounded retries
with exponential backoff, telemetry, and a same-provider model fallback are all
preserved around the provider-agnostic call.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from ..config import get_settings, resolve_model
from ..telemetry import get_request_id, record_call
from .cache import get_cached_response, set_cached_response
from .circuit_breaker import primary_breaker
from .factory import LLMFactory

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# HTTP status codes that indicate a recoverable, transient condition worth
# retrying: rate-limit (429) and the 5xx server/gateway family.
_TRANSIENT_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


def _is_transient(exc: BaseException) -> bool:
    """Classify an exception as transient (retryable) vs permanent (fail fast).

    Transient: per-call timeouts, low-level connection errors, and provider
    errors carrying a 429/5xx status code (surfaced by LangChain integrations as
    ``status_code`` or ``code``). Everything else (invalid key, invalid model,
    4xx schema errors, validation failures) is permanent.
    """
    if isinstance(exc, (asyncio.TimeoutError, ConnectionError, TimeoutError)):
        return True
    # LangChain wraps provider SDK errors; the transient ones expose an HTTP
    # status via ``status_code`` (openai/groq style) or ``code`` (google style).
    for attr in ("status_code", "code"):
        val = getattr(exc, attr, None)
        if isinstance(val, int) and val in _TRANSIENT_STATUS_CODES:
            return True
    return False


def _backoff_delay(attempt: int, base_delay: float, max_delay: float) -> float:
    """Exponential backoff with full-ish jitter: min(max, base*2**attempt)+jitter.

    ``attempt`` is 0-indexed (0 for the first retry). Jitter is drawn from
    ``[0, base_delay)`` to de-correlate retries across concurrent callers.
    """
    capped = min(max_delay, base_delay * (2 ** attempt))
    return capped + random.uniform(0.0, base_delay)


def _build_llm(provider: str, model: str | None, temperature: float):
    """Resolve a concrete LangChain chat model via the provider factory."""
    return LLMFactory.create(provider, model=model, temperature=temperature)


async def generate_structured(
    *,
    system_instruction: str,
    contents: str,
    response_schema: Type[T],
    temperature: float = 0.2,
    model: str | None = None,
) -> T:
    """Call the active LLM with output constrained to ``response_schema``.

    Returns the parsed Pydantic model. Raises on empty/invalid output so callers
    can apply their own fallback behavior.
    """
    settings = get_settings()
    provider = settings.llm_provider

    cached_val = await get_cached_response(system_instruction, contents, response_schema)
    if cached_val is not None:
        return cached_val

    messages = [
        SystemMessage(content=system_instruction),
        HumanMessage(content=contents),
    ]

    # Model selection differs per provider. Gemini enforces the allowlist and
    # supports a same-provider fallback model; other providers use their
    # configured default and are never swapped.
    is_gemini = provider == "gemini"
    if is_gemini:
        primary_model = resolve_model(model)
        fallback_model = settings.gemini_fallback_model
        fallback_eligible = model is None and primary_model != fallback_model
    else:
        primary_model = model  # None => provider default (e.g. groq_model)
        fallback_model = None
        fallback_eligible = False

    async def _call(target_model: str | None):
        llm = _build_llm(provider, target_model, temperature)
        structured = llm.with_structured_output(response_schema, include_raw=True)
        # Enforce a per-call timeout so a hung request can never block the
        # handler indefinitely. ``asyncio.wait_for`` cancels the underlying
        # request on timeout and raises ``asyncio.TimeoutError`` (transient).
        return await asyncio.wait_for(
            structured.ainvoke(messages),
            timeout=settings.gemini_timeout_sec,
        )

    # If the primary circuit breaker is open, route straight to the fallback
    # model (Gemini only) instead of hammering a known-bad primary.
    use_fallback_directly = is_gemini and fallback_eligible and not primary_breaker.is_allowed()
    if use_fallback_directly:
        logger.warning(
            "[%s] Primary model circuit breaker is OPEN. Routing directly to fallback model: %s",
            get_request_id(),
            fallback_model,
        )

    attempts = max(1, settings.gemini_max_retries)
    result = None

    for attempt in range(attempts):
        if is_gemini and (use_fallback_directly or (attempt > 0 and fallback_eligible)):
            target_model = fallback_model
        else:
            target_model = primary_model
        is_primary_target = target_model == primary_model

        logger.info(
            "[%s] Calling %s model %s (Attempt %d/%d)",
            get_request_id(),
            provider,
            target_model,
            attempt + 1,
            attempts,
        )
        start_time = time.perf_counter()
        try:
            result = await _call(target_model)
        except Exception as exc:  # noqa: BLE001 - re-raised unless transient
            latency = time.perf_counter() - start_time
            record_call(latency, 0, 0, success=False)
            logger.warning(
                "[%s] LLM call failed on attempt %d: %s",
                get_request_id(),
                attempt + 1,
                str(exc),
            )
            if is_primary_target:
                primary_breaker.record_failure()

            if not _is_transient(exc) or attempt == attempts - 1:
                raise
            await asyncio.sleep(
                _backoff_delay(
                    attempt,
                    settings.gemini_retry_base_delay_sec,
                    settings.gemini_retry_max_delay_sec,
                )
            )
            continue

        # Network-level success: record telemetry + breaker state, then validate.
        latency = time.perf_counter() - start_time
        raw = result.get("raw") if isinstance(result, dict) else None
        usage = getattr(raw, "usage_metadata", None) or {}
        input_tokens = usage.get("input_tokens", 0) or 0
        output_tokens = usage.get("output_tokens", 0) or 0
        record_call(latency, input_tokens, output_tokens, success=True)
        logger.info(
            "[%s] LLM call succeeded. Latency: %.4f sec. Input tokens: %d. Output tokens: %d.",
            get_request_id(),
            latency,
            input_tokens,
            output_tokens,
        )
        if is_primary_target:
            primary_breaker.record_success()
        break

    # ── validate structured output ─────────────────────────────────────────
    # ``with_structured_output(include_raw=True)`` yields a dict with ``parsed``,
    # ``raw`` and ``parsing_error``. A populated ``parsed`` is the happy path.
    parsed = result.get("parsed") if isinstance(result, dict) else result
    parsing_error = result.get("parsing_error") if isinstance(result, dict) else None
    raw = result.get("raw") if isinstance(result, dict) else result

    if isinstance(parsed, response_schema):
        await set_cached_response(system_instruction, contents, response_schema, parsed)
        return parsed

    text = _raw_text(raw)

    # Fall back to manual validation if structured parsing did not populate
    # ``parsed`` but the model still returned JSON text. A schema violation here
    # is permanent (never retried) and re-raised with the raw JSON payload
    # attached for caller-side fallback recovery.
    if text:
        try:
            validated = response_schema.model_validate_json(text)
            await set_cached_response(system_instruction, contents, response_schema, validated)
            return validated
        except ValidationError as e:
            try:
                raw_payload = json.loads(text)
            except Exception:
                raw_payload = {}
            setattr(e, "raw_payload", raw_payload)
            raise e

    if isinstance(parsing_error, BaseException):
        raise parsing_error

    raise ValueError("LLM response returned empty text.")


def _raw_text(raw) -> str:
    """Best-effort extraction of raw text content from a LangChain message."""
    content = getattr(raw, "content", raw)
    if isinstance(content, str):
        return content.strip()
    return str(content or "").strip()
