import adalflow as adal

from api.config import configs, get_embedder_type, get_embedder_config, EMBEDDER_TYPE


def get_embedder(is_local_ollama: bool = False, use_google_embedder: bool = False, embedder_type: str = None) -> adal.Embedder:
    """Get embedder based on configuration or parameters.

    Args:
        is_local_ollama: Legacy parameter for Ollama embedder
        use_google_embedder: Legacy parameter for Google embedder
        embedder_type: Direct specification of embedder type ('ollama', 'google', 'openai', 'litellm')
                      Note: If None or matches current EMBEDDER_TYPE, will use get_embedder_config()
                      which respects DEEPWIKI_EMBEDDER_TYPE including model name override (e.g., "litellm/model_name")

    Returns:
        adal.Embedder: Configured embedder instance

    Raises:
        ValueError: If embedder is not configured and no embedder_type is provided
    """
    # Determine which embedder config to use
    current_embedder_type = get_embedder_type()

    # If embedder_type is None or matches the current configuration, use get_embedder_config()
    # to respect DEEPWIKI_EMBEDDER_TYPE including model name override
    if embedder_type is None or embedder_type == current_embedder_type:
        if is_local_ollama:
            embedder_config = configs.get("embedder_ollama")
            if not embedder_config:
                raise ValueError("Ollama embedder not configured in embedder.json")
        elif use_google_embedder:
            embedder_config = configs.get("embedder_google")
            if not embedder_config:
                raise ValueError("Google embedder not configured in embedder.json")
        else:
            # Use get_embedder_config() to respect DEEPWIKI_EMBEDDER_TYPE including model override
            embedder_config = get_embedder_config()
            if embedder_config is None:
                raise ValueError("Embedder not configured. Please set DEEPWIKI_EMBEDDER_TYPE environment variable or provide embedder_type parameter.")
    elif embedder_type == 'ollama':
        embedder_config = configs.get("embedder_ollama")
        if not embedder_config:
            raise ValueError("Ollama embedder not configured in embedder.json")
    elif embedder_type == 'google':
        embedder_config = configs.get("embedder_google")
        if not embedder_config:
            raise ValueError("Google embedder not configured in embedder.json")
    elif embedder_type == 'litellm':
        embedder_config = configs.get("embedder_litellm", configs.get("embedder"))
        if not embedder_config:
            raise ValueError("LiteLLM embedder not configured in embedder.json")
    else:  # default to openai
        embedder_config = configs.get("embedder")
        if not embedder_config:
            raise ValueError("OpenAI embedder not configured in embedder.json")

    # --- Initialize Embedder ---
    if "model_client" not in embedder_config:
        raise ValueError(f"Embedder config missing 'model_client' for type: {embedder_type or current_embedder_type}")

    model_client_class = embedder_config["model_client"]
    if "initialize_kwargs" in embedder_config:
        model_client = model_client_class(**embedder_config["initialize_kwargs"])
    else:
        model_client = model_client_class()

    # Create embedder with basic parameters
    if "model_kwargs" not in embedder_config:
        raise ValueError(f"Embedder config missing 'model_kwargs' for type: {embedder_type or current_embedder_type}")

    embedder_kwargs = {"model_client": model_client, "model_kwargs": embedder_config["model_kwargs"]}

    # Log the model being used for debugging
    model_name = embedder_config.get("model_kwargs", {}).get("model", "unknown")
    embedder_type_used = embedder_type if embedder_type else current_embedder_type
    import logging
    log = logging.getLogger(__name__)
    log.info(f"Initializing embedder - type: {embedder_type_used}, model: {model_name}, model_kwargs: {embedder_config.get('model_kwargs', {})}")

    embedder = adal.Embedder(**embedder_kwargs)

    # Set batch_size as an attribute if available (not a constructor parameter)
    if "batch_size" in embedder_config:
        embedder.batch_size = embedder_config["batch_size"]
    return embedder
