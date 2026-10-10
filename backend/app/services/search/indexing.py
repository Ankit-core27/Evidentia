"""Chunking and embedding (step 4 in docs/PLAN.md).

The pipeline (app/services/ai/pipeline.py) calls index_evidence once it has the
text, with one string per page for PDFs or a single string otherwise. The seed
calls it too, so the seed case can be searched.

Chunks are about a page long and break between paragraphs. With GEMINI_API_KEY
set they are embedded straight away; without it, or if embedding fails, they are
stored without embeddings and ranking embeds them on first use (ranking.py).
"""

import logging
import re

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import EvidenceChunk
from app.services.ai import client
from app.services.search.embeddings import embed_texts, to_bytes

logger = logging.getLogger(__name__)

# Longest chunk, in characters: about a page of a statement or report, and well
# inside the embedding model's input limit.
CHUNK_CHARS = 2000

PARAGRAPH_BREAK = re.compile(r"\n\s*\n")
# Where an over-long paragraph may be cut: after a line or a sentence.
BREAK_POINT = re.compile(r"\n|[.!?][\"')\]]*\s")


def split_into_chunks(text: str, limit: int = CHUNK_CHARS) -> list[str]:
    """Splits one page (or a whole unpaged text) into chunks of at most `limit`
    characters. Paragraphs are packed together while they fit, and a paragraph
    longer than `limit` is cut after a line or sentence. Chunks are slices of the
    original text, so a passage quoted from it is found in its chunk as written."""
    parts: list[tuple[int, int]] = []
    start = 0
    for match in PARAGRAPH_BREAK.finditer(text):
        parts.extend(_paragraph_parts(text, start, match.start(), limit))
        start = match.end()
    parts.extend(_paragraph_parts(text, start, len(text), limit))

    chunks: list[str] = []
    chunk_start = chunk_end = -1
    for part_start, part_end in parts:
        if chunk_start >= 0 and part_end - chunk_start > limit:
            chunks.append(text[chunk_start:chunk_end])
            chunk_start = -1
        if chunk_start < 0:
            chunk_start = part_start
        chunk_end = part_end
    if chunk_start >= 0:
        chunks.append(text[chunk_start:chunk_end])
    return chunks


def _strip(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def _paragraph_parts(text: str, start: int, end: int, limit: int) -> list[tuple[int, int]]:
    """Spans of the paragraph text[start:end], without surrounding whitespace and
    cut into parts of at most `limit` characters."""
    start, end = _strip(text, start, end)
    parts: list[tuple[int, int]] = []
    while end - start > limit:
        window = text[start : start + limit]
        cut = max((match.end() for match in BREAK_POINT.finditer(window)), default=0)
        if cut <= limit // 2:
            cut = window.rfind(" ") + 1
        if cut <= limit // 2:
            cut = limit
        parts.append(_strip(text, start, start + cut))
        start, end = _strip(text, start + cut, end)
    if start < end:
        parts.append((start, end))
    return parts


def index_evidence(db: Session, evidence_id: int, pages: list[str], *, paged: bool = False) -> list[EvidenceChunk]:
    """Replaces the evidence's chunks. `paged` says whether `pages` are real pages
    (PDF), so chunks keep their page number; otherwise `page` stays null. Chunks
    never cross a page. Adds the rows to the session and flushes; the caller commits."""
    pieces = [
        (page_number if paged else None, chunk)
        for page_number, text in enumerate(pages, start=1)
        for chunk in split_into_chunks(text)
    ]

    # Embed before touching the database, so no write lock is held during the call.
    embeddings: list[bytes | None] = [None] * len(pieces)
    genai_client = client.get_client()
    if genai_client is not None and pieces:
        try:
            vectors = embed_texts(genai_client, [text for _, text in pieces], task_type="RETRIEVAL_DOCUMENT")
            embeddings = [to_bytes(vector) for vector in vectors]
        except Exception:
            logger.exception("Embedding evidence %s failed; its chunks will be embedded on first search", evidence_id)

    db.execute(delete(EvidenceChunk).where(EvidenceChunk.evidence_id == evidence_id))
    chunks = [
        EvidenceChunk(evidence_id=evidence_id, ordinal=ordinal, page=page, text=text, embedding=embedding)
        for ordinal, ((page, text), embedding) in enumerate(zip(pieces, embeddings))
    ]
    db.add_all(chunks)
    db.flush()
    return chunks
