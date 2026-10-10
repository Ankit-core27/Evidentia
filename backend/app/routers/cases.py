"""Cases routes (task B1 in docs/BACKEND_TASKS.md):

- GET /api/investigators
- GET, POST /api/cases?q=&status=&priority=
- GET, PATCH /api/cases/{id}
- GET /api/cases/{id}/workspace
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import ActorId, DbSession
from app.core.records import apply_update, case_counts, get_or_404, invalid, record_audit
from app.models import (
    Case,
    CaseObject,
    Event,
    Evidence,
    EvidenceLink,
    Injury,
    Investigator,
    Location,
    Person,
    Relationship,
)
from app.schemas.cases import Case as CaseOut
from app.schemas.cases import CaseCreate, CaseListItem, CaseUpdate
from app.schemas.cases import Investigator as InvestigatorOut
from app.schemas.common import CasePriority, CaseStatus
from app.schemas.workspace import CaseWorkspace

router = APIRouter(tags=["cases"])


def _check_investigators(db: Session, lead_investigator_id: int | None, investigator_ids: list[int] | None) -> None:
    if lead_investigator_id is not None and db.get(Investigator, lead_investigator_id) is None:
        raise invalid("lead_investigator_id", f"Investigator {lead_investigator_id} not found")
    if investigator_ids:
        known = set(db.scalars(select(Investigator.id).where(Investigator.id.in_(investigator_ids))))
        missing = [i for i in investigator_ids if i not in known]
        if missing:
            raise invalid("investigator_ids", f"Investigators not found: {', '.join(map(str, missing))}")


@router.get("/investigators", response_model=list[InvestigatorOut])
def list_investigators(db: DbSession):
    return db.scalars(select(Investigator).order_by(Investigator.id)).all()


@router.get("/cases", response_model=list[CaseListItem])
def list_cases(
    db: DbSession,
    q: str | None = None,
    case_status: Annotated[CaseStatus | None, Query(alias="status")] = None,
    priority: CasePriority | None = None,
):
    evidence_count = (
        select(func.count()).where(Evidence.case_id == Case.id).correlate(Case).scalar_subquery().label("evidence_count")
    )
    query = select(Case, evidence_count).order_by(Case.created_at.desc(), Case.id.desc())
    if case_status:
        query = query.where(Case.status == case_status)
    if priority:
        query = query.where(Case.priority == priority)
    q = (q or "").strip()
    if q:
        query = query.where(
            or_(
                Case.case_number.icontains(q, autoescape=True),
                Case.title.icontains(q, autoescape=True),
                Case.description.icontains(q, autoescape=True),
                exists().where(
                    Investigator.id == Case.lead_investigator_id, Investigator.name.icontains(q, autoescape=True)
                ),
                exists().where(Location.case_id == Case.id, Location.address.icontains(q, autoescape=True)),
                exists().where(Person.case_id == Case.id, Person.name.icontains(q, autoescape=True)),
            )
        )
    return [
        CaseListItem(**CaseOut.model_validate(case).model_dump(), evidence_count=count)
        for case, count in db.execute(query).all()
    ]


@router.post("/cases", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(body: CaseCreate, db: DbSession, actor_id: ActorId):
    _check_investigators(db, body.lead_investigator_id, body.investigator_ids)
    # case_number is unique and built from the id, so insert under a placeholder first.
    case = Case(case_number=f"pending-{uuid.uuid4().hex}", **body.model_dump())
    db.add(case)
    db.flush()
    case.case_number = f"FX-{case.created_at.year}-{case.id:04d}"
    record_audit(db, actor_id, "modified", "case", case.id, case_id=case.id, detail={"created": True})
    db.commit()
    return case


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(case_id: int, db: DbSession):
    return get_or_404(db, Case, case_id)


@router.patch("/cases/{case_id}", response_model=CaseOut)
def update_case(case_id: int, body: CaseUpdate, db: DbSession, actor_id: ActorId):
    case = get_or_404(db, Case, case_id)
    changes = body.model_dump(exclude_unset=True)
    _check_investigators(db, changes.get("lead_investigator_id"), changes.get("investigator_ids"))
    # The model's onupdate bumps updated_at when anything changed.
    apply_update(db, case, changes, record_type="case", actor_id=actor_id, case_id=case.id)
    db.commit()
    return case


@router.get("/cases/{case_id}/workspace", response_model=CaseWorkspace)
def get_workspace(case_id: int, db: DbSession):
    case = get_or_404(db, Case, case_id)

    def rows(model):
        return db.scalars(select(model).where(model.case_id == case.id).order_by(model.id)).all()

    links = db.scalars(
        select(EvidenceLink)
        .join(Evidence, Evidence.id == EvidenceLink.evidence_id)
        .where(Evidence.case_id == case.id)
        .order_by(EvidenceLink.id)
    ).all()
    return {
        "case": case,
        "persons": rows(Person),
        "objects": rows(CaseObject),
        "locations": rows(Location),
        "evidence": rows(Evidence),
        "events": rows(Event),
        "relationships": rows(Relationship),
        "injuries": rows(Injury),
        "links": links,
        "counts": case_counts(db, case.id),
    }
