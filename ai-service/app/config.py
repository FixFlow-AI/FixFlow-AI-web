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

    # Groq defaults (provider-neutral resilience wraps around these).
    GROQ_DEFAULT_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_DEFAULT_FALLBACK_MODEL: str = "llama-3.1-8b-instant"

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
        # ── Provider API keys ──────────────────────────────────────────────
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()

        # Active LLM provider ("gemini" | "groq" | ...). Switching providers is
        # a single env change; the factory (app.llm.factory) resolves the
        # concrete LangChain client, so no feature code needs to change.
        self.llm_provider: str = os.getenv("LLM_PROVIDER", "groq").strip().lower()

        # ── Per-provider model configuration ───────────────────────────────
        # Gemini
        self.gemini_model: str = os.getenv("GEMINI_MODEL", self.DEFAULT_MODEL).strip()
        self.gemini_proposal_model: str = os.getenv("GEMINI_PROPOSAL_MODEL", self.PROPOSAL_MODEL).strip()
        self.gemini_fallback_model: str = os.getenv(
            "GEMINI_FALLBACK_MODEL",
            self.DEFAULT_FALLBACK_MODEL
        ).strip()
        # Groq
        self.groq_model: str = os.getenv("GROQ_MODEL", self.GROQ_DEFAULT_MODEL).strip()
        self.groq_fallback_model: str = os.getenv(
            "GROQ_FALLBACK_MODEL",
            self.GROQ_DEFAULT_FALLBACK_MODEL
        ).strip()

        # ── Provider-agnostic resilience knobs ─────────────────────────────
        # Provider-neutral names; legacy GEMINI_* env vars are still honored so
        # existing deployments keep working without a config change.
        self.llm_timeout_sec: float = float(
            os.getenv("LLM_TIMEOUT_SEC", os.getenv("GEMINI_TIMEOUT_SEC", "15"))
        )
        # Total attempts per model for transient failures (429/5xx/timeout/network).
        self.llm_max_retries: int = int(
            os.getenv("LLM_MAX_RETRIES", os.getenv("GEMINI_MAX_RETRIES", "3"))
        )
        # Exponential backoff bounds (seconds): delay = min(max, base * 2**attempt) + jitter.
        self.llm_retry_base_delay_sec: float = float(
            os.getenv("LLM_RETRY_BASE_DELAY_SEC", os.getenv("GEMINI_RETRY_BASE_DELAY_SEC", "0.5"))
        )
        self.llm_retry_max_delay_sec: float = float(
            os.getenv("LLM_RETRY_MAX_DELAY_SEC", os.getenv("GEMINI_RETRY_MAX_DELAY_SEC", "8"))
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

    # ── Provider-agnostic accessors ───────────────────────────────────────
    # These read the live instance attributes (so tests that mutate a key/model
    # still see the change) and map the active provider name to its config.

    def _provider_api_key(self, provider: str) -> str:
        return {
            "gemini": self.gemini_api_key,
            "groq": self.groq_api_key,
        }.get(provider, "")

    def provider_default_model(self, provider: str) -> str:
        return {
            "gemini": self.gemini_model,
            "groq": self.groq_model,
        }.get(provider, "")

    def provider_fallback_model(self, provider: str) -> str | None:
        fb = {
            "gemini": self.gemini_fallback_model,
            "groq": self.groq_fallback_model,
        }.get(provider)
        default = self.provider_default_model(provider)
        # A fallback equal to the default (or empty) means "no distinct fallback";
        # such providers simply retry the same model on transient failures.
        return fb if (fb and fb != default) else None

    def provider_allowed_models(self, provider: str) -> frozenset[str] | None:
        # Only Gemini enforces a strict allowlist. Providers without one accept
        # their own configured models (see resolve_provider_model for how a
        # caller-pinned model is validated loosely against known models).
        return {"gemini": self.ALLOWED_MODELS}.get(provider)

    def provider_proposal_model(self, provider: str) -> str:
        # The higher-quality model used for flagship proposal generation. Only
        # Gemini declares a distinct one; other providers reuse their default.
        return {
            "gemini": self.gemini_proposal_model,
        }.get(provider, self.provider_default_model(provider))

    @property
    def active_model(self) -> str:
        return self.provider_default_model(self.llm_provider)

    @property
    def active_fallback_model(self) -> str | None:
        return self.provider_fallback_model(self.llm_provider)

    @property
    def proposal_model(self) -> str:
        return self.provider_proposal_model(self.llm_provider)

    @property
    def ai_enabled(self) -> bool:
        return bool(self._provider_api_key(self.llm_provider))

    @property
    def active_model_valid(self) -> bool:
        allowed = self.provider_allowed_models(self.llm_provider)
        return allowed is None or self.active_model in allowed

    @property
    def active_fallback_model_valid(self) -> bool:
        fb = self.active_fallback_model
        if fb is None:
            return True
        allowed = self.provider_allowed_models(self.llm_provider)
        return allowed is None or fb in allowed

    # ── Backward-compatible Gemini-specific views (kept for callers/tests) ──
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
    """Validate a candidate model against Gemini's ALLOWED_MODELS.

    Returns the resolved model string, or raises ValueError if not in allowlist.
    Kept for backward compatibility (Gemini-specific). For provider-agnostic
    resolution use :func:`resolve_provider_model`.
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


def resolve_provider_model(provider: str, candidate: str | None) -> str:
    """Resolve the model to use for ``provider``, honoring a caller override.

    - ``candidate is None`` -> the provider's configured default model.
    - Providers WITH an allowlist (Gemini): the candidate is used only if it is
      in the allowlist, otherwise the default is used.
    - Providers WITHOUT an allowlist: the candidate is honored only if it is a
      known model for that provider (its default or fallback); otherwise the
      default is used.

    The "known model" guard prevents a Gemini-specific model name pinned by a
    caller from leaking to, say, Groq (which would 404 with model_not_found).
    Resolution never raises — an unusable override degrades to the default.
    """
    settings = get_settings()
    default = settings.provider_default_model(provider)
    if candidate is None:
        return default
    allowed = settings.provider_allowed_models(provider)
    if allowed is not None:
        return candidate if candidate in allowed else default
    known = {default, settings.provider_fallback_model(provider)}
    known.discard(None)
    return candidate if candidate in known else default
