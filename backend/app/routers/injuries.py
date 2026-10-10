"""Injuries routes (task B4 in docs/BACKEND_TASKS.md):

- GET, POST /api/cases/{id}/injuries
- PATCH /api/injuries/{id}
"""

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import ActorId, DbSession
from app.core.records import apply_update, get_or_404, record_audit
from app.models import Case, Injury, Person
from app.schemas.injuries import Injury as InjuryOut, InjuryCreate, InjuryUpdate
from app.services.reconstruction.scenes import invalid, missing_from_case

router = APIRouter(tags=["injuries"])


def _check_person(db: Session, person_id: int | None, case_id: int) -> None:
    if person_id is not None and missing_from_case(db, Person, [person_id], case_id):
        raise invalid(["person_id"], f"Person {person_id} is not in this case")


@router.get("/cases/{case_id}/injuries", response_model=list[InjuryOut])
def list_injuries(case_id: int, db: DbSession):
    case = get_or_404(db, Case, case_id)
    return db.scalars(select(Injury).where(Injury.case_id == case.id).order_by(Injury.id)).all()


@router.post("/cases/{case_id}/injuries", response_model=InjuryOut, status_code=status.HTTP_201_CREATED)
def create_injury(case_id: int, body: InjuryCreate, db: DbSession, actor_id: ActorId):
    case = get_or_404(db, Case, case_id)
    _check_person(db, body.person_id, case.id)
    injury = Injury(case_id=case.id, **body.model_dump())
    db.add(injury)
    db.flush()
    record_audit(db, actor_id, "modified", "injury", injury.id, case_id=case.id, detail={"created": True})
    db.commit()
    # Reload so estimated_time comes back in UTC, as stored, not in the offset sent.
    db.refresh(injury)
    return injury


@router.patch("/injuries/{injury_id}", response_model=InjuryOut)
def update_injury(injury_id: int, body: InjuryUpdate, db: DbSession, actor_id: ActorId):
    injury = get_or_404(db, Injury, injury_id)
    changes = body.model_dump(exclude_unset=True)
    _check_person(db, changes.get("person_id"), injury.case_id)
    apply_update(db, injury, changes, record_type="injury", actor_id=actor_id)
    db.commit()
    db.refresh(injury)
    return injury
