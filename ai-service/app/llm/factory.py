from ..llm.providers.groq_provider import GroqProvider
from ..llm.providers.gemini_provider import GeminiProvider




class LLMFactory:


    @staticmethod
    def create(provider:str):

        providers = {
            "groq" : GroqProvider,
            "gemini": GeminiProvider
        }

        if provider not in providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        return providers.get(provider)().get_llm()