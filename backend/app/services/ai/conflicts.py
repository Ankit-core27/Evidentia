"""Step 6 of the pipeline: compare a case's observations and flag conflicting
statements and missing information for review.

Observations that haven't been rejected are grouped by subject, by place (a
location, or the location of an event) and by time (observed within a few
minutes of each other). Groups of two or more that changed since the last check
go to Gemini in one call, which returns the conflicts and gaps it finds. Each
new finding is saved as an open conflicts row listing its observation IDs, and
the call is logged to ai_runs against the case.
"""

import json
import logging
from collections import defaultdict
from datetime import timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.records import RECORD_MODELS
from app.models import AiRun, Case, Conflict, Event, Evidence, EvidenceLink, Observation
from app.services.ai import client
from app.services.ai.gemini import generate_json, log_run

logger = logging.getLogger(__name__)

TASK = "conflicts"
# Observations this close to the first one of a time group join it.
TIME_WINDOW = timedelta(minutes=2)

# The field that names a record of each type, for the prompt.
LABEL_FIELDS = {
    "case": "title",
    "evidence": "title",
    "person": "name",
    "object": "label",
    "location": "address",
    "event": "description",
}


class Finding(BaseModel):
    kind: Literal["conflict", "gap"] = Field(
        description='"conflict" when observations contradict each other, "gap" when information is missing.'
    )
    observation_ids: list[int] = Field(description="The IDs of the observations involved.")
    description: str = Field(description="One neutral sentence an investigator can act on.")


class ConflictReport(BaseModel):
    findings: list[Finding] = []


RESPONSE_SCHEMA = ConflictReport.model_json_schema()

SYSTEM_PROMPT = """You review the statements gathered in a forensic investigation. You get groups of observations about the same subject, place or time. Find:
- conflicts: observations that can't all be true, such as different signal colours, times, speeds or positions for the same moment;
- gaps: information an investigator needs to settle what happened and doesn't have, such as a clock nobody has checked or a time nobody accounts for.

Rules:
- Only report what the observations show. Differences in wording or detail that can both be true are not conflicts.
- A conflict lists the IDs of at least two observations; a gap lists the IDs of the observations it concerns.
- Describe each finding in one neutral sentence, such as "Witnesses disagree on the hatchback's signal when it entered the junction."
- Return an empty list when there is nothing to report."""


def check_case_conflicts(db: Session, case_id: int) -> None:
    """Run at the end of process_evidence, so a new statement can open a conflict.
    Does nothing without GEMINI_API_KEY. A failure is logged rather than raised,
    because the evidence itself has been processed by then."""
    gemini = client.get_client()
    if gemini is None:
        return
    try:
        detect_conflicts(db, case_id, gemini)
        db.commit()
    except Exception:
        logger.exception("Conflict detection for case %s failed", case_id)
        db.rollback()


def detect_conflicts(db: Session, case_id: int, gemini) -> list[Conflict]:
    """Asks Gemini about the groups that changed since the last check and adds
    the new conflicts to the session. The ai_runs row is committed straight away;
    the caller commits the conflicts. Groups and findings whose observations
    already make up a conflict are skipped."""
    known = {frozenset(c.observation_ids) for c in db.scalars(select(Conflict).where(Conflict.case_id == case_id))}
    checked = _checked_groups(db, case_id)
    groups = [
        group
        for group in group_observations(db, case_id)
        if frozenset(o.id for o in group) not in known and _fingerprint(group) not in checked
    ]
    if not groups:
        return []

    case = db.get(Case, case_id)
    sent = _describe_groups(db, groups)
    data, raw = generate_json(gemini, [_prompt(case, sent)], RESPONSE_SCHEMA, system=SYSTEM_PROMPT)
    log_run(db, TASK, {"groups": sent, "output": data if data is not None else raw}, case_id=case_id)
    db.commit()
    if data is None:
        raise ValueError("Gemini did not return valid JSON")
    report = ConflictReport.model_validate(data)

    sent_ids = {o.id for group in groups for o in group}
    created: list[Conflict] = []
    for finding in report.findings:
        ids = list(dict.fromkeys(i for i in finding.observation_ids if i in sent_ids))
        description = finding.description.strip()
        if not description or len(ids) < (2 if finding.kind == "conflict" else 1) or frozenset(ids) in known:
            continue
        known.add(frozenset(ids))
        conflict = Conflict(case_id=case_id, observation_ids=ids, description=description, status="open")
        db.add(conflict)
        created.append(conflict)
    db.flush()
    return created


