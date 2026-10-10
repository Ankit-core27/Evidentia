"""Timeline routes, task B3 in docs/BACKEND_TASKS.md:

- GET, POST /api/cases/{id}/events?category=
- PATCH, DELETE /api/events/{id}
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import ActorId, DbSession
from app.core.records import apply_update, delete_links_to, get_or_404, record_audit
from app.models import Case, Event, Location
from app.schemas.common import EventCategory
from app.schemas.timeline import CaseEvent, CaseEventCreate, CaseEventUpdate
from app.services.timeline.events import events_in_order, remove_event_from_stages, with_utc_times

router = APIRouter(tags=["timeline"])


def _require_location_in_case(db: Session, case_id: int, location_id: int | None) -> None:
    if location_id is None:
        return
    location = db.get(Location, location_id)
    if location is None or location.case_id != case_id:
        raise HTTPException(
            status_code=422,
            detail=[{"loc": ["body", "location_id"], "msg": "Location not found in this case", "type": "value_error"}],
        )


@router.get("/cases/{case_id}/events", response_model=list[CaseEvent])
def list_events(case_id: int, db: DbSession, category: EventCategory | None = None):
    case = get_or_404(db, Case, case_id)
    return db.scalars(events_in_order(case.id, category)).all()


@router.post("/cases/{case_id}/events", response_model=CaseEvent, status_code=status.HTTP_201_CREATED)
def create_event(case_id: int, body: CaseEventCreate, db: DbSession, actor_id: ActorId):
    case = get_or_404(db, Case, case_id)
    _require_location_in_case(db, case.id, body.location_id)
    event = Event(case_id=case.id, **with_utc_times(body.model_dump()))
    db.add(event)
    db.flush()
    record_audit(db, actor_id, "modified", "event", event.id, case_id=case.id, detail={"created": True})
    db.commit()
    return event


@router.patch("/events/{event_id}", response_model=CaseEvent)
def update_event(event_id: int, body: CaseEventUpdate, db: DbSession, actor_id: ActorId):
    event = get_or_404(db, Event, event_id)
    changes = with_utc_times(body.model_dump(exclude_unset=True))
    _require_location_in_case(db, event.case_id, changes.get("location_id"))
    apply_update(db, event, changes, record_type="event", actor_id=actor_id)
    db.commit()
    return event


@router.delete("/events/{event_id}", response_model=None, status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: DbSession, actor_id: ActorId) -> None:
    event = get_or_404(db, Event, event_id)
    remove_event_from_stages(db, event)
    delete_links_to(db, "event", event.id)
    db.delete(event)
    record_audit(db, actor_id, "modified", "event", event_id, case_id=event.case_id, detail={"deleted": True})
    db.commit()
