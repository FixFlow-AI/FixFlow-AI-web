"""Async wrapper around the google-genai SDK.

Centralizes client construction and the structured-output call so every feature
uses the same pattern: system instruction + temperature + a Pydantic
``response_schema`` that Gemini is constrained to. The parsed Pydantic instance
is returned directly.
"""
from __future__ import annotations

from typing import Type, TypeVar

from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel

from ..config import get_settings

T = TypeVar("T", bound=BaseModel)

_client: genai.Client | None = None


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
    primary_model = model or settings.gemini_model
    config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                response_mime_type="application/json",
                response_schema=response_schema,
            )

    try:
        response = await client.aio.models.generate_content(
            model=primary_model,
            contents=contents,
            config=config,
        )
    except APIError as e:
        if (
            e.code in (429, 500, 502, 503, 504)
            and model is None
            and primary_model != settings.gemini_fallback_model
        ):
            response = await client.aio.models.generate_content(
                model=settings.gemini_fallback_model,
                contents=contents,
                config=config,
            )
        else:
            raise

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, response_schema):
        return parsed

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise ValueError("LLM response returned empty text.")
    # Fall back to manual validation if the SDK did not populate `.parsed`.
    return response_schema.model_validate_json(text)
