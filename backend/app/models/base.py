"""Declarative base and column types shared by every table.

Enum-like columns are plain strings; the allowed values live in app/schemas/common.py,
so adding a value never needs a migration. List and structured fields are JSON
columns, so the models also run on PostgreSQL. Assign a new list or dict to a JSON
attribute instead of mutating it in place, or SQLAlchemy won't see the change.
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData, String, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Mapper, mapped_column
from sqlalchemy.types import TypeDecorator

# Named constraints, so Alembic's batch mode can alter SQLite tables.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    """Aware UTC, taking a naive value to be UTC already."""
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class UTCDateTime(TypeDecorator):
    """Stores UTC without an offset (SQLite has no time zones) and returns aware
    UTC datetimes, so the API always emits ISO 8601 with a Z suffix. Naive input is
    taken to be UTC already."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(UTC).replace(tzinfo=None)
        return value

    def process_result_value(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


@event.listens_for(Base, "mapper_configured", propagate=True)
def _utc_on_assignment(mapper: Mapper, cls: type) -> None:
    """Converts datetimes to UTC as they are assigned, not only when reloaded, so a
    row returned straight after a create or update also serialises with a Z suffix
    (sessions don't expire rows on commit)."""
    for attribute in mapper.column_attrs:
        if isinstance(attribute.columns[0].type, UTCDateTime):
            event.listen(attribute.class_attribute, "set", _set_utc, retval=True)


def _set_utc(_row, value: datetime | None, _old, _initiator) -> datetime | None:
    return as_utc(value)


class ReviewableMixin:
    """For tables the AI can propose rows in (marked * in PLAN.md's data model).
    AI rows start as origin='ai', review_status='pending'; investigator rows are
    confirmed on creation."""

    origin: Mapped[str] = mapped_column(String(16), default="investigator", server_default="investigator")
    review_status: Mapped[str] = mapped_column(String(16), default="confirmed", server_default="confirmed", index=True)
