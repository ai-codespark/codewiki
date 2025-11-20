"""LiteLLM ModelClient integration."""

import os
import logging
from typing import Optional, Callable, List

from api.openai_client import OpenAIClient

logger = logging.getLogger(__name__)


def get_first_message_content(completion) -> str:
    """Get the content of the first message in the completion."""
    return completion.choices[0].message.content


class LiteLLMClient(OpenAIClient):
    """
    LiteLLM client that extends OpenAIClient to use LiteLLM-specific environment variables.

    This client is designed to work with LiteLLM proxy servers that provide OpenAI-compatible APIs.
    It uses LITELLM_BASE_URL and LITELLM_API_KEY environment variables by default.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        chat_completion_parser: Callable = None,
        input_type: str = "text",
        base_url: Optional[str] = None,
    ):
        """
        Initialize LiteLLM client with LiteLLM-specific environment variables.

        Args:
            api_key (Optional[str], optional): LiteLLM API key. Defaults to None (will use LITELLM_API_KEY env var).
            chat_completion_parser (Callable, optional): Parser function for chat completions. Defaults to None.
            input_type (str, optional): Input type ('text' or 'messages'). Defaults to "text".
            base_url (Optional[str], optional): LiteLLM base URL. Defaults to None (will use LITELLM_BASE_URL env var).
        """
        super().__init__(
            api_key=api_key,
            chat_completion_parser=chat_completion_parser,
            input_type=input_type,
            base_url=base_url,
            env_base_url_name="LITELLM_BASE_URL",
            env_api_key_name="LITELLM_API_KEY",
        )

    def init_sync_client(self):
        """Initialize the synchronous OpenAI client with LiteLLM environment variables."""
        # Use LiteLLM environment variables as fallback if not provided
        api_key = self._api_key or os.getenv(self._env_api_key_name)
        if not api_key:
            raise ValueError(
                f"Environment variable {self._env_api_key_name} must be set"
            )

        # Import OpenAI here to avoid circular imports
        from openai import OpenAI

        return OpenAI(api_key=api_key, base_url=self.base_url)

    def list_models(self):
        """
        List available models from the LiteLLM server.

        Returns:
            List of model IDs available from the LiteLLM server
        """
        try:
            client = self.init_sync_client()
            models = client.models.list()
            return [model.id for model in models.data]
        except Exception as e:
            logger.error(f"Failed to list models from LiteLLM: {e}")
            return []