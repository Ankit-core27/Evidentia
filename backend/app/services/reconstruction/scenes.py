"""Reconstruction helpers: the 422 checks that keep records inside one case, the
ReconstructionDetail payload and the stage placement replacement."""

from collections import defaultdict
from collections.abc import Iterable, Sequence

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.records import delete_links_to
from app.models import Base, Reconstruction, ReconstructionStage, SceneAnnotation, SceneObject
from app.schemas.reconstruction import (
    Reconstruction as ReconstructionOut,
    ReconstructionDetail,
    ReconstructionStage as StageOut,
    SceneAnnotation as SceneAnnotationOut,
    SceneObject as SceneObjectOut,
    SceneObjectInput,
    StageDetail,
)


def invalid(loc: Sequence[str | int], msg: str) -> HTTPException:
    """A 422 in FastAPI's validation error shape, which the frontend shows per field."""
    return HTTPException(status_code=422, detail=[{"loc": ["body", *loc], "msg": msg, "type": "value_error"}])


def missing_from_case(db: Session, model: type[Base], ids: Iterable[int], case_id: int) -> list[int]:
    """The IDs, in the order given, that aren't rows of `model` in this case."""
    wanted = list(dict.fromkeys(ids))
    if not wanted:
        return []
    found = set(db.scalars(select(model.id).where(model.id.in_(wanted), model.case_id == case_id)))
    return [record_id for record_id in wanted if record_id not in found]


def reconstruction_detail(db: Session, reconstruction: Reconstruction) -> ReconstructionDetail:
    """Stages in stage_order, each with its scene objects, plus the annotations."""
    stages = db.scalars(
        select(ReconstructionStage)
        .where(ReconstructionStage.reconstruction_id == reconstruction.id)
        .order_by(ReconstructionStage.stage_order, ReconstructionStage.id)
    ).all()
    placed: dict[int, list[SceneObject]] = defaultdict(list)
    if stages:
        for scene_object in db.scalars(
            select(SceneObject).where(SceneObject.stage_id.in_([s.id for s in stages])).order_by(SceneObject.id)
        ):
            placed[scene_object.stage_id].append(scene_object)
    annotations = db.scalars(
        select(SceneAnnotation)
        .where(SceneAnnotation.reconstruction_id == reconstruction.id)
        .order_by(SceneAnnotation.id)
    ).all()
    return ReconstructionDetail(
        **ReconstructionOut.model_validate(reconstruction).model_dump(),
        stages=[
            StageDetail(
                **StageOut.model_validate(stage).model_dump(),
                scene_objects=[SceneObjectOut.model_validate(o) for o in placed[stage.id]],
            )
            for stage in stages
        ],
        annotations=[SceneAnnotationOut.model_validate(a) for a in annotations],
    )


def replace_scene_objects(
    db: Session, stage: ReconstructionStage, objects: list[SceneObjectInput]
) -> list[SceneObject]:
    """Deletes the stage's placements, with the evidence links to them, and adds the
    new ones. Returns the new rows; the caller commits."""
    old_ids = db.scalars(select(SceneObject.id).where(SceneObject.stage_id == stage.id)).all()
    for old_id in old_ids:
        delete_links_to(db, "scene_object", old_id)
    if old_ids:
        db.execute(delete(SceneObject).where(SceneObject.id.in_(old_ids)))
    rows = [SceneObject(stage_id=stage.id, **o.model_dump(mode="json")) for o in objects]
    db.add_all(rows)
    db.flush()
    return rows
