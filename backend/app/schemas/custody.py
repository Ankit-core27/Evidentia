"""Chain of custody requests and responses (app/routers/custody.py).

Requests never carry an actor or a time: the actor is the investigator picked in the
header (X-Investigator-Id) and every time is set by the server. ApiModel rejects
unknown fields, so a client that sends either gets a 422.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel, OrmModel

CustodyAction = Literal[
    "REGISTERED",
    "COLLECTED",
    "TRANSFERRED",
    "RECEIVED",
    "TRANSFER_REJECTED",
    "TRANSFER_CANCELLED",
    "ANALYSED",
    "INTEGRITY_CHECKED",
]
TransferStatus = Literal["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]
IntegrityResult = Literal["MATCH", "MISMATCH", "FILE_MISSING", "STORAGE_ERROR"]

NOTE_MAX = 1000


class CustodyPerson(ApiModel):
    """An investigator as the history recorded them. `id` is None once they are removed."""

    id: int | None
    name: str


class CustodyTransfer(OrmModel):
    id: int
    evidence_id: int
    from_investigator_id: int | None
    from_name: str
    to_investigator_id: int | None
    to_name: str
    initiated_by_id: int | None
    initiated_by_name: str
    reason: str
    status: TransferStatus
    created_at: datetime
    resolved_at: datetime | None


class CustodyEvent(OrmModel):
    id: int
    evidence_id: int
    case_id: int
    action: CustodyAction
    actor_id: int | None
    actor_name: str
    from_custodian_id: int | None
    from_custodian_name: str
    to_custodian_id: int | None
    to_custodian_name: str
    transfer_id: int | None
    # The transfer's status now, for TRANSFERRED events.
    transfer_status: TransferStatus | None = None
    note: str
    sha256: str | None
    expected_sha256: str | None
    integrity_result: IntegrityResult | None
    at: datetime


class CustodyHistory(ApiModel):
    """GET /api/evidence/{id}/custody: oldest event first."""

    evidence_id: int
    case_id: int
    custodian: CustodyPerson | None
    baseline_sha256: str
    pending_transfer: CustodyTransfer | None
    events: list[CustodyEvent]


class TransferCreate(ApiModel):
    to_investigator_id: int = Field(gt=0)
    reason: str = Field("", max_length=NOTE_MAX)


class TransferResolve(ApiModel):
    """Accept, reject or cancel a pending transfer, with an optional note."""

    note: str = Field("", max_length=NOTE_MAX)


class AnalysisCreate(ApiModel):
    note: str = Field(min_length=1, max_length=NOTE_MAX)


class IntegrityCheck(ApiModel):
    """POST /api/evidence/{id}/custody/verify.

    MATCH means the stored file's bytes hash to the baseline recorded at registration.
    It shows the file hasn't changed since then; it doesn't show the evidence is authentic.
    """

    result: IntegrityResult
    expected_sha256: str
    actual_sha256: str | None
    detail: str
    event: CustodyEvent
