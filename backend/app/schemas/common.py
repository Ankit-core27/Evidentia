"""Enum values and base classes shared by every schema module.

The values match the "Contract assumptions" in docs/FRONTEND_TASKS.md and the
hand-written types in frontend/src/types/api.ts. JSON is snake_case.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

CaseStatus = Literal["open", "in_progress", "under_review", "closed"]
CasePriority = Literal["critical", "high", "medium", "low"]
IncidentType = Literal["road_accident", "homicide", "assault", "burglary", "fire", "other"]
EvidenceType = Literal["document", "statement", "photo", "video", "audio", "medical", "other"]
ProcessingStatus = Literal["queued", "processing", "done", "failed"]
Origin = Literal["ai", "investigator"]
ReviewStatus = Literal["pending", "confirmed", "rejected"]
PersonRole = Literal["victim", "witness", "suspect", "other"]
PersonCondition = Literal["uninjured", "injured", "deceased"]
ObjectKind = Literal["vehicle", "phone", "weapon", "item"]
LocationKind = Literal["incident_site", "witness_position", "vehicle_position", "zone", "boundary"]
EventCategory = Literal["collision", "movement", "witness", "emergency", "medical", "investigation", "other"]
TimePrecision = Literal["exact", "minute", "approximate", "day"]
Certainty = Literal["established", "hypothesis", "disputed"]
RelationshipKind = Literal[
    "drove", "owns", "involved_in", "witnessed", "located_at", "mentions", "supports", "contradicts", "other"
]
ConflictStatus = Literal["open", "resolved"]
AuditAction = Literal["uploaded", "viewed", "modified", "reviewed", "exported"]
AnnotationKind = Literal["note", "measurement", "viewpoint"]
InjurySeverity = Literal["minor", "moderate", "severe", "fatal"]
ReportTemplate = Literal["court", "summary", "custody", "medical"]
AlertSeverity = Literal["info", "warning", "critical"]
AlertKind = Literal["conflict", "processing", "review"]

# Record types that relationships, links, observations and audit entries point at.
RecordType = Literal[
    "case",
    "evidence",
    "person",
    "object",
    "location",
    "event",
    "relationship",
    "observation",
    "conflict",
    "injury",
    "reconstruction",
    "stage",
    "scene_object",
    "annotation",
    "report",
]

# Records the graph draws as nodes.
GraphNodeType = Literal["person", "object", "location", "evidence"]


class ApiModel(BaseModel):
    """Base for request bodies: unknown fields are rejected, so typos surface as 422s."""

    model_config = ConfigDict(extra="forbid")


class OrmModel(BaseModel):
    """Base for responses built from SQLAlchemy rows with `Model.model_validate(row)`."""

    model_config = ConfigDict(from_attributes=True)


class Reviewable(OrmModel):
    origin: Origin
    review_status: ReviewStatus
