from datetime import datetime

from app.schemas.cases import Case
from app.schemas.common import ApiModel, EvidenceType, OrmModel, ReportTemplate
from app.schemas.evidence import AuditEntry
from app.schemas.injuries import Injury
from app.schemas.people import Person
from app.schemas.timeline import CaseEvent


class ReportOptions(ApiModel):
    include_ai_insights: bool = False
    include_custody: bool = False


class ReportCreate(ApiModel):
    template: ReportTemplate
    options: ReportOptions = ReportOptions()


class ReportCase(Case):
    lead_investigator_name: str | None


class ReportEvidence(OrmModel):
    id: int
    title: str
    type: EvidenceType
    sha256: str
    size_bytes: int
    collected_at: datetime | None


class ConfirmedFinding(OrmModel):
    statement: str
    evidence_ids: list[int]


class OpenConflict(OrmModel):
    description: str
    statements: list[str]


class ReportScenario(OrmModel):
    scenario: str
    version: int
    assumptions: str


class ReportContent(OrmModel):
    case: ReportCase
    summary: str
    evidence: list[ReportEvidence]
    timeline: list[CaseEvent]
    persons: list[Person]
    confirmed_findings: list[ConfirmedFinding]
    open_conflicts: list[OpenConflict]
    uncertainties: list[str]
    reconstructions: list[ReportScenario]
    injuries: list[Injury]
    # Null when the option is off.
    ai_insights: list[str] | None
    custody: list[AuditEntry] | None


class ReportListItem(OrmModel):
    """A row of GET /api/cases/{id}/reports (added to the contract by the frontend)."""

    id: int
    case_id: int
    template: ReportTemplate
    options: ReportOptions
    sha256: str
    created_by: int | None
    created_at: datetime


class Report(ReportListItem):
    content: ReportContent
