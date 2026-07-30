from ...config import get_settings
from ...llm.providers.base import BaseLLMProvider
from langchain_google_genai import ChatGoogleGenerativeAI


class GeminiProvider(BaseLLMProvider):
    """LangChain-backed Google Gemini provider.

    ``model`` and ``temperature`` are optional overrides; when omitted they fall
    back to the configured defaults. This lets callers pin a specific model
    (e.g. the proposal model) or nudge temperature per call without bypassing
    the provider abstraction.
    """

    def __init__(self, model: str | None = None, temperature: float = 0.0):

        settings = get_settings()
        self.llm = ChatGoogleGenerativeAI(
            api_key=settings.gemini_api_key,
            model=model or settings.gemini_model,
            temperature=temperature,
            timeout=settings.llm_timeout_sec,
            # Retries/backoff are owned by the app-level loop in ``client.py``
            # (circuit breaker + telemetry + model fallback); disable the
            # LangChain-internal retry so attempts aren't multiplied.
            max_retries=3,
        )


    def get_llm(self):

        return self.llm
