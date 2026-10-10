"""The evidence pipeline (steps 2 to 4 in docs/PLAN.md), run as a FastAPI
background task after an upload or a reprocess:

    background_tasks.add_task(process_evidence, evidence.id)

It opens its own session, because the request's session is closed by then.

This is the interface stub from the backend foundation. It only moves the status
from queued to done, so uploads work end to end before the AI track lands. Task
A1 in docs/BACKEND_TASKS.md replaces the body (text extraction, OCR,
transcription, structured proposals) and keeps the signature.
"""

from app.core.db import SessionLocal
from app.models import Evidence
from app.models.base import utcnow


def process_evidence(evidence_id: int) -> None:
    with SessionLocal() as db:
        evidence = db.get(Evidence, evidence_id)
        if evidence is None:
            return
        evidence.processing_status = "done"
        evidence.processed_at = utcnow()
        db.commit()
