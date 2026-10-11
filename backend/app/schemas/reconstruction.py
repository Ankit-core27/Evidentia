from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import AnnotationKind, ApiModel, Origin, OrmModel
from app.services.reconstruction.script import SceneScript

Vec3 = tuple[float, float, float]


class Reconstruction(OrmModel):
    id: int
    case_id: int
    scenario: str
    version: int
    assumptions: str
    scene_file: str | None
    origin: Origin


class ReconstructionCreate(ApiModel):
    scenario: str = Field(min_length=1)
    assumptions: str = ""
    scene_file: str | None = None


class SceneObject(OrmModel):
    id: int
    stage_id: int
    model_id: str
    object_id: int | None
    label: str
    # Metres.
    position: Vec3
    # Radians.
    rotation: Vec3
    scale: Vec3


class SceneObjectInput(ApiModel):
    """One placement in PUT /api/stages/{id}/scene-objects, which replaces the stage's list."""

    model_id: str = Field(min_length=1)
    object_id: int | None = None
    label: str = ""
    position: Vec3 = (0.0, 0.0, 0.0)
    rotation: Vec3 = (0.0, 0.0, 0.0)
    scale: Vec3 = (1.0, 1.0, 1.0)


class ReconstructionStage(OrmModel):
    id: int
    reconstruction_id: int
    stage_order: int
    label: str
    event_ids: list[int]


class StageCreate(ApiModel):
    label: str = Field(min_length=1)
    # Defaults to after the last stage.
    stage_order: int | None = None
    event_ids: list[int] = []


class StageDetail(ReconstructionStage):
    scene_objects: list[SceneObject]


class SceneAnnotation(OrmModel):
    id: int
    reconstruction_id: int
    stage_id: int | None
    kind: AnnotationKind
    data: dict[str, Any]


class SceneAnnotationCreate(ApiModel):
    stage_id: int | None = None
    kind: AnnotationKind
    data: dict[str, Any] = {}


class ReconstructionDetail(Reconstruction):
    """GET /api/reconstructions/{id}."""

    # The generated scene layout, in the format of an authored scene file.
    scene: dict[str, Any] | None
    stages: list[StageDetail]
    annotations: list[SceneAnnotation]
    # Changes to the case's evidence and records since this scenario was generated
    # (or created): uploads, processed evidence, edits, reviews and deletions. A
    # scenario is a snapshot, so these don't move its scene until it is regenerated.
    case_changes_since: int = 0
    last_case_change_at: datetime | None = None


class SceneGenerateRequest(ApiModel):
    """POST /api/cases/{id}/reconstructions/generate."""

    # Optional guidance for Gemini, such as "Show the van driver's account".
    instructions: str = Field("", max_length=2000)


class SceneGeneration(BaseModel):
    # "gemini" when Gemini wrote the script, "rules" for the draft made without it.
    generator: Literal["gemini", "rules"]
    model: str
    script: SceneScript
    # What the checks dropped or changed, and why Gemini wasn't used if it wasn't.
    warnings: list[str]
    # One per scenario in the script.
    reconstructions: list[Reconstruction]
