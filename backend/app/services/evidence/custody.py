"""Chain of custody: registration, handovers between investigators, analysis notes and
integrity checks, each recorded as an append-only custody event.

Who may do what (docs: "Authorization" in app/routers/custody.py):
- Every write needs an identified investigator (the X-Investigator-Id header) who is
  assigned to the evidence's case: in its investigator_ids, or its lead.
- A transfer is started by the current custodian, or by the case lead (who may also
  assign custody when nobody holds it). The recipient must be assigned to the case
  and must not already hold the evidence. Only one transfer may be pending.
- Only the recipient accepts or rejects a transfer; the initiator or the case lead may
  cancel it. Custody changes only when the recipient accepts.
- Only the current custodian records an analysis.

The routers commit; these functions add rows and flush, so a request's changes commit
or roll back together.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.storage import CHUNK_SIZE, absolute_path
from app.models import Case, CustodyEvent, CustodyTransfer, Evidence, Investigator
from app.models.base import utcnow

PENDING = "PENDING"


def _invalid(field: str, msg: str) -> HTTPException:
    """A 422 in FastAPI's validation error shape, which the frontend shows per field."""
    return HTTPException(status_code=422, detail=[{"loc": ["body", field], "msg": msg, "type": "value_error"}])


def _name(db: Session, investigator_id: int | None) -> str:
    if investigator_id is None:
        return ""
    investigator = db.get(Investigator, investigator_id)
    return investigator.name if investigator else ""


def is_assigned(case: Case, investigator_id: int | None) -> bool:
    return investigator_id is not None and (
        investigator_id == case.lead_investigator_id or investigator_id in (case.investigator_ids or [])
    )


def require_case_member(db: Session, evidence: Evidence, actor_id: int | None) -> Case:
    """The evidence's case, if the actor may act on it; 401 or 403 otherwise."""
    if actor_id is None:
        raise HTTPException(status_code=401, detail="Choose an investigator in the header first.")
    case = db.get(Case, evidence.case_id)
    if not is_assigned(case, actor_id):
        raise HTTPException(status_code=403, detail="Only investigators assigned to this case can do that.")
    return case


def _add_event(db: Session, evidence: Evidence, action: str, actor_id: int | None, **fields) -> CustodyEvent:
    for key in ("from_custodian", "to_custodian"):
        if f"{key}_id" in fields and f"{key}_name" not in fields:
            fields[f"{key}_name"] = _name(db, fields[f"{key}_id"])
    event = CustodyEvent(
        evidence_id=evidence.id,
        case_id=evidence.case_id,
        action=action,
        actor_id=actor_id,
        actor_name=_name(db, actor_id),
        **fields,
    )
    db.add(event)
    db.flush()
    return event


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def record_registration(
    db: Session, evidence: Evidence, actor_id: int | None, *, note: str = "", at: datetime | None = None
) -> CustodyEvent:
    """The first custody event of an evidence item, with the baseline SHA-256 of its
    stored bytes. Whoever registered it becomes its custodian. Call it in the same
    transaction that adds the evidence, so neither commits without the other.

    `at` is for the seed's historical data only; requests always use the server's clock."""
    evidence.custodian_id = actor_id
    if at is not None:
        return _add_event(db, evidence, "REGISTERED", actor_id, to_custodian_id=actor_id,
                          sha256=evidence.sha256 or None, note=note, at=at)  # fmt: skip
    return _add_event(
        db,
        evidence,
        "REGISTERED",
        actor_id,
        to_custodian_id=actor_id,
        sha256=evidence.sha256 or None,
        note=note,
    )


def baseline_sha256(db: Session, evidence: Evidence) -> str:
    """The hash recorded at registration. Falls back to the evidence row for items
    registered before custody events existed."""
    registered = db.scalar(
        select(CustodyEvent.sha256)
        .where(CustodyEvent.evidence_id == evidence.id, CustodyEvent.action == "REGISTERED")
        .order_by(CustodyEvent.at, CustodyEvent.id)
        .limit(1)
    )
    return registered or evidence.sha256


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


def pending_transfer(db: Session, evidence_id: int) -> CustodyTransfer | None:
    return db.scalar(
        select(CustodyTransfer).where(CustodyTransfer.evidence_id == evidence_id, CustodyTransfer.status == PENDING)
    )


