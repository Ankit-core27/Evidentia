from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, CasePriority, CaseStatus, IncidentType, OrmModel


class Investigator(OrmModel):
    id: int
    name: str
    badge_number: str
    role: str
    clearance_level: str


class Case(OrmModel):
    id: int
    case_number: str
    title: str
    incident_type: IncidentType
    status: CaseStatus
    priority: CasePriority
    description: str
    incident_at: datetime | None
    lead_investigator_id: int | None
    investigator_ids: list[int]
    created_at: datetime
    updated_at: datetime


class CaseListItem(Case):
    """A row of GET /api/cases."""

    evidence_count: int


class CaseCreate(ApiModel):
    title: str = Field(min_length=1, max_length=300)
    incident_type: IncidentType
    priority: CasePriority
    status: CaseStatus = "open"
    description: str = ""
    incident_at: datetime | None = None
    lead_investigator_id: int | None = None
    investigator_ids: list[int] = []


class CaseUpdate(ApiModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    incident_type: IncidentType | None = None
    priority: CasePriority | None = None
    status: CaseStatus | None = None
    description: str | None = None
    incident_at: datetime | None = None
    lead_investigator_id: int | None = None
    investigator_ids: list[int] | None = None


class CaseCounts(OrmModel):
    """Computed by app.core.records.case_counts, never stored."""

    evidence: int
    pending_reviews: int
    open_conflicts: int
    ai_items_total: int
    ai_items_reviewed: int
