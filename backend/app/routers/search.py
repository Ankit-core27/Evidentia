"""Search and cited answers (task A2 in docs/BACKEND_TASKS.md):

- POST /api/cases/{id}/ask
- GET /api/cases/{id}/search?q=

The logic lives in app/services/search/. Both routes commit, because ranking
embeds chunks that have no embedding yet on first use.
"""

from fastapi import APIRouter, HTTPException, status

from app.core.deps import DbSession
from app.core.records import get_or_404
from app.models import Case
from app.schemas.search import AskRequest, AskResponse, SearchHit
from app.services.search.answers import AnswerUnavailable, answer_question
from app.services.search.ranking import rank_chunks

router = APIRouter(tags=["search"])

SEARCH_LIMIT = 20


@router.post("/cases/{case_id}/ask", response_model=AskResponse)
def ask(case_id: int, body: AskRequest, db: DbSession):
    case = get_or_404(db, Case, case_id)
    try:
        answer = answer_question(db, case.id, body.question, body.history)
    except AnswerUnavailable as error:
        # Keep the ai_runs row and any embeddings made on the way.
        db.commit()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    db.commit()
    return answer


@router.get("/cases/{case_id}/search", response_model=list[SearchHit])
def search(case_id: int, db: DbSession, q: str = ""):
    case = get_or_404(db, Case, case_id)
    hits = rank_chunks(db, case.id, q, limit=SEARCH_LIMIT)
    db.commit()
    return [SearchHit(**hit.citation(), score=hit.score) for hit in hits]
