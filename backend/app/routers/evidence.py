"""Evidence routes (task B2 in docs/BACKEND_TASKS.md): uploads, evidence records,
the original files, evidence links and the integrity check."""

from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select

from app.core.deps import ActorId, DbSession
from app.core.records import RECORD_MODELS, RECORD_NAMES, apply_update, get_or_404, record_audit
from app.core.storage import absolute_path
from app.models import AuditLog, Case, Evidence, EvidenceChunk, EvidenceLink
from app.schemas.common import EvidenceType
from app.schemas.evidence import Evidence as EvidenceOut
from app.schemas.evidence import (
    EvidenceDetail,
    EvidenceLinkCreate,
    EvidenceListItem,
    EvidenceUpdate,
    VerifyResult,
)
from app.schemas.evidence import EvidenceLink as EvidenceLinkOut
from app.services.ai.pipeline import process_evidence
from app.services.evidence.files import download_name, ingest_file, verify_case_files

router = APIRouter(tags=["evidence"])

NEWEST_FIRST = (Evidence.created_at.desc(), Evidence.id.desc())


def _list_item(evidence: Evidence, case: Case) -> dict[str, Any]:
    return {
        **EvidenceOut.model_validate(evidence).model_dump(),
        "case_number": case.case_number,
        "case_title": case.title,
    }


@router.get("/evidence", response_model=list[EvidenceListItem])
def list_all_evidence(
    db: DbSession,
    q: str | None = None,
    evidence_type: Annotated[EvidenceType | None, Query(alias="type")] = None,
):
    query = select(Evidence, Case).join(Case, Evidence.case_id == Case.id)
    if evidence_type:
        query = query.where(Evidence.type == evidence_type)
    if q:
        searched = (Evidence.title, Evidence.description, Case.case_number, Case.title, Evidence.summary)
        query = query.where(or_(*(column.icontains(q, autoescape=True) for column in searched)))
    rows = db.execute(query.order_by(*NEWEST_FIRST)).all()
    return [_list_item(evidence, case) for evidence, case in rows]


@router.post("/cases/{case_id}/evidence", response_model=list[EvidenceOut], status_code=status.HTTP_201_CREATED)
def upload_evidence(
    case_id: int,
    files: Annotated[list[UploadFile], File()],
    background_tasks: BackgroundTasks,
    db: DbSession,
    actor_id: ActorId,
):
    case = get_or_404(db, Case, case_id)
    created = [
        ingest_file(db, case.id, upload.filename or "Untitled", upload.content_type, upload.file, actor_id)
        for upload in files
    ]
    db.commit()
    for evidence in created:
        background_tasks.add_task(process_evidence, evidence.id)
    return created


@router.get("/cases/{case_id}/evidence", response_model=list[EvidenceOut])
def list_case_evidence(case_id: int, db: DbSession):
    case = get_or_404(db, Case, case_id)
    return db.scalars(select(Evidence).where(Evidence.case_id == case.id).order_by(*NEWEST_FIRST)).all()


@router.get("/evidence/{evidence_id}", response_model=EvidenceDetail)
def get_evidence(evidence_id: int, db: DbSession):
    evidence = get_or_404(db, Evidence, evidence_id)
    links = db.scalars(
        select(EvidenceLink).where(EvidenceLink.evidence_id == evidence.id).order_by(EvidenceLink.id)
    ).all()
    custody = db.scalars(
        select(AuditLog)
        .where(AuditLog.record_type == "evidence", AuditLog.record_id == evidence.id)
        .order_by(AuditLog.at, AuditLog.id)
    ).all()
    return {
        **_list_item(evidence, db.get(Case, evidence.case_id)),
        "extracted_text": evidence.extracted_text,
        "links": links,
        "custody": custody,
    }


@router.patch("/evidence/{evidence_id}", response_model=EvidenceOut)
def update_evidence(evidence_id: int, body: EvidenceUpdate, db: DbSession, actor_id: ActorId):
    evidence = get_or_404(db, Evidence, evidence_id)
    apply_update(db, evidence, body.model_dump(exclude_unset=True), record_type="evidence", actor_id=actor_id)
    db.commit()
    return evidence


@router.get(
    "/evidence/{evidence_id}/file",
    response_class=FileResponse,
    response_model=None,
    responses={200: {"description": "The original file, with its MIME type"}},
)
def get_evidence_file(evidence_id: int, db: DbSession, actor_id: ActorId, download: bool = False):
    """Serves the original inline and logs "viewed"; with ?download=1, serves it as
    an attachment named after the title and logs "exported"."""
    evidence = get_or_404(db, Evidence, evidence_id)
    path = absolute_path(evidence.file_path) if evidence.file_path else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    record_audit(
        db, actor_id, "exported" if download else "viewed", "evidence", evidence.id, case_id=evidence.case_id
    )
    db.commit()
    return FileResponse(
        path,
        media_type=evidence.mime_type,
        filename=download_name(evidence),
        content_disposition_type="attachment" if download else "inline",
    )


@router.post("/evidence/{evidence_id}/reprocess", response_model=EvidenceOut)
def reprocess_evidence(evidence_id: int, background_tasks: BackgroundTasks, db: DbSession, actor_id: ActorId):
    evidence = get_or_404(db, Evidence, evidence_id)
    evidence.processing_status = "queued"
    record_audit(db, actor_id, "modified", "evidence", evidence.id, case_id=evidence.case_id, detail={"reprocess": True})
    db.commit()
    background_tasks.add_task(process_evidence, evidence.id)
    return evidence


@router.post("/evidence-links", response_model=EvidenceLinkOut, status_code=status.HTTP_201_CREATED)
def create_evidence_link(body: EvidenceLinkCreate, db: DbSession, actor_id: ActorId):
    evidence = get_or_404(db, Evidence, body.evidence_id)
    get_or_404(db, RECORD_MODELS[body.target_type], body.target_id, RECORD_NAMES[body.target_type])
    if body.chunk_id is not None:
        chunk = db.get(EvidenceChunk, body.chunk_id)
        if chunk is None or chunk.evidence_id != evidence.id:
            raise HTTPException(status_code=404, detail="Chunk not found")
    link = EvidenceLink(**body.model_dump())
    db.add(link)
    db.flush()
    record_audit(
        db,
        actor_id,
        "modified",
        link.target_type,
        link.target_id,
        case_id=evidence.case_id,
        detail={"linked_evidence": evidence.id},
    )
    db.commit()
    return link


@router.delete("/evidence-links/{link_id}", response_model=None, status_code=status.HTTP_204_NO_CONTENT)
def delete_evidence_link(link_id: int, db: DbSession, actor_id: ActorId) -> None:
    link = get_or_404(db, EvidenceLink, link_id, "Evidence link")
    evidence = db.get(Evidence, link.evidence_id)
    record_audit(
        db,
        actor_id,
        "modified",
        link.target_type,
        link.target_id,
        case_id=evidence.case_id,
        detail={"unlinked_evidence": link.evidence_id},
    )
    db.delete(link)
    db.commit()


@router.post("/cases/{case_id}/verify", response_model=VerifyResult)
def verify_case(case_id: int, db: DbSession, actor_id: ActorId):
    case = get_or_404(db, Case, case_id)
    result = verify_case_files(db, case.id)
    record_audit(
        db,
        actor_id,
        "reviewed",
        "case",
        case.id,
        case_id=case.id,
        detail={"integrity_check": {"checked": result.checked, "mismatches": len(result.mismatches)}},
    )
    db.commit()
    return result
