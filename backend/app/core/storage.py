"""Original evidence files under STORAGE_DIR, one folder per case.

`evidence.file_path` holds the path relative to STORAGE_DIR, such as
`1/3f2a..._police-report.pdf`, so the storage folder can move.
"""

import hashlib
import io
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.core.config import get_settings

CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class StoredFile:
    file_path: str
    size_bytes: int
    sha256: str


def storage_root() -> Path:
    root = get_settings().storage_path
    root.mkdir(parents=True, exist_ok=True)
    return root


def absolute_path(file_path: str) -> Path:
    return storage_root() / file_path


def safe_filename(name: str) -> str:
    name = Path(name or "file").name
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-.")
    return name[:120] or "file"


def save_original(case_id: int, filename: str, source: BinaryIO) -> StoredFile:
    """Copies an upload into storage/<case_id>/, hashing it on the way."""
    relative = Path(str(case_id)) / f"{uuid.uuid4().hex}_{safe_filename(filename)}"
    target = storage_root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    size = 0
    with target.open("wb") as out:
        while chunk := source.read(CHUNK_SIZE):
            digest.update(chunk)
            size += len(chunk)
            out.write(chunk)
    return StoredFile(file_path=relative.as_posix(), size_bytes=size, sha256=digest.hexdigest())


def save_bytes(case_id: int, filename: str, data: bytes) -> StoredFile:
    """Same as save_original, for files built in memory (the seed)."""
    return save_original(case_id, filename, io.BytesIO(data))


def sha256_of(file_path: str) -> str | None:
    """SHA-256 of a stored file, or None if it is missing."""
    path = absolute_path(file_path)
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()
