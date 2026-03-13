# rag_kb_compatibility.py

# alternative RAG engine using an external KB API
# only when KB_ENDPOINT_URL configured

import requests
import urllib3

from src.core.config import Config
from src.core.logger import get_logger
from src.core.exceptions import DataProcessingError

if not Config.SSL_VERIFY:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class KBRAGEngine:
    """RAG engine that retrieves historical context from an external KB API."""

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

        self.kb_endpoint = Config.KB_ENDPOINT_URL
        self.kb_token = Config.KB_API_TOKEN
        self.model_name = Config.LLM_MODEL_NAME
        self.timeout = Config.LLM_TIMEOUT
        self.app_name = Config.KB_APP_NAME

    def get_historical_context(self, lang="pl"):
        """
        Queries the external Knowledge Base for historical decision context.

        Args:
            lang: Target language for the query and response ('pl' or 'en')

        Returns:
            LLM-generated historical context string from the KB.

        Raises:
            DataProcessingError: On timeout, HTTP error, or connection failure.
        """
        self.logger.info(f"Requesting historical context from KB (lang: {lang})")

        if not self.kb_endpoint or not self.kb_token:
            self.logger.warning("Missing Knowledge Base credentials, returning default message")
            return "brak danych historycznych" if lang == "pl" else "no historical data"

        system_context = """- You are an expert QA Analyst and Release Manager.
- Analyze the input query and extract hard decision rules strictly based on the retrieved context.
- If no relevant context is available, state clearly: "Brak wystarczajacych danych historycznych / I don't have enough information."
- You must not rely on general knowledge. Use only specific rules from the context.
- Your answers must remain strictly within the boundaries of the available context.
- IMPORTANT: Always respond in the exact same language as the user's Query.
- Do not include the phrase 'Based on the provided context' in your response.

Context:
{context}

Chat_Conversations:
{chat_history}

Query:
{query}
"""

        if lang == "pl":
            user_prompt = "Wypunktuj krotko 3 glowne zasady decydujace o przyznaniu statusu GO lub NO-GO (wymogi procentowe i bledy)."
        else:
            user_prompt = "Briefly list 3 main rules for granting GO or NO-GO status (percentage requirements and bugs)."

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.kb_token}",
            "X-SA-NAME": self.app_name,
            "X-ENABLE-CITATIONS": "false"
        }

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_context},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 1000,
            "temperature": 0.1,
            "top_p": 0.1,
            "presence_penalty": 0,
            "frequency_penalty": 0
        }

        try:
            self.logger.info("Sending request to KB RAG coordinator endpoint")
            response = requests.post(
                self.kb_endpoint, json=payload, headers=headers,
                verify=Config.SSL_VERIFY, timeout=self.timeout
            )

            if response.status_code == 200:
                self.logger.info("Received RAG context successfully from Knowledge Base")
                return response.json()["choices"][0]["message"]["content"]
            else:
                self.logger.error(f"Knowledge Base returned error {response.status_code}: {response.text[:500]}")
                raise DataProcessingError(f"KB API error: {response.status_code}")

        except requests.exceptions.Timeout:
            self.logger.error(f"Connection to KB timed out after {self.timeout}s")
            raise DataProcessingError("KB connection timeout")
        except DataProcessingError:
            raise
        except Exception as e:
            self.logger.error(f"Failed to connect to Knowledge Base: {str(e)}")
            raise DataProcessingError(f"Failed to fetch RAG context: {str(e)}")