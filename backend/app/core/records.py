"""Helpers every router uses: lookups, audited updates, cascading deletes and the
computed case counts. Routers add rows and call these, then commit once.

Rules from docs/PLAN.md that live here:
- Every investigator change is an audit_log entry with before and after values.
- Counts and progress are computed, never stored.
- Deleting a person, object, location or evidence also deletes the relationships
  that point at it, and deleting any record deletes the evidence links to it.
"""

from typing import Any, TypeVar

from fastapi import HTTPException
from pydantic_core import to_jsonable_python
from sqlalchemy import and_, delete, func, inspect, or_, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Base,
    Case,
    CaseObject,
    Conflict,
    Event,
    Evidence,
    EvidenceLink,
    Injury,
    Location,
    Observation,
    Person,
    Reconstruction,
    ReconstructionStage,
    Relationship,
    Report,
    SceneAnnotation,
    SceneObject,
)

# Record type names used in evidence links, relationships, observations and the
# audit log (RecordType in app/schemas/common.py), mapped to their tables.
RECORD_MODELS: dict[str, type[Base]] = {
    "case": Case,
    "evidence": Evidence,
    "person": Person,
    "object": CaseObject,
    "location": Location,
    "event": Event,
    "relationship": Relationship,
    "observation": Observation,
    "conflict": Conflict,
    "injury": Injury,
    "reconstruction": Reconstruction,
    "stage": ReconstructionStage,
    "scene_object": SceneObject,
    "annotation": SceneAnnotation,
    "report": Report,
}

# Tables with origin and review_status, whose AI rows feed the review counts.
REVIEWABLE_MODELS: dict[str, type[Base]] = {
    "person": Person,
    "object": CaseObject,
    "location": Location,
    "event": Event,
    "relationship": Relationship,
    "observation": Observation,
    "injury": Injury,
}

ModelT = TypeVar("ModelT", bound=Base)

RECORD_NAMES = {
    "case": "Case",
    "evidence": "Evidence",
    "person": "Person",
    "object": "Object",
    "location": "Location",
    "event": "Event",
    "relationship": "Relationship",
    "observation": "Observation",
    "conflict": "Conflict",
    "injury": "Injury",
    "reconstruction": "Reconstruction",
    "stage": "Stage",
    "scene_object": "Scene object",
    "annotation": "Annotation",
    "report": "Report",
}


def get_or_404(db: Session, model: type[ModelT], record_id: int, name: str | None = None) -> ModelT:
    row = db.get(model, record_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"{name or model.__name__} not found")
    return row


def invalid(field: str, message: str) -> HTTPException:
    """A 422 shaped like FastAPI's own validation errors, for checks the schemas
    can't make (a referenced row that doesn't exist, null for a required field)."""
    return HTTPException(
        status_code=422, detail=[{"loc": ["body", field], "msg": message, "type": "value_error"}]
    )


def record_audit(
    db: Session,
    actor_id: int | None,
    action: str,
    record_type: str,
    record_id: int,
    *,
    case_id: int | None = None,
    detail: dict[str, Any] | None = None,
) -> AuditLog:
    """Adds an audit_log row to the session; the caller commits.

    action is one of uploaded, viewed, modified, reviewed, exported. Pass case_id
    whenever the record belongs to a case, so it shows in GET /cases/{id}/audit.
    """
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        record_type=record_type,
        record_id=record_id,
        case_id=case_id,
        detail=to_jsonable_python(detail) if detail is not None else None,
    )
    db.add(entry)
    return entry


def apply_update(
    db: Session,
    row: Base,
    changes: dict[str, Any],
    *,
    record_type: str,
    actor_id: int | None,
    case_id: int | None = None,
) -> dict[str, dict[str, Any]]:
    """Applies a PATCH body (`schema.model_dump(exclude_unset=True)`) to a row and
    writes one audit entry with the before and after value of each changed field.
    A change to review_status alone is logged as "reviewed", anything else as
    "modified". Null for a column that can't be null is a 422, since the update
    schemas allow null on every optional field. Returns the changes; the caller
    commits."""
    columns = inspect(row).mapper.columns
    for field, after in changes.items():
        if after is None and field in columns and not columns[field].nullable:
            raise invalid(field, "Field can't be null")

    diff: dict[str, dict[str, Any]] = {}
    for field, after in changes.items():
        before = getattr(row, field)
        if to_jsonable_python(before) == to_jsonable_python(after):
            continue
        diff[field] = {"before": before, "after": after}
        setattr(row, field, after)
    if diff:
        action = "reviewed" if set(diff) == {"review_status"} else "modified"
        if case_id is None:
            case_id = getattr(row, "case_id", None)
        record_audit(db, actor_id, action, record_type, row.id, case_id=case_id, detail=diff)
    return diff


def delete_links_to(db: Session, record_type: str, record_id: int) -> None:
    """Removes the evidence links that point at a record."""
    db.execute(
        delete(EvidenceLink).where(EvidenceLink.target_type == record_type, EvidenceLink.target_id == record_id)
    )


def delete_relationships_of(db: Session, node_type: str, node_id: int) -> None:
    """Removes the relationships that start or end at a graph node, and their links."""
    touches = or_(
        and_(Relationship.from_type == node_type, Relationship.from_id == node_id),
        and_(Relationship.to_type == node_type, Relationship.to_id == node_id),
    )
    ids = db.scalars(select(Relationship.id).where(touches)).all()
    if ids:
        db.execute(
            delete(EvidenceLink).where(EvidenceLink.target_type == "relationship", EvidenceLink.target_id.in_(ids))
        )
        db.execute(delete(Relationship).where(Relationship.id.in_(ids)))


def case_counts(db: Session, case_id: int) -> dict[str, int]:
    """The computed counts on the workspace call (CaseCounts in the schemas)."""
    total = reviewed = pending = 0
    for model in REVIEWABLE_MODELS.values():
        rows = db.execute(
            select(model.review_status, func.count())
            .where(model.case_id == case_id, model.origin == "ai")
            .group_by(model.review_status)
        ).all()
        for status, count in rows:
            total += count
            if status == "pending":
                pending += count
            else:
                reviewed += count
    evidence = db.scalar(select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id)) or 0
    open_conflicts = (
        db.scalar(
            select(func.count()).select_from(Conflict).where(Conflict.case_id == case_id, Conflict.status == "open")
        )
        or 0
    )
    return {
        "evidence": evidence,
        "pending_reviews": pending,
        "open_conflicts": open_conflicts,
        "ai_items_total": total,
        "ai_items_reviewed": reviewed,
    }
