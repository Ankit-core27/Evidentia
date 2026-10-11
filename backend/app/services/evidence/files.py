"""Evidence files: taking in an upload (step 1 of the pipeline in docs/PLAN.md),
naming a download, and rechecking stored files against their hashes."""

from pathlib import PurePosixPath
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.records import record_audit
from app.core.storage import StoredFile, absolute_path, save_original, sha256_of
from app.services.evidence.custody import record_registration
from app.models import Evidence
from app.models.base import utcnow
from app.schemas.common import EvidenceType
from app.schemas.evidence import HashMismatch, VerifyResult

DEFAULT_MIME_TYPE = "application/octet-stream"


def evidence_type_for(mime_type: str) -> EvidenceType:
    """The evidence type an upload starts as, guessed from its MIME type as the
    mock's evidenceTypeFor does. Investigators can change it afterwards."""
    mime = mime_type.lower()
    if mime.startswith("image/"):
        return "photo"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if mime == "application/pdf" or "word" in mime or mime.startswith("text/"):
        return "document"
    return "other"


def ingest_file(
    db: Session, case_id: int, filename: str, mime_type: str | None, source: BinaryIO, actor_id: int | None
) -> Evidence:
    """Stores one uploaded file under storage/<case_id>/ and adds its evidence row,
    queued for the pipeline, with an "uploaded" audit entry and its first custody
    event (REGISTERED, with the SHA-256 of the stored bytes). The caller commits
    once, so the evidence never commits without its custody record, and queues
    process_evidence."""
    mime = mime_type or DEFAULT_MIME_TYPE
    stored = save_original(case_id, filename, source)
    try:
        return _register(db, case_id, filename, mime, stored, actor_id)
    except Exception:
        # Not registered, so the stored copy goes too.
        absolute_path(stored.file_path).unlink(missing_ok=True)
        raise


def _register(db: Session, case_id: int, filename: str, mime: str, stored: StoredFile, actor_id: int | None) -> Evidence:
    evidence = Evidence(
        case_id=case_id,
        type=evidence_type_for(mime),
        title=filename,
        mime_type=mime,
        file_path=stored.file_path,
        size_bytes=stored.size_bytes,
        sha256=stored.sha256,
        processing_status="queued",
    )
    db.add(evidence)
    db.flush()
    record_audit(
        db,
        actor_id,
        "uploaded",
        "evidence",
        evidence.id,
        case_id=case_id,
        detail={"file_name": filename, "sha256": stored.sha256},
    )
    record_registration(db, evidence, actor_id, note="Registered on upload.")
    return evidence


def download_name(evidence: Evidence) -> str:
    """The evidence title, with the stored file's extension added if a rename
    dropped it, so the download still opens in the right application."""
    title = evidence.title.strip() or "evidence"
    suffix = PurePosixPath(evidence.file_path or "").suffix
    if suffix and not title.lower().endswith(suffix.lower()):
        return f"{title}{suffix}"
    return title


def verify_case_files(db: Session, case_id: int) -> VerifyResult:
    """Recomputes the SHA-256 of every stored file in a case. A file that is gone
    from storage is a mismatch with actual None. Evidence without a stored file is
    not checked."""
    rows = db.scalars(
        select(Evidence).where(Evidence.case_id == case_id, Evidence.file_path.is_not(None)).order_by(Evidence.id)
    ).all()
    mismatches = []
    for evidence in rows:
        actual = sha256_of(evidence.file_path)
        if actual != evidence.sha256:
            mismatches.append(
                HashMismatch(evidence_id=evidence.id, title=evidence.title, expected=evidence.sha256, actual=actual)
            )
    return VerifyResult(checked=len(rows), mismatches=mismatches, verified_at=utcnow())
