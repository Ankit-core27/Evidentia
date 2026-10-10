from pydantic import Field

from app.schemas.common import ApiModel, GraphNodeType, OrmModel, RelationshipKind, Reviewable, ReviewStatus


class Relationship(Reviewable):
    id: int
    case_id: int
    from_type: GraphNodeType
    from_id: int
    to_type: GraphNodeType
    to_id: int
    kind: RelationshipKind
    label: str
    confidence: float | None
    flagged: bool
    notes: str


class RelationshipCreate(ApiModel):
    from_type: GraphNodeType
    from_id: int
    to_type: GraphNodeType
    to_id: int
    kind: RelationshipKind
    label: str = ""
    confidence: float | None = Field(default=None, ge=0, le=1)
    flagged: bool = False
    notes: str = ""


class RelationshipUpdate(ApiModel):
    kind: RelationshipKind | None = None
    label: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    flagged: bool | None = None
    notes: str | None = None
    review_status: ReviewStatus | None = None


class GraphNode(OrmModel):
    # f"{type}:{record_id}", such as "person:3".
    id: str
    type: GraphNodeType
    record_id: int
    label: str
    sublabel: str | None
    review_status: ReviewStatus


class GraphEdge(OrmModel):
    # f"relationship:{relationship_id}".
    id: str
    relationship_id: int
    source: str
    target: str
    kind: RelationshipKind
    label: str
    confidence: float | None
    flagged: bool
    review_status: ReviewStatus


class CaseGraph(OrmModel):
    """GET /api/cases/{id}/graph. No positions: the frontend lays the graph out."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]