def history(db: Session, evidence: Evidence) -> dict:
    events = db.scalars(
        select(CustodyEvent).where(CustodyEvent.evidence_id == evidence.id).order_by(CustodyEvent.at, CustodyEvent.id)
    ).all()
    transfer_ids = {e.transfer_id for e in events if e.transfer_id is not None}
    statuses = (
        dict(db.execute(select(CustodyTransfer.id, CustodyTransfer.status).where(CustodyTransfer.id.in_(transfer_ids))).all())
        if transfer_ids
        else {}
    )
    custodian = db.get(Investigator, evidence.custodian_id) if evidence.custodian_id else None
    return {
        "evidence_id": evidence.id,
        "case_id": evidence.case_id,
        "custodian": {"id": custodian.id, "name": custodian.name} if custodian else None,
        "baseline_sha256": baseline_sha256(db, evidence),
        "pending_transfer": pending_transfer(db, evidence.id),
        "events": [
            {
                **{c.key: getattr(e, c.key) for c in CustodyEvent.__table__.columns},
                "transfer_status": statuses.get(e.transfer_id) if e.action == "TRANSFERRED" else None,
            }
            for e in events
        ],
    }


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------


def start_transfer(db: Session, evidence: Evidence, actor_id: int | None, to_id: int, reason: str) -> CustodyTransfer:
    case = require_case_member(db, evidence, actor_id)
    is_lead = actor_id == case.lead_investigator_id
    if evidence.custodian_id is None:
        if not is_lead:
            raise HTTPException(status_code=403, detail="Nobody holds this evidence; only the case lead can assign custody.")
    elif actor_id != evidence.custodian_id and not is_lead:
        raise HTTPException(status_code=403, detail="Only the current custodian or the case lead can transfer custody.")
    recipient = db.get(Investigator, to_id)
    if recipient is None:
        raise _invalid("to_investigator_id", "No investigator has this ID.")
    if recipient.id == evidence.custodian_id:
        raise _invalid("to_investigator_id", f"{recipient.name} already holds this evidence.")
    if not is_assigned(case, recipient.id):
        raise _invalid("to_investigator_id", f"{recipient.name} isn't assigned to this case.")
    if pending_transfer(db, evidence.id) is not None:
        raise HTTPException(status_code=409, detail="A transfer of this evidence is already pending.")

    transfer = CustodyTransfer(
        evidence_id=evidence.id,
        from_investigator_id=evidence.custodian_id,
        from_name=_name(db, evidence.custodian_id),
        to_investigator_id=recipient.id,
        to_name=recipient.name,
        initiated_by_id=actor_id,
        initiated_by_name=_name(db, actor_id),
        reason=reason.strip(),
        status=PENDING,
    )
    db.add(transfer)
    try:
        # The partial unique index allows one pending transfer per item, so a request
        # racing this one fails here rather than opening a second handover.
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A transfer of this evidence is already pending.") from None
    _add_event(
        db,
        evidence,
        "TRANSFERRED",
        actor_id,
        from_custodian_id=transfer.from_investigator_id,
        from_custodian_name=transfer.from_name,
        to_custodian_id=recipient.id,
        to_custodian_name=recipient.name,
        transfer_id=transfer.id,
        note=transfer.reason,
    )
    return transfer


def _close(db: Session, transfer: CustodyTransfer, status: str, actor_id: int | None) -> None:
    """Moves a pending transfer to `status`, only if it is still pending."""
    closed = db.execute(
        update(CustodyTransfer)
        .where(CustodyTransfer.id == transfer.id, CustodyTransfer.status == PENDING)
        .values(status=status, resolved_at=utcnow(), resolved_by_id=actor_id)
        .execution_options(synchronize_session=False)
    )
    if closed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="This transfer is no longer pending.")
    db.refresh(transfer)


def _pending_for(db: Session, transfer: CustodyTransfer, actor_id: int | None) -> Evidence:
    evidence = db.get(Evidence, transfer.evidence_id)
    require_case_member(db, evidence, actor_id)
    if transfer.status != PENDING:
        raise HTTPException(status_code=409, detail="This transfer is no longer pending.")
    return evidence


