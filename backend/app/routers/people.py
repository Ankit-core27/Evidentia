"""People routes (task B1 in docs/BACKEND_TASKS.md):

- GET, POST /api/cases/{id}/persons, /objects, /locations
- PATCH, DELETE /api/persons/{id}, /api/objects/{id}, /api/locations/{id}

Rows created here are the investigator's own, so they start confirmed (the model
defaults). PATCH can also confirm or reject an AI proposal through review_status.
"""

from typing import Any

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import ActorId, DbSession
from app.core.records import (
    RECORD_NAMES,
    apply_update,
    delete_links_to,
    delete_relationships_of,
    get_or_404,
    invalid,
    record_audit,
)
from app.models import Building, Case, CaseObject, Location, Person
from app.schemas.people import CaseObject as CaseObjectOut
from app.schemas.people import CaseObjectCreate, CaseObjectUpdate, LocationCreate, LocationUpdate, PersonCreate, PersonUpdate
from app.schemas.people import Location as LocationOut
from app.schemas.people import Person as PersonOut

router = APIRouter(tags=["people"])

PeopleModel = type[Person] | type[CaseObject] | type[Location]


def _list(db: Session, model: PeopleModel, case_id: int) -> list[Any]:
    case = get_or_404(db, Case, case_id)
    return db.scalars(select(model).where(model.case_id == case.id).order_by(model.id)).all()


def _create(db: Session, actor_id: int | None, model: PeopleModel, record_type: str, case_id: int, values: dict) -> Any:
    case = get_or_404(db, Case, case_id)
    row = model(case_id=case.id, **values)
    db.add(row)
    db.flush()
    record_audit(db, actor_id, "modified", record_type, row.id, case_id=case.id, detail={"created": True})
    db.commit()
    return row


def _update(db: Session, actor_id: int | None, model: PeopleModel, record_type: str, row_id: int, changes: dict) -> Any:
    row = get_or_404(db, model, row_id, RECORD_NAMES[record_type])
    apply_update(db, row, changes, record_type=record_type, actor_id=actor_id)
    db.commit()
    return row


def _delete(db: Session, actor_id: int | None, model: PeopleModel, record_type: str, row_id: int) -> None:
    row = get_or_404(db, model, row_id, RECORD_NAMES[record_type])
    delete_relationships_of(db, record_type, row.id)
    delete_links_to(db, record_type, row.id)
    record_audit(db, actor_id, "modified", record_type, row.id, case_id=row.case_id, detail={"deleted": True})
    db.delete(row)
    db.commit()


def _check_building(db: Session, building_id: int | None) -> None:
    if building_id is not None and db.get(Building, building_id) is None:
        raise invalid("building_id", f"Building {building_id} not found")


# Persons


@router.get("/cases/{case_id}/persons", response_model=list[PersonOut])
def list_persons(case_id: int, db: DbSession):
    return _list(db, Person, case_id)


@router.post("/cases/{case_id}/persons", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
def create_person(case_id: int, body: PersonCreate, db: DbSession, actor_id: ActorId):
    return _create(db, actor_id, Person, "person", case_id, body.model_dump())


@router.patch("/persons/{person_id}", response_model=PersonOut)
def update_person(person_id: int, body: PersonUpdate, db: DbSession, actor_id: ActorId):
    return _update(db, actor_id, Person, "person", person_id, body.model_dump(exclude_unset=True))


@router.delete("/persons/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(person_id: int, db: DbSession, actor_id: ActorId):
    _delete(db, actor_id, Person, "person", person_id)


# Objects: vehicles, phones, weapons and other items


@router.get("/cases/{case_id}/objects", response_model=list[CaseObjectOut])
def list_objects(case_id: int, db: DbSession):
    return _list(db, CaseObject, case_id)


@router.post("/cases/{case_id}/objects", response_model=CaseObjectOut, status_code=status.HTTP_201_CREATED)
def create_object(case_id: int, body: CaseObjectCreate, db: DbSession, actor_id: ActorId):
    return _create(db, actor_id, CaseObject, "object", case_id, body.model_dump())


@router.patch("/objects/{object_id}", response_model=CaseObjectOut)
def update_object(object_id: int, body: CaseObjectUpdate, db: DbSession, actor_id: ActorId):
    return _update(db, actor_id, CaseObject, "object", object_id, body.model_dump(exclude_unset=True))


@router.delete("/objects/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_object(object_id: int, db: DbSession, actor_id: ActorId):
    _delete(db, actor_id, CaseObject, "object", object_id)


# Locations


@router.get("/cases/{case_id}/locations", response_model=list[LocationOut])
def list_locations(case_id: int, db: DbSession):
    return _list(db, Location, case_id)


@router.post("/cases/{case_id}/locations", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(case_id: int, body: LocationCreate, db: DbSession, actor_id: ActorId):
    _check_building(db, body.building_id)
    return _create(db, actor_id, Location, "location", case_id, body.model_dump())


@router.patch("/locations/{location_id}", response_model=LocationOut)
def update_location(location_id: int, body: LocationUpdate, db: DbSession, actor_id: ActorId):
    changes = body.model_dump(exclude_unset=True)
    _check_building(db, changes.get("building_id"))
    return _update(db, actor_id, Location, "location", location_id, changes)


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(location_id: int, db: DbSession, actor_id: ActorId):
    _delete(db, actor_id, Location, "location", location_id)
