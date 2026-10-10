from datetime import datetime

from app.schemas.cases import Investigator
from app.schemas.common import AlertKind, AlertSeverity, CasePriority, CaseStatus, IncidentType, OrmModel, RecordType


class InvestigatorWithStats(Investigator):
    solved_cases: int
    active_cases: int


class IncidentPoint(OrmModel):
    case_id: int
    case_number: str
    title: str
    incident_type: IncidentType
    priority: CasePriority
    address: str
    lat: float
    lng: float
    incident_at: datetime | None


class Dashboard(OrmModel):
    total_cases: int
    active_cases: int
    pending_reviews: int
    storage_bytes: int
    status_counts: dict[CaseStatus, int]
    incident_points: list[IncidentPoint]
    investigators: list[InvestigatorWithStats]


class Alert(OrmModel):
    """Built on the fly from open conflicts, pending reviews and finished processing."""

    # Stable string key, such as "conflict-3" or "review-1".
    id: str
    kind: AlertKind
    severity: AlertSeverity
    title: str
    message: str
    case_id: int
    case_number: str
    record_type: RecordType | None
    record_id: int | None
    created_at: datetime
