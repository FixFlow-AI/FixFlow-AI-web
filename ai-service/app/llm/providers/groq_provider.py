from ...config import get_settings
from langchain_groq import ChatGroq
from ...llm.providers.base import BaseLLMProvider



class GroqProvider(BaseLLMProvider):
    

    def __init__(self):

        settings = get_settings()
        self.llm = ChatGroq(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
            temperature=0,
            timeout=settings.gemini_timeout_sec,
            max_retries=3,
        )


    def get_llm(self):

        return self.llm