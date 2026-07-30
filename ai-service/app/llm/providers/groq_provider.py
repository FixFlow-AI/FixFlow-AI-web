from ...config import get_settings
from langchain_groq import ChatGroq
from ...llm.providers.base import BaseLLMProvider



class GroqProvider(BaseLLMProvider):
    """LangChain-backed Groq provider.

    ``model`` and ``temperature`` are optional overrides; when omitted they fall
    back to the configured Groq defaults.
    """

    def __init__(self, model: str | None = None, temperature: float = 0.0):

        settings = get_settings()
        self.llm = ChatGroq(
            api_key=settings.groq_api_key,
            model=model or settings.groq_model,
            temperature=temperature,
            timeout=settings.llm_timeout_sec,
            # Retries/backoff are owned by the app-level loop in ``client.py``.
            max_retries=3,
        )


    def get_llm(self):

        return self.llm
