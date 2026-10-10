"""Chunking and embedding (step 4 in docs/PLAN.md).

The pipeline (app/services/ai/pipeline.py) calls index_evidence once it has the
text, with one string per page for PDFs or a single string otherwise. The seed
calls it too, so the seed case can be searched.

This is the interface stub from the backend foundation: it stores one chunk per
paragraph without embeddings. Task A2 in docs/BACKEND_TASKS.md replaces the body
(page-sized chunks, Gemini embeddings as float32 bytes) and keeps the signature.
"""

import re

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import EvidenceChunk


def index_evidence(db: Session, evidence_id: int, pages: list[str], *, paged: bool = False) -> list[EvidenceChunk]:
    """Replaces the evidence's chunks. `paged` says whether `pages` are real pages
    (PDF), so chunks keep their page number; otherwise `page` stays null.
    Adds the rows to the session and flushes; the caller commits."""
    db.execute(delete(EvidenceChunk).where(EvidenceChunk.evidence_id == evidence_id))
    chunks: list[EvidenceChunk] = []
    for page_number, text in enumerate(pages, start=1):
        for paragraph in re.split(r"\n\s*\n", text):
            paragraph = paragraph.strip()
            if paragraph:
                chunks.append(
                    EvidenceChunk(
                        evidence_id=evidence_id,
                        ordinal=len(chunks),
                        page=page_number if paged else None,
                        text=paragraph,
                    )
                )
    db.add_all(chunks)
    db.flush()
    return chunks
