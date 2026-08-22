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

    DEFAULT_MODEL: str = "gemini-3.1-flash-lite"
    PROPOSAL_MODEL: str = "gemini-3.5-flash"
    DEFAULT_FALLBACK_MODEL: str = "gemini-3.1-flash-lite"

    # AIE-09 — Confidence Grid factor weights. The headline index is a weighted
    # blend of the four grounded factors; budget is excluded (weights
    # renormalised) when the brief states no budget. Kept explicit and tunable,
    # mirroring ``opportunity.score_opportunity``'s weight table.
    CONFIDENCE_WEIGHTS: dict[str, float] = {
        "deliverable_coverage": 0.30,
        "timeline_realism": 0.25,
        "technical_feasibility": 0.25,
        "budget_alignment": 0.20,
    }

    def __init__(self) -> None:
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model: str = os.getenv("GEMINI_MODEL", self.DEFAULT_MODEL).strip()
        self.gemini_proposal_model: str = os.getenv("GEMINI_PROPOSAL_MODEL", self.PROPOSAL_MODEL).strip()
        self.gemini_fallback_model: str = os.getenv(
            "GEMINI_FALLBACK_MODEL",
            self.DEFAULT_FALLBACK_MODEL
        ).strip()

        self.gemini_timeout_sec: float = float(os.getenv("GEMINI_TIMEOUT_SEC", "15"))
        # Plan authoring is a single, larger generation than brief parsing, so it
        # gets its own (longer) budget. Requirement 9.5.
        self.gemini_plan_timeout_sec: float = float(os.getenv("GEMINI_PLAN_TIMEOUT_SEC", "20"))
        # Total attempts per model for transient failures (429/5xx/timeout/network).
        self.gemini_max_retries: int = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
        # Exponential backoff bounds (seconds): delay = min(max, base * 2**attempt) + jitter.
        self.gemini_retry_base_delay_sec: float = float(
            os.getenv("GEMINI_RETRY_BASE_DELAY_SEC", "0.5")
        )
        self.gemini_retry_max_delay_sec: float = float(
            os.getenv("GEMINI_RETRY_MAX_DELAY_SEC", "8")
        )
        self.port: int = int(os.getenv("PORT", "8000"))
        self.confidence_threshold: int = int(os.getenv("CONFIDENCE_THRESHOLD", "75"))
        self.max_correction_cycles: int = int(os.getenv("MAX_CORRECTION_CYCLES", "1"))
        # The minimum score delta required for each optimization step to be accepted (per-step threshold)
        self.confidence_min_improvement: int = int(os.getenv("CONFIDENCE_MIN_IMPROVEMENT", "1"))
        # AIE-09 — max points the LLM may nudge a deterministic factor base (±).
        self.confidence_llm_modifier_limit: int = int(
            os.getenv("CONFIDENCE_LLM_MODIFIER_LIMIT", "15")
        )
        self.ai_service_token: str = os.getenv("AI_SERVICE_TOKEN", "").strip()

        # ── GitHub onboarding (roles/01, 01a) ──────────────────────────────
        # Optional server token used when a request doesn't carry the
        # freelancer's OAuth access token (GraphQL requires *some* token).
        self.github_token: str = os.getenv("GITHUB_TOKEN", "").strip()
        # Deterministic fan-out concurrency over repos.
        self.github_scan_concurrency: int = int(os.getenv("GITHUB_SCAN_CONCURRENCY", "6"))
        # Cap deep analysis to the top-N repos by recency + stars + ownership.
        self.scan_top_n_repos: int = int(os.getenv("SCAN_TOP_N_REPOS", "50"))
        # How many top repos get the (costlier) precise lines-authored ownership
        # pass via the REST stats/contributors endpoint. The rest use the
        # reliable GraphQL commit-authorship ratio.
        self.github_stats_top_n: int = int(os.getenv("GITHUB_STATS_TOP_N", "20"))
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


def resolve_model(candidate: str | None) -> str:
    """Validate a candidate model against ALLOWED_MODELS.

    Returns the resolved model string, or raises ValueError if not in allowlist.
    """
    settings = get_settings()
    if candidate is None:
        return settings.gemini_model
    if candidate not in settings.ALLOWED_MODELS:
        raise ValueError(
            f"Model '{candidate}' is not in the allowed list of models: "
            f"{sorted(list(settings.ALLOWED_MODELS))}"
        )
    return candidate
