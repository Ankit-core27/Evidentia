from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import ApiModel, InjurySeverity, Reviewable, ReviewStatus

ReportKind = Literal["medical", "postmortem"]
FindingType = Literal["abnormality", "explicitly_normal", "uncertain"]


class Measurement(ApiModel):
    label: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=200, description="Value and units as written; never convert or estimate.")


class MarkerPlacement(ApiModel):
    structure_id: str = Field(min_length=1, max_length=100)
    local_position: tuple[float, float, float] = Field(description="Metres in the centered structure's local coordinates.")
    location_precision: Literal["exact", "regional", "organ_only"] = "regional"
    placement_origin: Literal["investigator"] = "investigator"
    model_id: Literal["bodyparts3d-3.0-forensix-v1"] = "bodyparts3d-3.0-forensix-v1"

    @model_validator(mode="after")
    def finite_position(self):
        import math
        if not all(math.isfinite(v) and abs(v) <= 2 for v in self.local_position):
            raise ValueError("Marker coordinates must be finite model-local metres within the reference body")
        return self


class MedicalDetails(ApiModel):
    reported_condition: str = Field(default="", max_length=2000)
    measurements: list[Measurement] = Field(default_factory=list, max_length=30)
    anatomical_location: str = Field(default="", max_length=2000)
    location_precision: Literal["regional", "organ_only", "unresolved"] = "unresolved"
    assertion: Literal["documented", "uncertain", "contradictory"] = "documented"
    uncertainty: str = Field(default="", max_length=4000)
    mapping_origin: Literal["ai", "investigator", "model_mapping"] = "model_mapping"
    report_kind: ReportKind | None = None
    marker: MarkerPlacement | None = None


class AnatomyFinding(Reviewable):
    id: int
    case_id: int
    person_id: int | None
    structure_id: str | None
    body_region: str
    finding_type: FindingType
    description: str
    reported_condition: str
    medical_details: MedicalDetails


class AnatomyFindingUpdate(ApiModel):
    review_status: ReviewStatus


class MedicalAnalysisRequest(ApiModel):
    evidence_id: int = Field(gt=0)
    person_id: int = Field(gt=0)
    report_kind: ReportKind


class MedicalProposal(ApiModel):
    person_reference: str = Field(min_length=1, max_length=200)
    anatomical_structure: str | None = Field(default=None, max_length=100)
    body_region: str = Field(min_length=1, max_length=100)
    finding_type: Literal["injury", "abnormality", "explicitly_normal", "uncertain"]
    description: str = Field(min_length=1, max_length=4000)
    injury_type: str | None = Field(default=None, max_length=100)
    measurements: list[Measurement] = Field(default_factory=list, max_length=30)
    injury_severity_if_supported: InjurySeverity | None = None
    reported_condition: str = Field(default="", max_length=2000)
    anatomical_location: str = Field(default="", max_length=2000)
    location_precision: Literal["regional", "organ_only", "unresolved"] = "unresolved"
    supporting_passage: str = Field(min_length=1, max_length=6000)
    assertion: Literal["documented", "uncertain", "contradictory"] = "documented"
    uncertainty: str = Field(default="", max_length=4000)


class MedicalExtraction(ApiModel):
    findings: list[MedicalProposal] = Field(default_factory=list, max_length=50)
    limitations: list[str] = Field(default_factory=list, max_length=20)


class MedicalAnalysisResult(ApiModel):
    created: int
    retained: int
    injury_ids: list[int]
    finding_ids: list[int]
    limitations: list[str]
