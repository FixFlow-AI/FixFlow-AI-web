from langchain_groq import ChatGroq
from ..llm.provider.base import BaseLLMProvider



class GroqProvider(BaseLLMProvider):
    

    def __init__(self):
        
        self.llm = ChatGroq(
            api_key=None,
            model=None,
            temperature=temperature,
            timeout=None,
            max_retries=3,
        )


    def get_llm(self):

        return self.llm