"""Runtime configuration for the FixFlowAI Python AI service.

All values come from environment variables (loaded from a local ``.env`` in
development). The service is stateless, so this is the only place that reads
process configuration.
"""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Typed accessor over the environment."""

    ALLOWED_MODELS: frozenset[str] = frozenset({
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gemini-3.1-pro",
    })

    DEFAULT_MODEL: str = "gemini-3.5-flash"
    DEFAULT_FALLBACK_MODEL: str = "gemini-3.1-flash-lite"

    def __init__(self) -> None:
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model: str = os.getenv("GEMINI_MODEL", self.DEFAULT_MODEL).strip()
        self.gemini_fallback_model: str = os.getenv(
            "GEMINI_FALLBACK_MODEL",
            self.DEFAULT_FALLBACK_MODEL
        ).strip()
        self.port: int = int(os.getenv("PORT", "8000"))
        self.confidence_threshold: int = int(os.getenv("CONFIDENCE_THRESHOLD", "75"))
        self.max_correction_cycles: int = int(os.getenv("MAX_CORRECTION_CYCLES", "1"))
        self.confidence_min_improvement: int = int(os.getenv("CONFIDENCE_MIN_IMPROVEMENT", "0"))
        self.ai_service_token: str = os.getenv("AI_SERVICE_TOKEN", "").strip()

        # ── GitHub onboarding (roles/01, 01a) ──────────────────────────────
        # Optional server token used when a request doesn't carry the
        # freelancer's OAuth access token (GraphQL requires *some* token).
        self.github_token: str = os.getenv("GITHUB_TOKEN", "").strip()
        # Deterministic fan-out concurrency over repos.
        self.github_scan_concurrency: int = int(os.getenv("GITHUB_SCAN_CONCURRENCY", "6"))
        # Cap deep analysis to the top-N repos by recency + stars + ownership.
        self.scan_top_n_repos: int = int(os.getenv("SCAN_TOP_N_REPOS", "50"))
        # Profile confidence match-ready threshold (mirrors CONFIDENCE_THRESHOLD).
        self.profile_confidence_threshold: int = int(
            os.getenv("PROFILE_CONFIDENCE_THRESHOLD", "75")
        )

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def model_valid(self) -> bool:
        return self.gemini_model in self.ALLOWED_MODELS

    @property
    def fallback_model_valid(self) -> bool:
        return self.gemini_fallback_model in self.ALLOWED_MODELS


@lru_cache
def get_settings() -> Settings:
    return Settings()
