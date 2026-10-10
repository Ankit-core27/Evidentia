"""Every table, imported here so Alembic and create_all see the full schema."""

from app.models.audit import AuditLog, Report
from app.models.base import Base
from app.models.case import Case, Investigator
from app.models.evidence import AiRun, Evidence, EvidenceChunk, EvidenceLink
from app.models.reconstruction import Building, Reconstruction, ReconstructionStage, SceneAnnotation, SceneObject
from app.models.records import CaseObject, Conflict, Event, Injury, Location, Observation, Person, Relationship

__all__ = [
    "AiRun",
    "AuditLog",
    "Base",
    "Building",
    "Case",
    "CaseObject",
    "Conflict",
    "Event",
    "Evidence",
    "EvidenceChunk",
    "EvidenceLink",
    "Injury",
    "Investigator",
    "Location",
    "Observation",
    "Person",
    "Reconstruction",
    "ReconstructionStage",
    "Relationship",
    "Report",
    "SceneAnnotation",
    "SceneObject",
]
