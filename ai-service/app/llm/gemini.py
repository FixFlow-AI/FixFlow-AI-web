"""Async wrapper around the google-genai SDK.

Centralizes client construction and the structured-output call so every feature
uses the same pattern: system instruction + temperature + a Pydantic
``response_schema`` that Gemini is constrained to. The parsed Pydantic instance
is returned directly.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Type, TypeVar

from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel

from ..config import get_settings, resolve_model
from ..telemetry import get_request_id, record_call
from .cache import get_cached_response, set_cached_response
from .circuit_breaker import primary_breaker

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_client: genai.Client | None = None

# HTTP status codes that indicate a recoverable, transient condition worth
# retrying: rate-limit (429) and the 5xx server/gateway family.
_TRANSIENT_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


def _is_transient(exc: BaseException) -> bool:
    """Classify an exception as transient (retryable) vs permanent (fail fast).

    Transient: per-call timeouts, low-level connection errors, and ``APIError``
    responses carrying a 429/5xx status. Everything else (invalid key, invalid
    model, 4xx schema errors, validation failures) is permanent.
    """
    if isinstance(exc, (asyncio.TimeoutError, ConnectionError, TimeoutError)):
        return True
    if isinstance(exc, APIError):
        return getattr(exc, "code", None) in _TRANSIENT_STATUS_CODES
    return False


def _backoff_delay(attempt: int, base_delay: float, max_delay: float) -> float:
    """Exponential backoff with full-ish jitter: min(max, base*2**attempt)+jitter.

    ``attempt`` is 0-indexed (0 for the first retry). Jitter is drawn from
    ``[0, base_delay)`` to de-correlate retries across concurrent callers.
    """
    capped = min(max_delay, base_delay * (2 ** attempt))
    return capped + random.uniform(0.0, base_delay)


def get_client() -> genai.Client:
    """Module-scoped client (reused across requests)."""
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured.")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


async def generate_structured(
    *,
    system_instruction: str,
    contents: str,
    response_schema: Type[T],
    temperature: float = 0.2,
    model: str | None = None,
) -> T:
    """Call Gemini with a JSON response constrained to ``response_schema``.

    Returns the parsed Pydantic model. Raises on empty/invalid output so callers
    can apply their own fallback behavior.
    """
    settings = get_settings()
    client = get_client()
    primary_model = resolve_model(model)

    cached_val = await get_cached_response(system_instruction, contents, response_schema)
    if cached_val is not None:
        return cached_val
    config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                response_mime_type="application/json",
                response_schema=response_schema,
            )

    async def _call(model_name: str):
        # Enforce a per-call timeout so a hung Gemini request can never block
        # the handler indefinitely. ``asyncio.wait_for`` cancels the underlying
        # request on timeout and raises ``asyncio.TimeoutError`` (transient).
        return await asyncio.wait_for(
            client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            ),
            timeout=settings.gemini_timeout_sec,
        )

    # Fallback swapping is only eligible when the caller didn't pin a specific
    # model and a distinct fallback model is configured.
    fallback_eligible = (
        model is None and primary_model != settings.gemini_fallback_model
    )

    # Single bounded retry loop with exponential backoff + jitter. The first
    # attempt targets the primary model; once it fails transiently, every
    # Bounded retry loop with circuit breaker integration (AIA-07)
    attempts = max(1, settings.gemini_max_retries)
    response = None
    
    use_fallback_directly = not primary_breaker.is_allowed()
    if use_fallback_directly:
        logger.warning(
            "[%s] Primary model circuit breaker is OPEN. Routing directly to fallback model: %s",
            get_request_id(),
            settings.gemini_fallback_model,
        )

    for attempt in range(attempts):
        if use_fallback_directly or (attempt > 0 and fallback_eligible):
            target_model = settings.gemini_fallback_model
        else:
            target_model = primary_model

        logger.info(
            "[%s] Calling Gemini model %s (Attempt %d/%d)",
            get_request_id(),
            target_model,
            attempt + 1,
            attempts,
        )
        start_time = time.perf_counter()
        try:
            response = await _call(target_model)
            latency = time.perf_counter() - start_time
            
            # Extract tokens safely
            usage = getattr(response, "usage_metadata", None)
            input_tokens = getattr(usage, "prompt_token_count", 0) or 0
            output_tokens = getattr(usage, "candidates_token_count", 0) or 0
            
            record_call(latency, input_tokens, output_tokens, success=True)
            logger.info(
                "[%s] Gemini call succeeded. Latency: %.4f sec. Input tokens: %d. Output tokens: %d.",
                get_request_id(),
                latency,
                input_tokens,
                output_tokens,
            )
            
            # Record success on the breaker if we called the primary model
            if target_model == primary_model:
                primary_breaker.record_success()
                
            break
        except Exception as exc:  # noqa: BLE001 - re-raised unless transient
            latency = time.perf_counter() - start_time
            record_call(latency, 0, 0, success=False)
            logger.warning(
                "[%s] Gemini call failed on attempt %d: %s",
                get_request_id(),
                attempt + 1,
                str(exc),
            )
            
            # Record failure on the breaker if we called the primary model
            if target_model == primary_model:
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

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, response_schema):
        await set_cached_response(system_instruction, contents, response_schema, parsed)
        return parsed

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise ValueError("LLM response returned empty text.")
    # Fall back to manual validation if the SDK did not populate `.parsed`.
    try:
        validated = response_schema.model_validate_json(text)
        await set_cached_response(system_instruction, contents, response_schema, validated)
        return validated
    except ValidationError as e:
        import json
        try:
            raw_payload = json.loads(text)
        except Exception:
            raw_payload = {}
        # Attach the raw dictionary payload to the exception for fallback recovery
        setattr(e, "raw_payload", raw_payload)
        raise e
