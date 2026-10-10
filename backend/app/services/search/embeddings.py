"""Gemini embeddings, stored on evidence_chunks as float32 bytes."""

import numpy as np
from google import genai
from google.genai import types

from app.core.config import get_settings

# The most texts the Gemini API embeds in one batch request.
EMBED_BATCH = 100


def embed_texts(genai_client: genai.Client, texts: list[str], *, task_type: str) -> list[np.ndarray]:
    """One float32 vector per text, in order. task_type is RETRIEVAL_DOCUMENT for
    chunks and RETRIEVAL_QUERY for questions. Raises if the API fails."""
    model = get_settings().gemini_embed_model
    vectors: list[np.ndarray] = []
    for start in range(0, len(texts), EMBED_BATCH):
        batch = texts[start : start + EMBED_BATCH]
        response = genai_client.models.embed_content(
            model=model,
            # One Content per text, so every model returns one embedding per text
            # rather than one for the whole batch.
            contents=[types.Content(parts=[types.Part(text=text)]) for text in batch],
            config=types.EmbedContentConfig(task_type=task_type),
        )
        embeddings = response.embeddings or []
        if len(embeddings) != len(batch):
            raise ValueError(f"Expected {len(batch)} embeddings from {model}, got {len(embeddings)}")
        vectors.extend(np.asarray(embedding.values, dtype=np.float32) for embedding in embeddings)
    return vectors


def to_bytes(vector: np.ndarray) -> bytes:
    return np.asarray(vector, dtype=np.float32).tobytes()


def from_bytes(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)
