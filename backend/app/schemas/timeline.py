from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, Certainty, EventCategory, Reviewable, ReviewStatus, TimePrecision


class CaseEvent(Reviewable):
    id: int
    case_id: int
    location_id: int | None
    category: EventCategory
    time_start: datetime | None
    time_end: datetime | None
    time_precision: TimePrecision
    certainty: Certainty
    description: str
    ai_note: str | None


class CaseEventCreate(ApiModel):
    category: EventCategory
    description: str = Field(min_length=1)
    location_id: int | None = None
    time_start: datetime | None = None
    time_end: datetime | None = None
    time_precision: TimePrecision = "minute"
    certainty: Certainty = "established"
    ai_note: str | None = None


class CaseEventUpdate(ApiModel):
    category: EventCategory | None = None
    description: str | None = Field(default=None, min_length=1)
    location_id: int | None = None
    time_start: datetime | None = None
    time_end: datetime | None = None
    time_precision: TimePrecision | None = None
    certainty: Certainty | None = None
    ai_note: str | None = None
    review_status: ReviewStatus | None = None
