"""Non-traumatic anatomical findings; traumatic findings remain Injury records."""

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ReviewableMixin


class AnatomyFinding(ReviewableMixin, Base):
    __tablename__ = "anatomy_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id", ondelete="SET NULL"), index=True)
    structure_id: Mapped[str | None] = mapped_column(String(100))
    body_region: Mapped[str] = mapped_column(String(100))
    finding_type: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text)
    reported_condition: Mapped[str] = mapped_column(Text, default="")
    medical_details: Mapped[dict] = mapped_column(JSON, default=dict)
