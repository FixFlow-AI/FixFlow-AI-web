from ..llm.provider.base import BaseLLMProvider
from langchain_google_genai import ChatGoogleGenerativeAI



class GeminiProvider(BaseLLMProvider):
    

    def __init__(self):

        self.llm = ChatGoogleGenerativeAI(
            api_key=None,
            model=None,
            temperature=0,
            timeout=None,
            max_retries=3,
        )


    def get_llm(self):

        return self.llm