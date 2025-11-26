"""LiteLLM ModelClient integration."""

import os
from typing import (
    Dict,
    Optional,
    Callable,
    Literal,
    Any,
)

import logging

# optional import
from adalflow.utils.lazy_import import safe_import, OptionalPackages
from openai.types.chat.chat_completion import ChatCompletion

openai = safe_import(OptionalPackages.OPENAI.value[0], OptionalPackages.OPENAI.value[1])

from openai import OpenAI, AsyncOpenAI
from openai.types import Completion

from adalflow.core.model_client import ModelClient
from adalflow.core.types import ModelType

from api.openai_client import (
    get_first_message_content,
    handle_streaming_response,
    parse_stream_response,
)

log = logging.getLogger(__name__)


class LiteLLMClient(ModelClient):
    __doc__ = r"""A component wrapper for the LiteLLM API client.

    LiteLLM provides a unified API that gives access to multiple AI models through a single endpoint.
    The API is compatible with OpenAI's API format.

    Visit https://docs.litellm.ai/ for more details.

    Example:
        ```python
        from api.litellm_client import LiteLLMClient

        client = LiteLLMClient()
        generator = adal.Generator(
            model_client=client,
            model_kwargs={"model": "gpt-4o"}
        )
        ```
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        chat_completion_parser: Callable[[Completion], Any] = None,
        input_type: Literal["text", "messages"] = "text",
        base_url: Optional[str] = None,
        env_base_url_name: str = "LITELLM_BASE_URL",
        env_api_key_name: str = "LITELLM_API_KEY",
    ):
        r"""Initialize the LiteLLM client.

        Args:
            api_key (Optional[str], optional): LiteLLM API key. Defaults to None.
            chat_completion_parser (Callable[[Completion], Any], optional): A function to parse the chat completion into a `str`. Defaults to `None`.
                The default parser is `get_first_message_content`.
            base_url (str): The API base URL to use when initializing the client.
                Defaults to the value from LITELLM_BASE_URL environment variable.
            env_base_url_name (str): The environment variable name for the base URL. Defaults to `"LITELLM_BASE_URL"`.
            env_api_key_name (str): The environment variable name for the API key. Defaults to `"LITELLM_API_KEY"`.
        """
        super().__init__()
        self._api_key = api_key
        self._env_api_key_name = env_api_key_name
        self._env_base_url_name = env_base_url_name

        # Get base URL from environment or use provided one
        if base_url:
            self.base_url = base_url
        else:
            base_url_env = os.getenv(self._env_base_url_name)
            if not base_url_env:
                raise ValueError(
                    f"Environment variable {self._env_base_url_name} must be set"
                )
            self.base_url = base_url_env.rstrip('/')  # Remove trailing slash if present
            # Ensure the base URL ends with /v1 if not already present
            if not self.base_url.endswith('/v1'):
                self.base_url = f"{self.base_url}/v1"

        self.sync_client = self.init_sync_client()
        self.async_client = None  # only initialize if the async call is called
        self.chat_completion_parser = (
            chat_completion_parser or get_first_message_content
        )
        self._input_type = input_type
        self._api_kwargs = {}  # add api kwargs when the LiteLLM Client is called

    def init_sync_client(self):
        """Initialize the synchronous LiteLLM client."""
        api_key = self._api_key or os.getenv(self._env_api_key_name)
        if not api_key:
            raise ValueError(
                f"Environment variable {self._env_api_key_name} must be set"
            )
        return OpenAI(api_key=api_key, base_url=self.base_url)

    def init_async_client(self):
        """Initialize the asynchronous LiteLLM client."""
        api_key = self._api_key or os.getenv(self._env_api_key_name)
        if not api_key:
            raise ValueError(
                f"Environment variable {self._env_api_key_name} must be set"
            )
        return AsyncOpenAI(api_key=api_key, base_url=self.base_url)

    def parse_chat_completion(
        self,
        completion: ChatCompletion,
    ) -> "GeneratorOutput":
        """Parse the completion, and put it into the raw_response."""
        log.debug(f"completion: {completion}, parser: {self.chat_completion_parser}")
        try:
            data = self.chat_completion_parser(completion)
        except Exception as e:
            log.error(f"Error parsing the completion: {e}")
            return GeneratorOutput(data=None, error=str(e), raw_response=completion)

        try:
            usage = self.track_completion_usage(completion)
            return GeneratorOutput(
                data=None, error=None, raw_response=data, usage=usage
            )
        except Exception as e:
            log.error(f"Error tracking the completion usage: {e}")
            return GeneratorOutput(data=None, error=str(e), raw_response=data)

    def track_completion_usage(
        self,
        completion: ChatCompletion,
    ) -> "CompletionUsage":
        """Track the completion usage."""
        from adalflow.core.types import CompletionUsage

        try:
            usage: CompletionUsage = CompletionUsage(
                completion_tokens=completion.usage.completion_tokens,
                prompt_tokens=completion.usage.prompt_tokens,
                total_tokens=completion.usage.total_tokens,
            )
            return usage
        except Exception as e:
            log.error(f"Error tracking the completion usage: {e}")
            return CompletionUsage(
                completion_tokens=None, prompt_tokens=None, total_tokens=None
            )

    def convert_inputs_to_api_kwargs(
        self,
        input: Optional[Any] = None,
        model_kwargs: Dict = {},
        model_type: ModelType = ModelType.UNDEFINED,
    ) -> Dict:
        r"""
        Convert the Component's standard input and model_kwargs into API-specific format.
        Since LiteLLM is OpenAI-compatible, we use the same format as OpenAI.

        Args:
            input: The input text or messages to process
            model_kwargs: Additional parameters
            model_type: The type of model (EMBEDDER or LLM)

        Returns:
            Dict: API-specific kwargs for the model call
        """
        # Import OpenAIClient to reuse its conversion logic
        from api.openai_client import OpenAIClient

        # Create a temporary OpenAIClient instance to reuse its conversion logic
        temp_client = OpenAIClient(
            input_type=self._input_type,
            base_url=self.base_url,
            env_api_key_name=self._env_api_key_name,
        )
        return temp_client.convert_inputs_to_api_kwargs(
            input=input, model_kwargs=model_kwargs, model_type=model_type
        )

    def _call(self, api_kwargs: Dict = None, model_type: ModelType = None) -> Any:
        """Make a synchronous call to the LiteLLM API."""
        if not self.sync_client:
            self.sync_client = self.init_sync_client()

        api_kwargs = api_kwargs or {}

        if model_type == ModelType.LLM:
            # Use OpenAI-compatible chat completions endpoint
            completion = self.sync_client.chat.completions.create(**api_kwargs)
            return self.parse_chat_completion(completion)
        elif model_type == ModelType.EMBEDDER:
            # Use OpenAI-compatible embeddings endpoint
            response = self.sync_client.embeddings.create(**api_kwargs)
            from api.openai_client import OpenAIClient
            temp_client = OpenAIClient()
            return temp_client.parse_embedding_response(response)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

    async def _acall(self, api_kwargs: Dict = None, model_type: ModelType = None) -> Any:
        """Make an asynchronous call to the LiteLLM API."""
        if not self.async_client:
            self.async_client = self.init_async_client()

        api_kwargs = api_kwargs or {}

        if model_type == ModelType.LLM:
            # Check if streaming is requested
            stream = api_kwargs.get("stream", False)

            if stream:
                # Handle streaming response
                stream_response = await self.async_client.chat.completions.create(**api_kwargs)

                async def stream_generator():
                    async for chunk in stream_response:
                        parsed_content = parse_stream_response(chunk)
                        if parsed_content:
                            yield parsed_content

                return stream_generator()
            else:
                # Non-streaming response
                completion = await self.async_client.chat.completions.create(**api_kwargs)
                return self.parse_chat_completion(completion)
        elif model_type == ModelType.EMBEDDER:
            # Use OpenAI-compatible embeddings endpoint
            response = await self.async_client.embeddings.create(**api_kwargs)
            from api.openai_client import OpenAIClient
            temp_client = OpenAIClient()
            return temp_client.parse_embedding_response(response)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

