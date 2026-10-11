"""Chain of custody routes:

- GET  /api/evidence/{id}/custody                 history, current custodian, pending transfer
- POST /api/evidence/{id}/custody/transfers       start a transfer to another investigator
- POST /api/custody-transfers/{id}/accept         the recipient confirms receipt; custody moves
- POST /api/custody-transfers/{id}/reject         the recipient declines
- POST /api/custody-transfers/{id}/cancel         the initiator or case lead withdraws it
- POST /api/evidence/{id}/custody/analyses        the custodian records an analysis
- POST /api/evidence/{id}/custody/verify          recompute the file's SHA-256 against the baseline

There is no route to edit or delete a custody event: history is append-only, and a
correction is a new event. Authorization rules are in app/services/evidence/custody.py.

The actor is the investigator picked in the header (X-Investigator-Id), the same
identity the rest of the API records in its audit log. It is not authenticated until
access control lands (M8 in docs/PLAN.md), so these rules stop mistakes, not attackers.
"""

from fastapi import APIRouter, status

from app.core.deps import ActorId, DbSession
from app.core.records import get_or_404, record_audit
from app.models import CustodyTransfer, Evidence
from app.schemas.custody import (
    AnalysisCreate,
    CustodyEvent as CustodyEventOut,
    CustodyHistory,
    CustodyTransfer as CustodyTransferOut,
    IntegrityCheck,
    TransferCreate,
    TransferResolve,
)
from app.services.evidence import custody

router = APIRouter(tags=["custody"])


@router.get("/evidence/{evidence_id}/custody", response_model=CustodyHistory)
def get_custody(evidence_id: int, db: DbSession):
    evidence = get_or_404(db, Evidence, evidence_id)
    return custody.history(db, evidence)


@router.post(
    "/evidence/{evidence_id}/custody/transfers",
    response_model=CustodyTransferOut,
    status_code=status.HTTP_201_CREATED,
)
def start_transfer(evidence_id: int, body: TransferCreate, db: DbSession, actor_id: ActorId):
    evidence = get_or_404(db, Evidence, evidence_id)
    transfer = custody.start_transfer(db, evidence, actor_id, body.to_investigator_id, body.reason)
    _audit(db, actor_id, evidence, {"custody_transfer": transfer.id, "status": transfer.status})
    db.commit()
    return transfer


@router.post("/custody-transfers/{transfer_id}/accept", response_model=CustodyTransferOut)
def accept_transfer(transfer_id: int, body: TransferResolve, db: DbSession, actor_id: ActorId):
    transfer = get_or_404(db, CustodyTransfer, transfer_id, "Transfer")
    custody.accept_transfer(db, transfer, actor_id, body.note)
    _audit(db, actor_id, db.get(Evidence, transfer.evidence_id), {"custody_transfer": transfer.id, "status": "ACCEPTED"})
    db.commit()
    return transfer


@router.post("/custody-transfers/{transfer_id}/reject", response_model=CustodyTransferOut)
def reject_transfer(transfer_id: int, body: TransferResolve, db: DbSession, actor_id: ActorId):
    transfer = get_or_404(db, CustodyTransfer, transfer_id, "Transfer")
    custody.reject_transfer(db, transfer, actor_id, body.note)
    _audit(db, actor_id, db.get(Evidence, transfer.evidence_id), {"custody_transfer": transfer.id, "status": "REJECTED"})
    db.commit()
    return transfer


@router.post("/custody-transfers/{transfer_id}/cancel", response_model=CustodyTransferOut)
def cancel_transfer(transfer_id: int, body: TransferResolve, db: DbSession, actor_id: ActorId):
    transfer = get_or_404(db, CustodyTransfer, transfer_id, "Transfer")
    custody.cancel_transfer(db, transfer, actor_id, body.note)
    _audit(db, actor_id, db.get(Evidence, transfer.evidence_id), {"custody_transfer": transfer.id, "status": "CANCELLED"})
    db.commit()
    return transfer


@router.post(
    "/evidence/{evidence_id}/custody/analyses",
    response_model=CustodyEventOut,
    status_code=status.HTTP_201_CREATED,
)
def record_analysis(evidence_id: int, body: AnalysisCreate, db: DbSession, actor_id: ActorId):
    evidence = get_or_404(db, Evidence, evidence_id)
    event = custody.record_analysis(db, evidence, actor_id, body.note)
    db.commit()
    return event


@router.post("/evidence/{evidence_id}/custody/verify", response_model=IntegrityCheck)
def verify_integrity(evidence_id: int, db: DbSession, actor_id: ActorId):
    evidence = get_or_404(db, Evidence, evidence_id)
    checked, expected, event = custody.verify_integrity(db, evidence, actor_id)
    _audit(db, actor_id, evidence, {"integrity_check": checked.result})
    db.commit()
    return {
        "result": checked.result,
        "expected_sha256": expected,
        "actual_sha256": checked.actual,
        "detail": checked.detail,
        "event": event,
    }


def _audit(db, actor_id, evidence: Evidence, detail: dict) -> None:
    """Custody changes also go in the case's audit trail, with the other changes."""
    record_audit(db, actor_id, "reviewed" if "integrity_check" in detail else "modified", "evidence", evidence.id,
                 case_id=evidence.case_id, detail=detail)  # fmt: skip
