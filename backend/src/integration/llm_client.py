# ============================================================
# FILE: .\backend\src\integration\llm_client.py
# ============================================================

import requests
import urllib3

from src.core.config import Config
from src.core.logger import get_logger
from src.core.exceptions import LLMConnectionError

if not Config.SSL_VERIFY:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class LLMClient:
    """Client for communicating with an OpenAI-compatible LLM API."""

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

        self.api_token = Config.LLM_API_TOKEN
        self.endpoint_url = Config.LLM_ENDPOINT_URL
        self.model_name = Config.LLM_MODEL_NAME
        self.timeout = Config.LLM_TIMEOUT

        if not self.api_token or not self.endpoint_url:
            self.logger.warning("Missing LLM configuration in .env file")

    def generate_response(self, system_prompt, user_prompt, temperature=0.1, max_tokens=8000, force_json=False, chat_history=None):
        """
        Sends a prompt to the LLM and returns the generated text response.

        Args:
            system_prompt: System-level instruction for the model.
            user_prompt: User-level query or data payload.
            temperature: Sampling temperature (lower = more deterministic).
            max_tokens: Maximum tokens in the response.
            force_json: If True, requests JSON-formatted output from the model.

        Returns:
            The generated text content from the LLM response.

        Raises:
            LLMConnectionError: On timeout, HTTP error, or unexpected failure.
        """
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

        messages = [{"role": "system", "content": system_prompt}]

        if chat_history:
            for msg in chat_history:
                if msg.get("role") in ["user", "assistant"]:
                    safe_content = str(msg.get("content", ""))[:800]
                    messages.append({"role": msg["role"], "content": safe_content})

        messages.append({"role": "user", "content": user_prompt})
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        if force_json:
            payload["response_format"] = {"type": "json_object"}

        try:
            self.logger.info(f"Sending request to model: {self.model_name}")
            response = requests.post(
                self.endpoint_url, json=payload, headers=headers,
                verify=Config.SSL_VERIFY, timeout=self.timeout
            )

            if response.status_code == 200:
                self.logger.info("Response received successfully from LLM")
                return response.json()["choices"][0]["message"]["content"]
            else:
                self.logger.error(f"Server returned error {response.status_code}: {response.text[:500]}")
                raise LLMConnectionError(f"Server error: {response.status_code}")

        except requests.exceptions.Timeout:
            self.logger.error(f"Connection timed out after {self.timeout}s")
            raise LLMConnectionError("Connection timeout")
        except LLMConnectionError:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected connection error: {str(e)}")
            raise LLMConnectionError(f"Connection error: {str(e)}")