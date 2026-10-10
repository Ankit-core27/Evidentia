"""Dashboard and alerts (task B5 in docs/BACKEND_TASKS.md).

- GET /api/dashboard
- GET /api/alerts

Everything here is computed on each request, never stored.
"""

from typing import get_args

from fastapi import APIRouter
from pydantic_core import to_jsonable_python
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import DbSession
from app.core.records import REVIEWABLE_MODELS
from app.models import Case, Conflict, Evidence, Investigator, Location
from app.schemas.cases import Investigator as InvestigatorOut
from app.schemas.common import CaseStatus
from app.schemas.dashboard import Alert, Dashboard

router = APIRouter(tags=["dashboard"])


def pending_reviews_by_case(db: Session) -> dict[int, int]:
    """AI proposals still waiting for review, per case: the pending_reviews rule
    of case_counts, counted for every case at once."""
    pending: dict[int, int] = {}
    for model in REVIEWABLE_MODELS.values():
        rows = db.execute(
            select(model.case_id, func.count())
            .where(model.origin == "ai", model.review_status == "pending")
            .group_by(model.case_id)
        ).all()
        for case_id, count in rows:
            pending[case_id] = pending.get(case_id, 0) + count
    return pending


@router.get("/dashboard", response_model=Dashboard)
def dashboard(db: DbSession):
    cases = db.scalars(select(Case).order_by(Case.id)).all()
    status_counts = dict.fromkeys(get_args(CaseStatus), 0)
    for case in cases:
        status_counts[case.status] = status_counts.get(case.status, 0) + 1

    incident_sites = db.execute(
        select(Location, Case)
        .join(Case, Location.case_id == Case.id)
        .where(Location.kind == "incident_site", Location.lat.is_not(None), Location.lng.is_not(None))
        .order_by(Location.id)
    ).all()

    investigators = db.scalars(select(Investigator).order_by(Investigator.id)).all()
    open_cases = [c for c in cases if c.status != "closed"]

    return {
        "total_cases": len(cases),
        "active_cases": len(open_cases),
        "pending_reviews": sum(pending_reviews_by_case(db).values()),
        "storage_bytes": db.scalar(select(func.coalesce(func.sum(Evidence.size_bytes), 0))),
        "status_counts": status_counts,
        "incident_points": [
            {
                "case_id": case.id,
                "case_number": case.case_number,
                "title": case.title,
                "incident_type": case.incident_type,
                "priority": case.priority,
                "address": location.address,
                "lat": location.lat,
                "lng": location.lng,
                "incident_at": case.incident_at,
            }
            for location, case in incident_sites
        ],
        "investigators": [
            InvestigatorOut.model_validate(i).model_dump()
            | {
                "solved_cases": sum(1 for c in cases if c.lead_investigator_id == i.id and c.status == "closed"),
                "active_cases": sum(1 for c in open_cases if i.id in (c.investigator_ids or [])),
            }
            for i in investigators
        ],
    }


@router.get("/alerts", response_model=list[Alert])
def alerts(db: DbSession):
    cases = db.scalars(select(Case).order_by(Case.id)).all()
    by_id = {c.id: c for c in cases}
    pending = pending_reviews_by_case(db)
    open_conflicts = db.scalars(select(Conflict).where(Conflict.status == "open").order_by(Conflict.id)).all()

    feed: list[dict] = []
    for case in cases:
        # Conflicts carry no timestamp of their own, so they date from the case's last change.
        for conflict in (x for x in open_conflicts if x.case_id == case.id):
            feed.append(
                {
                    "id": f"conflict-{conflict.id}",
                    "kind": "conflict",
                    "severity": "warning",
                    "title": "Conflicting statements",
                    "message": conflict.description,
                    "case_id": case.id,
                    "case_number": case.case_number,
                    "record_type": "conflict",
                    "record_id": conflict.id,
                    "created_at": case.updated_at,
                }
            )
        if pending.get(case.id):
            feed.append(
                {
                    "id": f"review-{case.id}",
                    "kind": "review",
                    "severity": "info",
                    "title": f"{pending[case.id]} AI proposals to review",
                    "message": (
                        "New people, events, links or statements were proposed from the evidence in "
                        f"{case.case_number}."
                    ),
                    "case_id": case.id,
                    "case_number": case.case_number,
                    "record_type": None,
                    "record_id": None,
                    "created_at": case.updated_at,
                }
            )

    processed = db.scalars(
        select(Evidence)
        .where(Evidence.processed_at.is_not(None), Evidence.processing_status.in_(("done", "failed")))
        .order_by(Evidence.processed_at, Evidence.id)
    ).all()
    for evidence in processed:
        case = by_id[evidence.case_id]
        failed = evidence.processing_status == "failed"
        feed.append(
            {
                # Keyed by the finish time, so a reprocessed file raises a new alert.
                "id": f"processing-{evidence.id}-{to_jsonable_python(evidence.processed_at)}",
                "kind": "processing",
                "severity": "critical" if failed else "info",
                "title": "Processing failed" if failed else "Processing finished",
                "message": evidence.title,
                "case_id": case.id,
                "case_number": case.case_number,
                "record_type": "evidence",
                "record_id": evidence.id,
                "created_at": evidence.processed_at,
            }
        )

    # Newest first; sorted() is stable, so ties keep the order above, as in the mock.
    return sorted(feed, key=lambda alert: alert["created_at"], reverse=True)
