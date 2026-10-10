from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, ConflictStatus, OrmModel, RecordType, Reviewable, ReviewStatus


class Observation(Reviewable):
    id: int
    case_id: int
    subject_type: RecordType
    subject_id: int
    statement: str
    observed_at: datetime | None
    author_id: int | None


class ObservationUpdate(ApiModel):
    statement: str | None = Field(default=None, min_length=1)
    review_status: ReviewStatus | None = None


class Conflict(OrmModel):
    id: int
    case_id: int
    observation_ids: list[int]
    description: str
    status: ConflictStatus


class ConflictUpdate(ApiModel):
    status: ConflictStatus