def group_observations(db: Session, case_id: int) -> list[list[Observation]]:
    """A case's observations that haven't been rejected, grouped by subject,
    place and time. Only groups of two or more, each set of observations once."""
    observations = list(
        db.scalars(
            select(Observation)
            .where(Observation.case_id == case_id, Observation.review_status != "rejected")
            .order_by(Observation.id)
        )
    )
    event_places = dict(db.execute(select(Event.id, Event.location_id).where(Event.case_id == case_id)).all())

    keyed: dict[tuple, list[Observation]] = defaultdict(list)
    for observation in observations:
        keyed[("subject", observation.subject_type, observation.subject_id)].append(observation)
        place = _place_of(observation, event_places)
        if place is not None:
            keyed[("place", place)].append(observation)
    candidates = [*keyed.values(), *_time_groups(observations)]

    groups: list[list[Observation]] = []
    seen: set[frozenset[int]] = set()
    for group in candidates:
        ids = frozenset(o.id for o in group)
        if len(ids) >= 2 and ids not in seen:
            seen.add(ids)
            groups.append(group)
    return groups


def _place_of(observation: Observation, event_places: dict[int, int | None]) -> int | None:
    if observation.subject_type == "location":
        return observation.subject_id
    if observation.subject_type == "event":
        return event_places.get(observation.subject_id)
    return None


def _time_groups(observations: list[Observation]) -> list[list[Observation]]:
    timed = sorted((o for o in observations if o.observed_at is not None), key=lambda o: o.observed_at)
    groups: list[list[Observation]] = []
    for observation in timed:
        if groups and observation.observed_at - groups[-1][0].observed_at <= TIME_WINDOW:
            groups[-1].append(observation)
        else:
            groups.append([observation])
    return groups


def _fingerprint(group: list[Observation]) -> frozenset[tuple[int, str]]:
    """IDs and statements, so a reused ID or an edited statement counts as a change."""
    return frozenset((o.id, o.statement) for o in group)


def _checked_groups(db: Session, case_id: int) -> set[frozenset[tuple[int, str]]]:
    """The groups earlier conflict checks of this case sent to Gemini and got a
    usable answer for."""
    checked: set[frozenset[tuple[int, str]]] = set()
    for output in db.scalars(select(AiRun.output).where(AiRun.case_id == case_id, AiRun.task == TASK)):
        if not isinstance(output, dict) or not isinstance(output.get("output"), dict):
            continue
        for group in output.get("groups") or []:
            try:
                checked.add(frozenset((item["id"], item["statement"]) for item in group))
            except (KeyError, TypeError):
                continue
    return checked


def _describe_groups(db: Session, groups: list[list[Observation]]) -> list[list[dict[str, Any]]]:
    """The groups as sent to Gemini and logged: each observation with its subject,
    time, review status and the evidence it came from."""
    ids = {o.id for group in groups for o in group}
    sources: dict[int, list[str]] = defaultdict(list)
    rows = db.execute(
        select(EvidenceLink.target_id, Evidence.title)
        .join(Evidence, Evidence.id == EvidenceLink.evidence_id)
        .where(EvidenceLink.target_type == "observation", EvidenceLink.target_id.in_(ids))
        .order_by(EvidenceLink.id)
    )
    for observation_id, title in rows:
        if title not in sources[observation_id]:
            sources[observation_id].append(title)

    labels: dict[tuple[str, int], str] = {}
    described = []
    for group in groups:
        items = []
        for o in group:
            subject = (o.subject_type, o.subject_id)
            if subject not in labels:
                labels[subject] = _subject_label(db, *subject)
            items.append(
                {
                    "id": o.id,
                    "subject": labels[subject],
                    "observed_at": o.observed_at.isoformat() if o.observed_at else None,
                    "statement": o.statement,
                    "review_status": o.review_status,
                    "sources": sources.get(o.id, []),
                }
            )
        described.append(items)
    return described


def _subject_label(db: Session, record_type: str, record_id: int) -> str:
    model, field = RECORD_MODELS.get(record_type), LABEL_FIELDS.get(record_type)
    row = db.get(model, record_id) if model is not None else None
    if row is None or field is None:
        return f"{record_type} {record_id}"
    return f"{record_type}: {getattr(row, field)}"


def _prompt(case: Case, groups: list[list[dict[str, Any]]]) -> str:
    incident_at = case.incident_at.isoformat() if case.incident_at else "unknown"
    header = f"Case {case.case_number}: {case.title} ({case.incident_type}). Incident at {incident_at} (UTC)."
    return f"{header}\n\nObservation groups:\n{json.dumps(groups, indent=1, ensure_ascii=False)}"
