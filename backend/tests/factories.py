"""Small row builders for tests. Each adds, commits and returns the row; pass any
column as a keyword to override the default. Add builders for other tables in your
own test module rather than here, to keep this file conflict-free."""

from datetime import UTC, datetime
from typing import TypeVar

from sqlalchemy.orm import Session

from app.models import Case, CaseObject, Event, Evidence, Investigator, Location, Observation, Person


T = TypeVar("T")


def _save(db: Session, row: T) -> T:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def make_investigator(db: Session, **fields) -> Investigator:
    values = {"name": "Insp. Meera Rao", "badge_number": "TP-1042", "role": "Lead investigator", "clearance_level": "L3"}
    return _save(db, Investigator(**(values | fields)))


def make_case(db: Session, **fields) -> Case:
    number = fields.pop("case_number", None)
    values = {
        "title": "Ring Road junction collision",
        "incident_type": "road_accident",
        "status": "open",
        "priority": "high",
        "description": "Car and delivery van collide at a signal-controlled junction.",
        "incident_at": datetime(2026, 10, 3, 16, 10, tzinfo=UTC),
        "investigator_ids": [],
    }
    case = Case(case_number=number or "FX-PENDING", **(values | fields))
    case = _save(db, case)
    if number is None:
        case.case_number = f"FX-2026-{case.id:04d}"
        db.commit()
    return case


def make_evidence(db: Session, case: Case, **fields) -> Evidence:
    values = {
        "type": "document",
        "title": "Police report.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1024,
        "sha256": "0" * 64,
        "processing_status": "done",
    }
    return _save(db, Evidence(case_id=case.id, **(values | fields)))


def make_person(db: Session, case: Case, **fields) -> Person:
    values = {"role": "witness", "name": "Anita Desai"}
    return _save(db, Person(case_id=case.id, **(values | fields)))


def make_object(db: Session, case: Case, **fields) -> CaseObject:
    values = {"kind": "vehicle", "label": "White hatchback", "details": {"plate": "KA-01-AB-1234"}}
    return _save(db, CaseObject(case_id=case.id, **(values | fields)))


def make_location(db: Session, case: Case, **fields) -> Location:
    values = {"kind": "incident_site", "address": "Ring Road and 5th Avenue", "lat": 12.9716, "lng": 77.5946}
    return _save(db, Location(case_id=case.id, **(values | fields)))


def make_event(db: Session, case: Case, **fields) -> Event:
    values = {"category": "collision", "description": "The van strikes the hatchback."}
    return _save(db, Event(case_id=case.id, **(values | fields)))


def make_observation(db: Session, case: Case, **fields) -> Observation:
    values = {"subject_type": "case", "subject_id": case.id, "statement": "The light was amber."}
    return _save(db, Observation(case_id=case.id, **(values | fields)))
