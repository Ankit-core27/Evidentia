from datetime import datetime
from typing import Any

from app.schemas.common import ApiModel, AuditAction, EvidenceType, OrmModel, ProcessingStatus, RecordType


class Evidence(OrmModel):
    """Evidence metadata. The stored file path and the extracted text stay server-side."""

    id: int
    case_id: int
    type: EvidenceType
    title: str
    description: str
    notes: str
    mime_type: str
    size_bytes: int
    sha256: str
    collected_at: datetime | None
    source: str
    processing_status: ProcessingStatus
    summary: str | None
    created_at: datetime
    # The investigator who holds it now; see GET /api/evidence/{id}/custody.
    custodian_id: int | None = None


class EvidenceListItem(Evidence):
    """A row of GET /api/evidence, which spans every case."""

    case_number: str
    case_title: str


class EvidenceLink(OrmModel):
    id: int
    evidence_id: int
    chunk_id: int | None
    target_type: RecordType
    target_id: int
    passage: str | None


class EvidenceLinkCreate(ApiModel):
    evidence_id: int
    chunk_id: int | None = None
    target_type: RecordType
    target_id: int
    passage: str | None = None


class AuditEntry(OrmModel):
    id: int
    actor_id: int | None
    actor_name: str | None
    action: AuditAction
    record_type: RecordType
    record_id: int
    at: datetime
    detail: dict[str, Any] | None


class EvidenceDetail(EvidenceListItem):
    """GET /api/evidence/{id}."""

    extracted_text: str | None
    links: list[EvidenceLink]
    custody: list[AuditEntry]


class EvidenceUpdate(ApiModel):
    type: EvidenceType | None = None
    title: str | None = None
    description: str | None = None
    notes: str | None = None


class HashMismatch(OrmModel):
    evidence_id: int
    title: str
    expected: str
    # Null when the stored file is missing.
    actual: str | None


class VerifyResult(OrmModel):
    """POST /api/cases/{id}/verify."""

    checked: int
    mismatches: list[HashMismatch]
    verified_at: datetime
