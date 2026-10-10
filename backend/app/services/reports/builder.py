"""Builds the content of a case report, as the mock's buildReport does.

A report is a snapshot: the content is assembled once, stored as JSON on the
`reports` row, and hashed, so a printed or exported copy can be checked against
the stored SHA-256 later.

What each template holds (on top of the case, summary, persons and confirmed
findings, which every template has):

- court: evidence, timeline, open conflicts, uncertainties, reconstructions, injuries
- summary: evidence, timeline, open conflicts, uncertainties
- custody: evidence and the custody ledger, without AI insights
- medical: medical evidence, findings about persons, and injuries

AI insights are added when asked for (except on custody), and the custody ledger
when asked for or on the custody template.
"""

import hashlib
import json
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.records import case_counts
from app.models import (
    AuditLog,
    Case,
    Conflict,
    Event,
    Evidence,
    EvidenceLink,
    Injury,
    Investigator,
    Observation,
    Person,
    Reconstruction,
)
from app.schemas.cases import Case as CaseOut
from app.schemas.reports import ReportContent, ReportOptions


def content_sha256(content: dict[str, Any]) -> str:
    """SHA-256 of the content as canonical JSON (sorted keys, no whitespace)."""
    canonical = json.dumps(content, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_report_content(db: Session, case: Case, template: str, options: ReportOptions) -> dict[str, Any]:
    """Returns ReportContent as a JSON-ready dict, the form that is stored and hashed."""
    with_timeline = template in ("court", "summary")
    medical_only = template == "medical"

    lead = db.get(Investigator, case.lead_investigator_id) if case.lead_investigator_id is not None else None
    evidence = db.scalars(select(Evidence).where(Evidence.case_id == case.id).order_by(Evidence.id)).all()
    persons = db.scalars(
        select(Person).where(Person.case_id == case.id, Person.review_status != "rejected").order_by(Person.id)
    ).all()
    # The timeline route's order: by start time, untimed events last.
    events = db.scalars(
        select(Event)
        .where(Event.case_id == case.id, Event.review_status != "rejected")
        .order_by(Event.time_start.is_(None), Event.time_start, Event.id)
    ).all()
    observations = {
        o.id: o for o in db.scalars(select(Observation).where(Observation.case_id == case.id).order_by(Observation.id))
    }

    content: dict[str, Any] = {
        "case": CaseOut.model_validate(case).model_dump() | {"lead_investigator_name": lead.name if lead else None},
        "summary": case.description,
        "evidence": [e for e in evidence if not medical_only or e.type == "medical"],
        "timeline": events if with_timeline else [],
        "persons": persons,
        "confirmed_findings": [
            {"statement": o.statement, "evidence_ids": _linked_evidence_ids(db, "observation", o.id)}
            for o in observations.values()
            if o.review_status == "confirmed" and (not medical_only or o.subject_type == "person")
        ],
        "open_conflicts": _open_conflicts(db, case.id, observations) if with_timeline else [],
        "uncertainties": _uncertainties(db, case.id, events) if with_timeline else [],
        "reconstructions": (
            db.scalars(select(Reconstruction).where(Reconstruction.case_id == case.id).order_by(Reconstruction.id)).all()
            if template == "court"
            else []
        ),
        "injuries": (
            db.scalars(
                select(Injury).where(Injury.case_id == case.id, Injury.review_status != "rejected").order_by(Injury.id)
            ).all()
            if template == "court" or medical_only
            else []
        ),
        "ai_insights": (
            [f"{e.title}: {e.summary}" for e in evidence if e.summary and (not medical_only or e.type == "medical")]
            if options.include_ai_insights and template != "custody"
            else None
        ),
        "custody": (
            _custody(db, [e.id for e in evidence]) if options.include_custody or template == "custody" else None
        ),
    }
    return ReportContent.model_validate(content).model_dump(mode="json")


def _linked_evidence_ids(db: Session, record_type: str, record_id: int) -> list[int]:
    """The evidence a record was drawn from, each once, in link order."""
    ids = db.scalars(
        select(EvidenceLink.evidence_id)
        .where(EvidenceLink.target_type == record_type, EvidenceLink.target_id == record_id)
        .order_by(EvidenceLink.id)
    ).all()
    return list(dict.fromkeys(ids))


def _open_conflicts(db: Session, case_id: int, observations: dict[int, Observation]) -> list[dict[str, Any]]:
    conflicts = db.scalars(
        select(Conflict).where(Conflict.case_id == case_id, Conflict.status == "open").order_by(Conflict.id)
    ).all()
    return [
        {
            "description": c.description,
            "statements": [observations[i].statement if i in observations else "" for i in c.observation_ids],
        }
        for c in conflicts
    ]


def _uncertainties(db: Session, case_id: int, events: Sequence[Event]) -> list[str]:
    items = [f"{e.description} ({e.certainty})" for e in events if e.certainty != "established"]
    pending = case_counts(db, case_id)["pending_reviews"]
    if pending:
        items.append(f"{pending} AI-proposed items are still waiting for review.")
    return items


def _custody(db: Session, evidence_ids: list[int]) -> list[AuditLog]:
    """Audit entries for the case's evidence, oldest first."""
    if not evidence_ids:
        return []
    return list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.record_type == "evidence", AuditLog.record_id.in_(evidence_ids))
            .order_by(AuditLog.at, AuditLog.id)
        ).all()
    )
