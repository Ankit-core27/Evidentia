from datetime import datetime

from sqlalchemy import JSON, BigInteger, ForeignKey, Index, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, utcnow


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    # Relative to STORAGE_DIR; see app/core/storage.py.
    file_path: Mapped[str | None] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(200), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    sha256: Mapped[str] = mapped_column(String(64), default="")
    collected_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    source: Mapped[str] = mapped_column(String(300), default="")
    processing_status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # When the pipeline last finished (done or failed); feeds the alerts feed.
    processed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class EvidenceChunk(Base):
    __tablename__ = "evidence_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), index=True)
    # Order of the chunk within its evidence.
    ordinal: Mapped[int] = mapped_column(Integer, default=0)
    page: Mapped[int | None] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    # float32 vector as bytes (numpy.ndarray.tobytes()); null until embedded.
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary)


class EvidenceLink(Base):
    """Ties any record (event, person, observation, injury, scene object...) back to
    the evidence and passage it came from."""

    __tablename__ = "evidence_links"
    __table_args__ = (Index("ix_evidence_links_target", "target_type", "target_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[int | None] = mapped_column(ForeignKey("evidence_chunks.id", ondelete="SET NULL"))
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[int] = mapped_column(Integer)
    passage: Mapped[str | None] = mapped_column(Text)


class AiRun(Base):
    """Every AI output, raw, so any proposal can be traced to the call that made it."""

    __tablename__ = "ai_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Null for case-level runs such as conflict detection.
    evidence_id: Mapped[int | None] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    # extract_text, ocr, transcribe, structure, embed, answer, conflicts...
    task: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(100), default="")
    output: Mapped[dict | list | str | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
