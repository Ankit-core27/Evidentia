"""The evidence pipeline (steps 2 to 4 in docs/PLAN.md), run as a FastAPI
background task after an upload or a reprocess:

    background_tasks.add_task(process_evidence, evidence.id)

It opens its own session, because the request's session is closed by then.

The evidence goes to "processing", then its text is extracted (extract.py),
indexed (services/search/indexing.py) and structured into proposals
(structure.py), and it finishes as "done". Any error marks it "failed", with the
reason in its summary. Without GEMINI_API_KEY it extracts what can be read
locally (PDF text layers, Word, plain text), indexes it and finishes without a
summary or proposals.
"""

import logging

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models import Evidence
from app.models.base import utcnow
from app.services.ai import client
from app.services.ai.extract import extract_text
from app.services.ai.passages import ChunkFinder, relink_passages
from app.services.ai.structure import structure_evidence
from app.services.search.indexing import index_evidence

logger = logging.getLogger(__name__)

MAX_REASON_LENGTH = 500


def process_evidence(evidence_id: int) -> None:
    with SessionLocal() as db:
        evidence = db.get(Evidence, evidence_id)
        if evidence is None:
            return
        evidence.processing_status = "processing"
        db.commit()
        try:
            _process(db, evidence)
        except Exception as exc:
            logger.exception("Processing evidence %s failed", evidence_id)
            db.rollback()
            evidence = db.get(Evidence, evidence_id)
            if evidence is None:
                return
            evidence.processing_status = "failed"
            evidence.summary = f"Processing failed: {_reason(exc)}"
            evidence.processed_at = utcnow()
            db.commit()


def _process(db: Session, evidence: Evidence) -> None:
    gemini = client.get_client()

    extraction = extract_text(db, evidence, gemini)
    text = extraction.text
    evidence.extracted_text = text or None
    # Indexed before proposals are linked, so their links can carry chunk IDs.
    chunks = index_evidence(db, evidence.id, extraction.pages if text else [], paged=extraction.paged)
    finder = ChunkFinder(chunks)
    relink_passages(db, evidence.id, finder)
    evidence.summary = None
    # Committed here so the text stays readable and searchable if structuring fails.
    db.commit()

    if gemini is not None and text:
        structure_evidence(db, evidence, text, finder, gemini)

    evidence.processing_status = "done"
    evidence.processed_at = utcnow()
    db.commit()


def _reason(exc: Exception) -> str:
    reason = str(exc).strip() or type(exc).__name__
    return reason[:MAX_REASON_LENGTH]
