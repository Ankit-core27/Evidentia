"""Graph routes, task B3 in docs/BACKEND_TASKS.md:

- GET /api/cases/{id}/graph
- POST /api/cases/{id}/relationships
- PATCH, DELETE /api/relationships/{id}
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import ActorId, DbSession
from app.core.records import RECORD_MODELS, RECORD_NAMES, apply_update, delete_links_to, get_or_404, record_audit
from app.models import Case, CaseObject, Evidence, Location, Person, Relationship
from app.schemas.graph import CaseGraph, GraphEdge, GraphNode, RelationshipCreate, RelationshipUpdate
from app.schemas.graph import Relationship as RelationshipOut

router = APIRouter(tags=["graph"])


def humanize(key: str | None) -> str:
    """As humanize() in frontend/src/lib/format.ts: "involved_in" becomes "Involved in"."""
    if not key:
        return ""
    text = key.replace("_", " ")
    return text[0].upper() + text[1:]


def _node(type_: str, record_id: int, label: str, sublabel: str | None, review_status: str) -> GraphNode:
    return GraphNode(
        id=f"{type_}:{record_id}",
        type=type_,
        record_id=record_id,
        label=label,
        sublabel=sublabel,
        review_status=review_status,
    )


@router.get("/cases/{case_id}/graph", response_model=CaseGraph)
def get_graph(case_id: int, db: DbSession):
    """Every person and object is a node; locations and evidence only when a
    relationship touches them. Edges only where both ends are nodes."""
    case = get_or_404(db, Case, case_id)
    relationships = db.scalars(
        select(Relationship).where(Relationship.case_id == case.id).order_by(Relationship.id)
    ).all()
    referenced = {(r.from_type, r.from_id) for r in relationships} | {(r.to_type, r.to_id) for r in relationships}

    def referenced_ids(type_: str) -> list[int]:
        return [record_id for node_type, record_id in referenced if node_type == type_]

    persons = db.scalars(select(Person).where(Person.case_id == case.id).order_by(Person.id))
    objects = db.scalars(select(CaseObject).where(CaseObject.case_id == case.id).order_by(CaseObject.id))
    locations = db.scalars(
        select(Location)
        .where(Location.case_id == case.id, Location.id.in_(referenced_ids("location")))
        .order_by(Location.id)
    )
    evidence = db.scalars(
        select(Evidence)
        .where(Evidence.case_id == case.id, Evidence.id.in_(referenced_ids("evidence")))
        .order_by(Evidence.id)
    )

    nodes = [
        *(
            _node("person", p.id, p.name, ", ".join(filter(None, [humanize(p.role), p.condition])), p.review_status)
            for p in persons
        ),
        *(
            _node("object", o.id, o.label, str((o.details or {}).get("plate") or humanize(o.kind)), o.review_status)
            for o in objects
        ),
        *(_node("location", loc.id, loc.address, humanize(loc.kind), loc.review_status) for loc in locations),
        *(_node("evidence", e.id, e.title, humanize(e.type), "confirmed") for e in evidence),
    ]
    node_ids = {node.id for node in nodes}
    edges = [
        GraphEdge(
            id=f"relationship:{r.id}",
            relationship_id=r.id,
            source=f"{r.from_type}:{r.from_id}",
            target=f"{r.to_type}:{r.to_id}",
            kind=r.kind,
            label=r.label,
            confidence=r.confidence,
            flagged=r.flagged,
            review_status=r.review_status,
        )
        for r in relationships
        if f"{r.from_type}:{r.from_id}" in node_ids and f"{r.to_type}:{r.to_id}" in node_ids
    ]
    return CaseGraph(nodes=nodes, edges=edges)


def _require_node_in_case(db: Session, case_id: int, node_type: str, node_id: int, field: str) -> None:
    row = db.get(RECORD_MODELS[node_type], node_id)
    if row is None or row.case_id != case_id:
        raise HTTPException(
            status_code=422,
            detail=[
                {"loc": ["body", field], "msg": f"{RECORD_NAMES[node_type]} not found in this case", "type": "value_error"}
            ],
        )


@router.post("/cases/{case_id}/relationships", response_model=RelationshipOut, status_code=status.HTTP_201_CREATED)
def create_relationship(case_id: int, body: RelationshipCreate, db: DbSession, actor_id: ActorId):
    case = get_or_404(db, Case, case_id)
    _require_node_in_case(db, case.id, body.from_type, body.from_id, "from_id")
    _require_node_in_case(db, case.id, body.to_type, body.to_id, "to_id")
    values = body.model_dump()
    if not values["label"].strip():
        values["label"] = humanize(body.kind)
    relationship = Relationship(case_id=case.id, **values)
    db.add(relationship)
    db.flush()
    record_audit(db, actor_id, "modified", "relationship", relationship.id, case_id=case.id, detail={"created": True})
    db.commit()
    return relationship


@router.patch("/relationships/{relationship_id}", response_model=RelationshipOut)
def update_relationship(relationship_id: int, body: RelationshipUpdate, db: DbSession, actor_id: ActorId):
    relationship = get_or_404(db, Relationship, relationship_id)
    apply_update(db, relationship, body.model_dump(exclude_unset=True), record_type="relationship", actor_id=actor_id)
    db.commit()
    return relationship


@router.delete("/relationships/{relationship_id}", response_model=None, status_code=status.HTTP_204_NO_CONTENT)
def delete_relationship(relationship_id: int, db: DbSession, actor_id: ActorId) -> None:
    relationship = get_or_404(db, Relationship, relationship_id)
    delete_links_to(db, "relationship", relationship.id)
    db.delete(relationship)
    record_audit(
        db, actor_id, "modified", "relationship", relationship_id, case_id=relationship.case_id, detail={"deleted": True}
    )
    db.commit()
