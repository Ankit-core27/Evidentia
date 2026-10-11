"""Reconstruction routes (task B4 in docs/BACKEND_TASKS.md):

- GET, POST /api/cases/{id}/reconstructions
- POST /api/cases/{id}/reconstructions/generate: scenarios generated from the evidence
- GET /api/reconstructions/{id}
- POST /api/reconstructions/{id}/stages
- PUT /api/stages/{id}/scene-objects
- GET, POST /api/reconstructions/{id}/annotations
"""

from typing import Annotated

from fastapi import APIRouter, Body, status
from sqlalchemy import func, select

from app.core.deps import ActorId, DbSession
from app.core.records import get_or_404, record_audit
from app.models import Case, CaseObject, Event, Reconstruction, ReconstructionStage, SceneAnnotation
from app.schemas.reconstruction import (
    Reconstruction as ReconstructionOut,
    ReconstructionCreate,
    ReconstructionDetail,
    ReconstructionStage as StageOut,
    SceneAnnotation as SceneAnnotationOut,
    SceneAnnotationCreate,
    SceneGenerateRequest,
    SceneGeneration,
    SceneObject as SceneObjectOut,
    SceneObjectInput,
    StageCreate,
)
from app.services.reconstruction.generate import generate_reconstructions
from app.services.reconstruction.scenes import (
    invalid,
    missing_from_case,
    reconstruction_detail,
    replace_scene_objects,
)

router = APIRouter(tags=["reconstruction"])


@router.get("/cases/{case_id}/reconstructions", response_model=list[ReconstructionOut])
def list_reconstructions(case_id: int, db: DbSession):
    case = get_or_404(db, Case, case_id)
    return db.scalars(select(Reconstruction).where(Reconstruction.case_id == case.id).order_by(Reconstruction.id)).all()


@router.post("/cases/{case_id}/reconstructions", response_model=ReconstructionOut, status_code=status.HTTP_201_CREATED)
def create_reconstruction(case_id: int, body: ReconstructionCreate, db: DbSession, actor_id: ActorId):
    case = get_or_404(db, Case, case_id)
    reconstruction = Reconstruction(case_id=case.id, version=1, **body.model_dump())
    db.add(reconstruction)
    db.flush()
    record_audit(
        db, actor_id, "modified", "reconstruction", reconstruction.id, case_id=case.id, detail={"created": True}
    )
    db.commit()
    return reconstruction


@router.post(
    "/cases/{case_id}/reconstructions/generate",
    response_model=SceneGeneration,
    status_code=status.HTTP_201_CREATED,
)
def generate_reconstruction(
    case_id: int,
    db: DbSession,
    actor_id: ActorId,
    body: Annotated[SceneGenerateRequest | None, Body()] = None,
):
    """Reads the case's evidence and records, writes a scene script (with Gemini, or
    from the records without a key) and saves one reconstruction per scenario."""
    case = get_or_404(db, Case, case_id)
    result = generate_reconstructions(
        db, case, instructions=body.instructions if body else "", actor_id=actor_id
    )
    return SceneGeneration(
        generator=result.generator,
        model=result.model,
        script=result.script,
        warnings=result.warnings,
        reconstructions=[ReconstructionOut.model_validate(r) for r in result.reconstructions],
    )


@router.get("/reconstructions/{reconstruction_id}", response_model=ReconstructionDetail)
def get_reconstruction(reconstruction_id: int, db: DbSession):
    reconstruction = get_or_404(db, Reconstruction, reconstruction_id)
    return reconstruction_detail(db, reconstruction)


@router.post(
    "/reconstructions/{reconstruction_id}/stages", response_model=StageOut, status_code=status.HTTP_201_CREATED
)
def create_stage(reconstruction_id: int, body: StageCreate, db: DbSession, actor_id: ActorId):
    reconstruction = get_or_404(db, Reconstruction, reconstruction_id)
    missing = missing_from_case(db, Event, body.event_ids, reconstruction.case_id)
    if missing:
        raise invalid(["event_ids"], f"Events not in this case: {', '.join(map(str, missing))}")
    stage_order = body.stage_order
    if stage_order is None:
        last = db.scalar(
            select(func.max(ReconstructionStage.stage_order)).where(
                ReconstructionStage.reconstruction_id == reconstruction.id
            )
        )
        stage_order = (last or 0) + 1
    stage = ReconstructionStage(
        reconstruction_id=reconstruction.id, stage_order=stage_order, label=body.label, event_ids=body.event_ids
    )
    db.add(stage)
    db.flush()
    record_audit(db, actor_id, "modified", "stage", stage.id, case_id=reconstruction.case_id, detail={"created": True})
    db.commit()
    return stage


@router.put("/stages/{stage_id}/scene-objects", response_model=list[SceneObjectOut])
def put_scene_objects(stage_id: int, body: list[SceneObjectInput], db: DbSession, actor_id: ActorId):
    stage = get_or_404(db, ReconstructionStage, stage_id, "Stage")
    case_id = db.get(Reconstruction, stage.reconstruction_id).case_id
    object_ids = [o.object_id for o in body if o.object_id is not None]
    missing = set(missing_from_case(db, CaseObject, object_ids, case_id))
    for index, scene_object in enumerate(body):
        if scene_object.object_id in missing:
            raise invalid([index, "object_id"], f"Object {scene_object.object_id} is not in this case")
    placed = replace_scene_objects(db, stage, body)
    record_audit(db, actor_id, "modified", "stage", stage.id, case_id=case_id, detail={"scene_objects": len(placed)})
    db.commit()
    return placed


@router.get("/reconstructions/{reconstruction_id}/annotations", response_model=list[SceneAnnotationOut])
def list_annotations(reconstruction_id: int, db: DbSession):
    reconstruction = get_or_404(db, Reconstruction, reconstruction_id)
    return db.scalars(
        select(SceneAnnotation)
        .where(SceneAnnotation.reconstruction_id == reconstruction.id)
        .order_by(SceneAnnotation.id)
    ).all()


@router.post(
    "/reconstructions/{reconstruction_id}/annotations",
    response_model=SceneAnnotationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_annotation(reconstruction_id: int, body: SceneAnnotationCreate, db: DbSession, actor_id: ActorId):
    reconstruction = get_or_404(db, Reconstruction, reconstruction_id)
    if body.stage_id is not None:
        stage = db.get(ReconstructionStage, body.stage_id)
        if stage is None or stage.reconstruction_id != reconstruction.id:
            raise invalid(["stage_id"], f"Stage {body.stage_id} is not in this reconstruction")
    annotation = SceneAnnotation(reconstruction_id=reconstruction.id, **body.model_dump())
    db.add(annotation)
    db.flush()
    record_audit(
        db,
        actor_id,
        "modified",
        "annotation",
        annotation.id,
        case_id=reconstruction.case_id,
        detail={"created": True},
    )
    db.commit()
    return annotation
