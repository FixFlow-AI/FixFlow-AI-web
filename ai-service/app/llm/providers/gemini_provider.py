from ...config import get_settings
from ...llm.providers.base import BaseLLMProvider
from langchain_google_genai import ChatGoogleGenerativeAI


class GeminiProvider(BaseLLMProvider):
    

    def __init__(self):

        settings = get_settings()
        self.llm = ChatGoogleGenerativeAI(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
            temperature=0,
            timeout=settings.gemini_timeout_sec,
            max_retries=3,
        )


    def get_llm(self):

        return self.llm