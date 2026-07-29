from ..llm.providers.groq_provider import GroqProvider
from ..llm.providers.gemini_provider import GeminiProvider




class LLMFactory:


    @staticmethod
    def create(provider: str, model: str | None = None, temperature: float = 0.0):

        providers = {
            "groq": GroqProvider,
            "gemini": GeminiProvider,
        }

        if provider not in providers:
            raise ValueError(f"Unsupported provider: {provider}")

        return providers[provider](model=model, temperature=temperature).get_llm()
