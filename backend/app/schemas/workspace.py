from app.schemas.cases import Case, CaseCounts
from app.schemas.common import OrmModel
from app.schemas.evidence import Evidence, EvidenceLink
from app.schemas.graph import Relationship
from app.schemas.injuries import Injury
from app.schemas.people import CaseObject, Location, Person
from app.schemas.timeline import CaseEvent


class CaseWorkspace(OrmModel):
    """GET /api/cases/{id}/workspace: everything the workspace overview needs in one call."""

    case: Case
    persons: list[Person]
    objects: list[CaseObject]
    locations: list[Location]
    evidence: list[Evidence]
    events: list[CaseEvent]
    relationships: list[Relationship]
    injuries: list[Injury]
    # Evidence links of every record in the case, so any record can show its source passage.
    links: list[EvidenceLink]
    counts: CaseCounts
