"""Persons, objects (vehicles, phones, items) and locations."""

from typing import Any

from pydantic import Field

from app.schemas.common import (
    ApiModel,
    LocationKind,
    ObjectKind,
    PersonCondition,
    PersonRole,
    Reviewable,
    ReviewStatus,
)


class Person(Reviewable):
    id: int
    case_id: int
    role: PersonRole
    name: str
    age: int | None
    occupation: str
    condition: PersonCondition | None
    contact: str
    notes: str
    details: dict[str, Any]


class PersonCreate(ApiModel):
    role: PersonRole
    name: str = Field(min_length=1)
    age: int | None = None
    occupation: str = ""
    condition: PersonCondition | None = None
    contact: str = ""
    notes: str = ""
    details: dict[str, Any] = {}


class PersonUpdate(ApiModel):
    role: PersonRole | None = None
    name: str | None = Field(default=None, min_length=1)
    age: int | None = None
    occupation: str | None = None
    condition: PersonCondition | None = None
    contact: str | None = None
    notes: str | None = None
    details: dict[str, Any] | None = None
    review_status: ReviewStatus | None = None


class CaseObject(Reviewable):
    id: int
    case_id: int
    kind: ObjectKind
    label: str
    # plate, number, make, colour, or anything else.
    details: dict[str, Any]


class CaseObjectCreate(ApiModel):
    kind: ObjectKind
    label: str = Field(min_length=1)
    details: dict[str, Any] = {}


class CaseObjectUpdate(ApiModel):
    kind: ObjectKind | None = None
    label: str | None = Field(default=None, min_length=1)
    details: dict[str, Any] | None = None
    review_status: ReviewStatus | None = None


class Location(Reviewable):
    id: int
    case_id: int
    kind: LocationKind
    address: str
    lat: float | None
    lng: float | None
    # GeoJSON geometry for zones and boundaries.
    geometry: dict[str, Any] | None
    building_id: int | None


class LocationCreate(ApiModel):
    kind: LocationKind
    address: str = Field(min_length=1)
    lat: float | None = None
    lng: float | None = None
    geometry: dict[str, Any] | None = None
    building_id: int | None = None


class LocationUpdate(ApiModel):
    kind: LocationKind | None = None
    address: str | None = Field(default=None, min_length=1)
    lat: float | None = None
    lng: float | None = None
    geometry: dict[str, Any] | None = None
    building_id: int | None = None
    review_status: ReviewStatus | None = None
