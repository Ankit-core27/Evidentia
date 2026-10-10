"""Finding the chunk that holds a passage, so evidence links can point at it."""

import re
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EvidenceChunk, EvidenceLink

# Share of a passage's words a chunk must contain when no chunk holds it verbatim
# (the model reworded it slightly, or it runs across two chunks).
MIN_OVERLAP = 0.6


def normalize(text: str) -> str:
    """Lowercase words only, so spacing, line breaks and punctuation don't matter."""
    return " ".join(re.findall(r"\w+", text.casefold()))


class ChunkFinder:
    def __init__(self, chunks: Iterable[EvidenceChunk]):
        self._chunks = [(chunk, f" {normalize(chunk.text)} ") for chunk in chunks]

    def find(self, passage: str | None) -> EvidenceChunk | None:
        target = normalize(passage or "")
        if not target:
            return None
        for chunk, text in self._chunks:
            if f" {target} " in text:
                return chunk
        words = set(target.split())
        best, best_share = None, 0.0
        for chunk, text in self._chunks:
            share = len(words.intersection(text.split())) / len(words)
            if share > best_share:
                best, best_share = chunk, share
        return best if best_share >= MIN_OVERLAP else None


def relink_passages(db: Session, evidence_id: int, finder: ChunkFinder) -> None:
    """Re-indexing replaces an evidence's chunks, which empties chunk_id on its
    existing links. Points each of them at the new chunk holding its passage."""
    links = db.scalars(
        select(EvidenceLink).where(
            EvidenceLink.evidence_id == evidence_id,
            EvidenceLink.chunk_id.is_(None),
            EvidenceLink.passage.is_not(None),
        )
    )
    for link in links:
        chunk = finder.find(link.passage)
        if chunk is not None:
            link.chunk_id = chunk.id
