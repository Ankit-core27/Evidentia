"""Chain of custody: who has held each evidence item, every handover between
investigators, and every integrity check of its stored file.

custody_events is append-only through the application: rows are only ever added,
and the ORM refuses to update or delete one (see _refuse_change). Corrections are new
events. This guards against accidental rewrites in code; it does not make the table
tamper-proof against someone with direct access to the database.

custody_transfers holds the handover workflow (pending, then accepted, rejected or
cancelled). Its status changes; each change also adds a custody event, so the
history never depends on the transfer row alone.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text, event, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, utcnow


class CustodyTransfer(Base):
    __tablename__ = "custody_transfers"
    __table_args__ = (
        # At most one pending transfer per evidence item, enforced by the database, so
        # two concurrent requests can't both open a handover.
        Index(
            "uq_custody_transfers_pending",
            "evidence_id",
            unique=True,
            sqlite_where=text("status = 'PENDING'"),
            postgresql_where=text("status = 'PENDING'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id", ondelete="RESTRICT"), index=True)
    from_investigator_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    to_investigator_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    initiated_by_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    # Names as they were, so the history reads the same if an investigator is removed.
    from_name: Mapped[str] = mapped_column(String(200), default="")
    to_name: Mapped[str] = mapped_column(String(200), default="")
    initiated_by_name: Mapped[str] = mapped_column(String(200), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    # PENDING, ACCEPTED, REJECTED or CANCELLED.
    status: Mapped[str] = mapped_column(String(16), default="PENDING", index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))


class CustodyEvent(Base):
    __tablename__ = "custody_events"
    __table_args__ = (Index("ix_custody_events_evidence_at", "evidence_id", "at", "id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # RESTRICT: evidence with a custody history can't be deleted out from under it.
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id", ondelete="RESTRICT"))
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), index=True)
    # REGISTERED, COLLECTED, TRANSFERRED, RECEIVED, TRANSFER_REJECTED,
    # TRANSFER_CANCELLED, ANALYSED or INTEGRITY_CHECKED.
    action: Mapped[str] = mapped_column(String(32))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    actor_name: Mapped[str] = mapped_column(String(200), default="")
    from_custodian_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    from_custodian_name: Mapped[str] = mapped_column(String(200), default="")
    to_custodian_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    to_custodian_name: Mapped[str] = mapped_column(String(200), default="")
    transfer_id: Mapped[int | None] = mapped_column(ForeignKey("custody_transfers.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(Text, default="")
    # The baseline hash for REGISTERED; the hash computed by an INTEGRITY_CHECKED event.
    sha256: Mapped[str | None] = mapped_column(String(64))
    # For INTEGRITY_CHECKED: the baseline compared against, and MATCH, MISMATCH,
    # FILE_MISSING or STORAGE_ERROR.
    expected_sha256: Mapped[str | None] = mapped_column(String(64))
    integrity_result: Mapped[str | None] = mapped_column(String(16))
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AppendOnlyError(RuntimeError):
    pass


@event.listens_for(CustodyEvent, "before_update")
@event.listens_for(CustodyEvent, "before_delete")
def _refuse_change(mapper, connection, target):
    raise AppendOnlyError("Custody events are append-only; record a correction as a new event.")
