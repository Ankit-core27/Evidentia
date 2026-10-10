from datetime import datetime

from sqlalchemy import JSON, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow
from app.models.case import Investigator


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    template: Mapped[str] = mapped_column(String(16))
    options: Mapped[dict] = mapped_column(JSON, default=dict)
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    # SHA-256 of the canonical JSON of `content`.
    sha256: Mapped[str] = mapped_column(String(64))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AuditLog(Base):
    """Chain of custody and change history. Never updated or deleted."""

    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_record", "record_type", "record_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))
    # uploaded, viewed, modified, reviewed, exported
    action: Mapped[str] = mapped_column(String(16))
    record_type: Mapped[str] = mapped_column(String(32))
    record_id: Mapped[int] = mapped_column(Integer)
    # The case the record belongs to, kept even after the record is deleted, so
    # GET /cases/{id}/audit is one query. Not a foreign key, for the same reason.
    case_id: Mapped[int | None] = mapped_column(Integer, index=True)
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # Before and after values for modifications, or other context.
    detail: Mapped[dict | None] = mapped_column(JSON)

    actor: Mapped[Investigator | None] = relationship(lazy="joined")

    @property
    def actor_name(self) -> str | None:
        """For AuditEntry, so `AuditEntry.model_validate(row)` works as is."""
        return self.actor.name if self.actor else None
