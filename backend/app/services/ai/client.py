"""The one google-genai client, shared by the evidence pipeline (A1), search and
cited answers (A2) and conflict detection (A3).

Call it through the module (`from app.services.ai import client`, then
`client.get_client()`), so tests can patch `app.services.ai.client.get_client`
in one place. Returns None when GEMINI_API_KEY is unset; callers then skip the
AI step or fall back to local logic.
"""

from functools import lru_cache

from google import genai

from app.core.config import get_settings


@lru_cache
def get_client() -> genai.Client | None:
    settings = get_settings()
    if not settings.ai_enabled:
        return None
    return genai.Client(api_key=settings.gemini_api_key)
