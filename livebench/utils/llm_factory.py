"""
Unified LLM API Factory — deployment-aware client construction with
automatic model name mapping and API key/base_url resolution.

All Agent, Evaluator, and tool code that initializes OpenAI / ChatOpenAI
MUST go through this module, so that the entire system honours runtime
environment variables and never sends an unsupported model name upstream.

Usage:
    from livebench.utils.llm_factory import get_openai_client, get_chat_client

    # Raw OpenAI client (openai package)
    client = get_openai_client(model="gpt-4o")

    # LangChain ChatOpenAI client
    llm = get_chat_client(model="gpt-4o-mini", temperature=0.3)
"""

import os
from typing import Optional, Dict, Any, Union


# ---------------------------------------------------------------------------
# Default model-mapping table
# ---------------------------------------------------------------------------
# Key   = model name the application code requests
# Value = model name actually sent to the upstream API in a DeepSeek deployment
DEFAULT_MODEL_MAP: Dict[str, str] = {
    "gpt-4o":              "deepseek-chat",
    "gpt-4o-mini":         "deepseek-chat",
    "gpt-4o-2024-08-06":   "deepseek-chat",
    "gpt-4-turbo":         "deepseek-chat",
    "gpt-4":               "deepseek-chat",
    "gpt-3.5-turbo":       "deepseek-chat",
    "gpt-3.5-turbo-0125":  "deepseek-chat",
    "gpt-4o-realtime":     "deepseek-chat",
    "gemini-2.0-flash":    "deepseek-chat",
    "claude-3.5-sonnet":   "deepseek-chat",
}


# ---------------------------------------------------------------------------
# Deployment detection
# ---------------------------------------------------------------------------
def _resolve_deployment() -> Dict[str, Any]:
    """
    Detect the active deployment environment by checking available API keys.

    Returns a dict with keys:
        provider   — "deepseek", "openrouter", or "openai"
        api_key    — the resolved API key string
        base_url   — the resolved base URL string (may be empty for default)
        model_map  — dict of model-name overrides applicable to this provider
    """
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if deepseek_key:
        return {
            "provider": "deepseek",
            "api_key": deepseek_key,
            "base_url": os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1"),
            "model_map": DEFAULT_MODEL_MAP,
        }

    if openrouter_key:
        return {
            "provider": "openrouter",
            "api_key": openrouter_key,
            "base_url": os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1"),
            "model_map": {},
        }

    # Fallback — plain OpenAI
    return {
        "provider": "openai",
        "api_key": openai_key,
        "base_url": os.getenv("OPENAI_API_BASE", ""),
        "model_map": {},
    }


# ---------------------------------------------------------------------------
# Model name interception
# ---------------------------------------------------------------------------
def resolve_model(requested_model: str, deployment: Optional[Dict[str, Any]] = None) -> str:
    """
    Map *requested_model* to the model name that the current deployment supports.

    If the deployment has a model_map that contains *requested_model*, the
    mapped value is returned and a diagnostic message is printed.  Otherwise
    *requested_model* is returned unchanged.
    """
    if deployment is None:
        deployment = _resolve_deployment()

    model_map = deployment.get("model_map", {})
    mapped = model_map.get(requested_model)
    if mapped and mapped != requested_model:
        print(
            f"🔄 Model mapping: '{requested_model}' → '{mapped}' "
            f"(deployment: {deployment.get('provider', '?')})"
        )
        return mapped
    return requested_model


# ---------------------------------------------------------------------------
# Factory: raw OpenAI client  (openai package)
# ---------------------------------------------------------------------------
def get_openai_client(
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    **kwargs: Any,
) -> "OpenAI":  # type: ignore[name-defined]
    """
    Return an ``openai.OpenAI`` instance whose configuration is overridden by
    the current deployment environment.

    Parameters passed explicitly (*api_key*, *base_url*) take lowest priority;
    deployment-detected values always win.  This ensures that when the code
    runs inside a Hugging Face Space with ``DEEPSEEK_API_KEY`` set, the
    client *always* talks to DeepSeek regardless of what the caller specified.

    Example::

        client = get_openai_client(model="gpt-4o")
        resp = client.chat.completions.create(
            model="gpt-4o",        # <-- will be mapped by the caller if needed
            messages=[...],
        )
    """
    from openai import OpenAI  # defer import for cold-start friendliness

    deployment = _resolve_deployment()

    # Deployment values take precedence over caller-provided arguments.
    final_api_key = deployment["api_key"] or api_key or os.getenv("OPENAI_API_KEY")
    final_base_url = deployment["base_url"] or base_url or os.getenv("OPENAI_API_BASE", "")

    if not final_api_key:
        raise ValueError(
            "No API key available. Set one of DEEPSEEK_API_KEY, "
            "OPENROUTER_API_KEY, or OPENAI_API_KEY."
        )

    client = OpenAI(api_key=final_api_key, base_url=final_base_url or None, **kwargs)

    # Stash resolved metadata for (optional) caller introspection
    client._resolved_api_key = final_api_key         # type: ignore[attr-defined]
    client._resolved_base_url = final_base_url       # type: ignore[attr-defined]
    client._resolved_provider = deployment["provider"]  # type: ignore[attr-defined]

    return client


# ---------------------------------------------------------------------------
# Factory: LangChain ChatOpenAI client  (langchain_openai package)
# ---------------------------------------------------------------------------
def get_chat_client(
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    **kwargs: Any,
) -> "ChatOpenAI":  # type: ignore[name-defined]
    """
    Return a ``langchain_openai.ChatOpenAI`` instance configured according to
    the current deployment environment.

    The *model* parameter is subject to automatic mapping (e.g. ``"gpt-4o"``
    → ``"deepseek-chat"`` when ``DEEPSEEK_API_KEY`` is set).

    Example::

        llm = get_chat_client(model="gpt-4o-mini", temperature=0.3)
        resp = llm.invoke([HumanMessage(content="Hello")])
    """
    from langchain_openai import ChatOpenAI  # defer import

    deployment = _resolve_deployment()

    # Resolve model name via deployment-aware mapping
    if model:
        final_model = resolve_model(model, deployment)
    else:
        final_model = os.getenv("LLM_MODEL", "deepseek-chat")

    # Deployment values take precedence
    final_api_key = deployment["api_key"] or api_key or os.getenv("OPENAI_API_KEY")
    final_base_url = deployment["base_url"] or base_url or os.getenv("OPENAI_API_BASE", "")

    if not final_api_key:
        raise ValueError(
            "No API key available. Set one of DEEPSEEK_API_KEY, "
            "OPENROUTER_API_KEY, or OPENAI_API_KEY."
        )

    print(
        f"🔧 LLM Factory → Provider: {deployment['provider']}, "
        f"Model: {final_model}"
    )

    client_kwargs: Dict[str, Any] = {
        "model": final_model,
        "api_key": final_api_key,
    }
    if final_base_url:
        client_kwargs["base_url"] = final_base_url

    # Merge remaining kwargs (temperature, max_retries, timeout, etc.)
    client_kwargs.update(kwargs)

    return ChatOpenAI(**client_kwargs)