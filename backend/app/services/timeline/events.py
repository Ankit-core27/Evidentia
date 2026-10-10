"""Event ordering, time normalisation and the cleanup that deleting an event needs."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import Event, Reconstruction, ReconstructionStage


TIME_FIELDS = ("time_start", "time_end")


def with_utc_times(values: dict[str, Any]) -> dict[str, Any]:
    """Converts an event body's times to UTC, as the database returns them, so the
    response and the audit's before and after values all read "...Z". Naive times
    are taken to be UTC already."""
    converted = dict(values)
    for field in TIME_FIELDS:
        value: datetime | None = converted.get(field)
        if value is not None:
            converted[field] = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return converted


def events_in_order(case_id: int, category: str | None = None) -> Select[tuple[Event]]:
    """A case's events by time_start, with untimed events last, then by id."""
    query = select(Event).where(Event.case_id == case_id)
    if category is not None:
        query = query.where(Event.category == category)
    return query.order_by(Event.time_start.is_(None), Event.time_start, Event.id)


def remove_event_from_stages(db: Session, event: Event) -> None:
    """Drops an event from the event_ids of every reconstruction stage that lists it.
    Stages only list events of their own case, so only that case's stages are read."""
    stages = db.scalars(
        select(ReconstructionStage)
        .join(Reconstruction, ReconstructionStage.reconstruction_id == Reconstruction.id)
        .where(Reconstruction.case_id == event.case_id)
    )
    for stage in stages:
        if event.id in stage.event_ids:
            stage.event_ids = [event_id for event_id in stage.event_ids if event_id != event.id]
