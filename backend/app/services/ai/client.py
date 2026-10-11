"""The one google-genai client, shared by the evidence pipeline (A1), search and
cited answers (A2) and conflict detection (A3).

Call it through the module (`from app.services.ai import client`, then
`client.get_client()`), so tests can patch `app.services.ai.client.get_client`
in one place. Returns None when GEMINI_API_KEY is unset; callers then skip the
AI step or fall back to local logic.
"""

from functools import lru_cache

from google import genai
from google.genai import types

from app.core.config import get_settings


@lru_cache
def get_client() -> genai.Client | None:
    settings = get_settings()
    if not settings.ai_enabled:
        return None
    # Retries ride out rate limits (429) and busy models (503), which the free
    # tier hits quickly; the timeout stops a stuck request holding a worker.
    retry = types.HttpRetryOptions(
        attempts=8, initial_delay=5, max_delay=60, exp_base=2, http_status_codes=[429, 500, 502, 503, 504]
    )
    options = types.HttpOptions(timeout=180_000, retry_options=retry)
    return genai.Client(api_key=settings.gemini_api_key, http_options=options)
