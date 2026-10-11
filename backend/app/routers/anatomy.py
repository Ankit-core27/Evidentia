"""Medical analysis is a deliberate, case/person-scoped operation, never a read side effect."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import ActorId, DbSession
from app.core.records import apply_update, get_or_404, invalid
from app.models import AnatomyFinding, Case, Evidence, Person
from app.schemas.anatomy import AnatomyFinding as FindingOut, AnatomyFindingUpdate, MedicalAnalysisRequest, MedicalAnalysisResult
from app.services.ai import client
from app.services.ai.anatomy import analyze_medical

router = APIRouter(tags=["anatomy"])


@router.get("/cases/{case_id}/anatomy-findings", response_model=list[FindingOut])
def list_findings(case_id: int, db: DbSession):
    get_or_404(db, Case, case_id)
    return db.scalars(select(AnatomyFinding).where(AnatomyFinding.case_id == case_id).order_by(AnatomyFinding.id)).all()


@router.patch("/anatomy-findings/{finding_id}", response_model=FindingOut)
def review_finding(finding_id: int, body: AnatomyFindingUpdate, db: DbSession, actor_id: ActorId):
    finding = get_or_404(db, AnatomyFinding, finding_id)
    apply_update(db, finding, body.model_dump(), record_type="anatomy_finding", actor_id=actor_id)
    db.commit()
    return finding


@router.post("/cases/{case_id}/medical-analysis", response_model=MedicalAnalysisResult)
def analyze(case_id: int, body: MedicalAnalysisRequest, db: DbSession, actor_id: ActorId):
    get_or_404(db, Case, case_id)
    person = get_or_404(db, Person, body.person_id)
    evidence = get_or_404(db, Evidence, body.evidence_id)
    if person.case_id != case_id or person.review_status == "rejected":
        raise invalid("person_id", "Select an active person belonging to this case")
    if evidence.case_id != case_id:
        raise invalid("evidence_id", "Evidence does not belong to this case")
    if evidence.type not in ("medical", "document"):
        raise invalid("evidence_id", "Select a medical report or document explicitly for analysis")
    if evidence.processing_status != "done" or not evidence.extracted_text:
        raise invalid("evidence_id", "Wait for the evidence pipeline to extract and index this report")
    gemini = client.get_client()
    if gemini is None:
        raise HTTPException(503, "Gemini is not configured. Stored findings and reference anatomy remain available.")
    try:
        result = analyze_medical(db, evidence, person, body.report_kind, gemini, actor_id)
        db.commit()
        return result
    except ValueError as error:
        db.rollback()
        raise invalid("medical_analysis", str(error)) from error
    except Exception as error:
        db.rollback()
        raise HTTPException(502, "Medical analysis failed; existing findings were retained. Retry after checking the AI service.") from error
