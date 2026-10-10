"""Small helpers around the shared client: one text call, media input for OCR and
transcription, and the ai_runs log every AI output goes to."""

import json
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AiRun

# Files up to this size go inline with the request (Gemini caps a request at
# 20 MB); larger ones go through the Files API.
INLINE_LIMIT = 15 * 1024 * 1024
UPLOAD_TIMEOUT_SECONDS = 300
UPLOAD_POLL_SECONDS = 2


def model_name() -> str:
    return get_settings().gemini_model


def generate_text(client, contents: list[Any]) -> str:
    """One generate_content call that returns the response text ("" if none)."""
    config = types.GenerateContentConfig(temperature=0)
    response = client.models.generate_content(model=model_name(), contents=contents, config=config)
    return (response.text or "").strip()


def generate_json(client, contents: list[Any], schema: dict[str, Any], *, system: str) -> tuple[Any, str]:
    """One generate_content call constrained to a JSON schema. Returns the parsed
    JSON (or None if the reply isn't JSON) and the raw text."""
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0,
        response_mime_type="application/json",
        response_json_schema=schema,
    )
    response = client.models.generate_content(model=model_name(), contents=contents, config=config)
    raw = response.text or ""
    try:
        return json.loads(raw), raw
    except json.JSONDecodeError:
        return None, raw


@contextmanager
def media_input(client, path: Path, mime_type: str) -> Iterator[Any]:
    """A file as generate_content input: inline bytes when small, otherwise an
    upload through the Files API that is deleted afterwards."""
    if path.stat().st_size <= INLINE_LIMIT:
        yield types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type)
        return
    uploaded = client.files.upload(file=path, config=types.UploadFileConfig(mime_type=mime_type))
    try:
        deadline = time.monotonic() + UPLOAD_TIMEOUT_SECONDS
        while uploaded.state == types.FileState.PROCESSING:
            if time.monotonic() > deadline:
                raise TimeoutError(f"Gemini took too long to process {path.name}")
            time.sleep(UPLOAD_POLL_SECONDS)
            uploaded = client.files.get(name=uploaded.name)
        if uploaded.state == types.FileState.FAILED:
            raise RuntimeError(f"Gemini could not process {path.name}")
        yield uploaded
    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:
            pass  # The Files API deletes uploads after 48 hours anyway.


def log_run(
    db: Session,
    task: str,
    output: Any,
    *,
    evidence_id: int | None = None,
    case_id: int | None = None,
) -> AiRun:
    """Adds an ai_runs row with the raw output; the caller commits."""
    run = AiRun(evidence_id=evidence_id, case_id=case_id, task=task, model=model_name(), output=output)
    db.add(run)
    return run