def accept_transfer(db: Session, transfer: CustodyTransfer, actor_id: int | None, note: str) -> CustodyTransfer:
    """The recipient confirms receipt: custody moves to them in the same transaction."""
    evidence = _pending_for(db, transfer, actor_id)
    if actor_id != transfer.to_investigator_id:
        raise HTTPException(status_code=403, detail="Only the recipient can accept this transfer.")
    _close(db, transfer, "ACCEPTED", actor_id)
    # Hand over only if custody is still where the transfer started from.
    holder = (
        Evidence.custodian_id.is_(None)
        if transfer.from_investigator_id is None
        else Evidence.custodian_id == transfer.from_investigator_id
    )
    moved = db.execute(
        update(Evidence)
        .where(Evidence.id == evidence.id, holder)
        .values(custodian_id=transfer.to_investigator_id)
        .execution_options(synchronize_session=False)
    )
    if moved.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Custody changed since this transfer was started.")
    db.refresh(evidence)
    _add_event(
        db,
        evidence,
        "RECEIVED",
        actor_id,
        from_custodian_id=transfer.from_investigator_id,
        from_custodian_name=transfer.from_name,
        to_custodian_id=transfer.to_investigator_id,
        to_custodian_name=transfer.to_name,
        transfer_id=transfer.id,
        note=note.strip(),
    )
    return transfer


def reject_transfer(db: Session, transfer: CustodyTransfer, actor_id: int | None, note: str) -> CustodyTransfer:
    evidence = _pending_for(db, transfer, actor_id)
    if actor_id != transfer.to_investigator_id:
        raise HTTPException(status_code=403, detail="Only the recipient can reject this transfer.")
    _close(db, transfer, "REJECTED", actor_id)
    _resolution_event(db, evidence, transfer, "TRANSFER_REJECTED", actor_id, note)
    return transfer


def cancel_transfer(db: Session, transfer: CustodyTransfer, actor_id: int | None, note: str) -> CustodyTransfer:
    evidence = _pending_for(db, transfer, actor_id)
    case = db.get(Case, evidence.case_id)
    if actor_id not in (transfer.initiated_by_id, case.lead_investigator_id):
        raise HTTPException(status_code=403, detail="Only whoever started this transfer, or the case lead, can cancel it.")
    _close(db, transfer, "CANCELLED", actor_id)
    _resolution_event(db, evidence, transfer, "TRANSFER_CANCELLED", actor_id, note)
    return transfer


def _resolution_event(db, evidence, transfer, action, actor_id, note) -> None:
    _add_event(
        db,
        evidence,
        action,
        actor_id,
        from_custodian_id=transfer.from_investigator_id,
        from_custodian_name=transfer.from_name,
        to_custodian_id=transfer.to_investigator_id,
        to_custodian_name=transfer.to_name,
        transfer_id=transfer.id,
        note=note.strip(),
    )


# ---------------------------------------------------------------------------
# Analysis and integrity
# ---------------------------------------------------------------------------


def record_analysis(db: Session, evidence: Evidence, actor_id: int | None, note: str) -> CustodyEvent:
    require_case_member(db, evidence, actor_id)
    if actor_id != evidence.custodian_id:
        raise HTTPException(status_code=403, detail="Only the current custodian can record an analysis.")
    return _add_event(db, evidence, "ANALYSED", actor_id, note=note.strip())


@dataclass(frozen=True)
class FileHash:
    result: str
    actual: str | None
    detail: str


def hash_stored_file(evidence: Evidence, expected: str) -> FileHash:
    """Recomputes the SHA-256 of the stored file's bytes and compares it with `expected`."""
    if not evidence.file_path:
        return FileHash("FILE_MISSING", None, "This evidence item has no stored file.")
    path = absolute_path(evidence.file_path)
    if not path.is_file():
        return FileHash("FILE_MISSING", None, "The stored file is missing from evidence storage.")
    digest = hashlib.sha256()
    try:
        with path.open("rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                digest.update(chunk)
    except OSError as exc:
        return FileHash("STORAGE_ERROR", None, f"The stored file couldn't be read ({exc.strerror or type(exc).__name__}).")
    actual = digest.hexdigest()
    if actual == expected:
        return FileHash(
            "MATCH",
            actual,
            "The stored file's bytes match the hash recorded at registration. This shows the file hasn't "
            "changed since then; it doesn't by itself show the evidence is authentic.",
        )
    return FileHash("MISMATCH", actual, "The stored file's bytes don't match the hash recorded at registration.")


def verify_integrity(db: Session, evidence: Evidence, actor_id: int | None) -> tuple[FileHash, str, CustodyEvent]:
    """Checks the stored file against its baseline and records the check. The baseline
    is never changed."""
    require_case_member(db, evidence, actor_id)
    expected = baseline_sha256(db, evidence)
    checked = hash_stored_file(evidence, expected)
    event = _add_event(
        db,
        evidence,
        "INTEGRITY_CHECKED",
        actor_id,
        sha256=checked.actual,
        expected_sha256=expected,
        integrity_result=checked.result,
        note=checked.detail if checked.result in ("FILE_MISSING", "STORAGE_ERROR") else "",
    )
    return checked, expected, event
