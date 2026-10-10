from typing import Any

from pydantic import Field

from app.schemas.common import AnnotationKind, ApiModel, OrmModel

Vec3 = tuple[float, float, float]


class Reconstruction(OrmModel):
    id: int
    case_id: int
    scenario: str
    version: int
    assumptions: str
    scene_file: str | None


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

    stages: list[StageDetail]
    annotations: list[SceneAnnotation]
