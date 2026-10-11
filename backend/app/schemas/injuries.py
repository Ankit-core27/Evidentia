from datetime import datetime

from pydantic import Field

from app.schemas.anatomy import MedicalDetails
from app.schemas.common import ApiModel, InjurySeverity, Reviewable, ReviewStatus


class Injury(Reviewable):
    id: int
    case_id: int
    person_id: int | None
    body_region: str
    structure_id: str | None
    type: str
    severity: InjurySeverity
    depth: str | None
    estimated_time: datetime | None
    description: str
    medical_details: MedicalDetails = Field(default_factory=MedicalDetails)


class InjuryCreate(ApiModel):
    body_region: str = Field(min_length=1)
    type: str = Field(min_length=1)
    severity: InjurySeverity
    person_id: int | None = None
    structure_id: str | None = None
    depth: str | None = None
    estimated_time: datetime | None = None
    description: str = ""
    medical_details: MedicalDetails = Field(default_factory=MedicalDetails)


class InjuryUpdate(ApiModel):
    """For PATCH /api/injuries/{id}, added because injuries are AI proposals too."""

    body_region: str | None = Field(default=None, min_length=1)
    type: str | None = Field(default=None, min_length=1)
    severity: InjurySeverity | None = None
    person_id: int | None = None
    structure_id: str | None = None
    depth: str | None = None
    estimated_time: datetime | None = None
    description: str | None = None
    review_status: ReviewStatus | None = None
    medical_details: MedicalDetails | None = None
