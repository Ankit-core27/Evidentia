"""Case records that the AI can propose and investigators review: persons, objects,
locations, events, relationships, observations and injuries, plus conflicts."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ReviewableMixin, UTCDateTime


class Person(ReviewableMixin, Base):
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(200))
    age: Mapped[int | None] = mapped_column(Integer)
    occupation: Mapped[str] = mapped_column(String(200), default="")
    condition: Mapped[str | None] = mapped_column(String(16))
    contact: Mapped[str] = mapped_column(String(300), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class CaseObject(ReviewableMixin, Base):
    """Vehicles, phones, weapons and other items. Named CaseObject because `object`
    is a Python builtin; the table is `objects` and the record type is "object"."""

    __tablename__ = "objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    label: Mapped[str] = mapped_column(String(200))
    # plate, number, make, colour...
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class Location(ReviewableMixin, Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    address: Mapped[str] = mapped_column(String(500))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    # GeoJSON geometry for zones and boundaries.
    geometry: Mapped[dict | None] = mapped_column(JSON)
    building_id: Mapped[int | None] = mapped_column(ForeignKey("buildings.id", ondelete="SET NULL"))


class Event(ReviewableMixin, Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(32), index=True)
    time_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    time_end: Mapped[datetime | None] = mapped_column(UTCDateTime)
    time_precision: Mapped[str] = mapped_column(String(16), default="minute")
    certainty: Mapped[str] = mapped_column(String(16), default="established")
    description: Mapped[str] = mapped_column(Text)
    ai_note: Mapped[str | None] = mapped_column(Text)


class Relationship(ReviewableMixin, Base):
    """An edge of the evidence canvas between two persons, objects, locations or evidence."""

    __tablename__ = "relationships"
    __table_args__ = (
        Index("ix_relationships_from", "from_type", "from_id"),
        Index("ix_relationships_to", "to_type", "to_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    from_type: Mapped[str] = mapped_column(String(16))
    from_id: Mapped[int] = mapped_column(Integer)
    to_type: Mapped[str] = mapped_column(String(16))
    to_id: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(32))
    label: Mapped[str] = mapped_column(String(300), default="")
    confidence: Mapped[float | None] = mapped_column(Float)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")


class Observation(ReviewableMixin, Base):
    """A statement about a subject (a person, object, event...), usually extracted by
    the AI from one passage. Conflicts group observations that disagree."""

    __tablename__ = "observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    subject_type: Mapped[str] = mapped_column(String(32))
    subject_id: Mapped[int] = mapped_column(Integer)
    statement: Mapped[str] = mapped_column(Text)
    observed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("investigators.id", ondelete="SET NULL"))


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    observation_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)


class Injury(ReviewableMixin, Base):
    __tablename__ = "injuries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id", ondelete="SET NULL"))
    body_region: Mapped[str] = mapped_column(String(100))
    # Anatomy model structure, for the M5 explorer.
    structure_id: Mapped[str | None] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(16))
    depth: Mapped[str | None] = mapped_column(String(100))
    estimated_time: Mapped[datetime | None] = mapped_column(UTCDateTime)
    description: Mapped[str] = mapped_column(Text, default="")
    medical_details: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
