"""Everything a planner reads about a case: the evidence with its text, and the
records proposed from it (rejected proposals left out), as rows for the rules
planner and as one text for Gemini."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Case,
    CaseObject,
    Conflict,
    Event,
    Evidence,
    Injury,
    Location,
    Observation,
    Person,
    Relationship,
)

# Evidence text sent to Gemini, per item and in all. Summaries are always sent.
TEXT_PER_EVIDENCE = 8_000
TEXT_IN_ALL = 80_000


@dataclass
class Dossier:
    case: Case
    evidence: list[Evidence]
    persons: list[Person]
    objects: list[CaseObject]
    locations: list[Location]
    events: list[Event]
    relationships: list[Relationship]
    observations: list[Observation]
    conflicts: list[Conflict]
    injuries: list[Injury]

    def texts(self) -> list[tuple[Evidence, str]]:
        """Each evidence item with the text it has: extracted text, else its summary."""
        return [(e, e.extracted_text or e.summary or "") for e in self.evidence]

    def corpus(self) -> str:
        """The case description, record notes and every evidence text, for pattern matching."""
        parts = [self.case.title, self.case.description]
        parts += [text for _, text in self.texts()]
        parts += [p.notes for p in self.persons] + [loc.address for loc in self.locations]
        parts += [e.description for e in self.events]
        return "\n\n".join(p for p in parts if p)


def build_dossier(db: Session, case: Case) -> Dossier:
    def active(model):
        query = select(model).where(model.case_id == case.id)
        if hasattr(model, "review_status"):
            query = query.where(model.review_status != "rejected")
        return list(db.scalars(query.order_by(model.id)))

    events = sorted(active(Event), key=lambda e: (e.time_start is None, e.time_start or datetime.min, e.id))
    return Dossier(
        case=case,
        evidence=list(db.scalars(select(Evidence).where(Evidence.case_id == case.id).order_by(Evidence.id))),
        persons=active(Person),
        objects=active(CaseObject),
        locations=active(Location),
        events=events,
        relationships=active(Relationship),
        observations=active(Observation),
        conflicts=list(
            db.scalars(select(Conflict).where(Conflict.case_id == case.id, Conflict.status == "open").order_by(Conflict.id))
        ),
        injuries=active(Injury),
    )


def _time(value: datetime | None) -> str:
    return value.isoformat().replace("+00:00", "Z") if value else "time unknown"


def dossier_text(d: Dossier) -> str:
    """The case file as Gemini reads it. Record IDs are the numbers the script cites."""
    case = d.case
    lines = [
        f"Case {case.case_number}: {case.title} ({case.incident_type}). Incident at {_time(case.incident_at)} (UTC).",
        "Times in the records are UTC; times in the evidence texts are local.",
        case.description,
        "",
        "EVIDENCE",
    ]
    budget = TEXT_IN_ALL
    for evidence in d.evidence:
        lines.append(f"Evidence {evidence.id} ({evidence.type}): {evidence.title}. {evidence.description}".strip())
        if evidence.summary:
            lines.append(f"Summary: {evidence.summary}")
        body = (evidence.extracted_text or "")[: min(TEXT_PER_EVIDENCE, max(budget, 0))]
        budget -= len(body)
        if body:
            lines += ["Text:", '"""', body, '"""']
        lines.append("")

    lines.append("RECORDS")
    lines.append("Persons:")
    lines += [
        f"- Person {p.id}: {p.name} ({p.role}{', ' + p.condition if p.condition else ''}"
        f"{', age ' + str(p.age) if p.age else ''}). {p.occupation}. {p.notes}".replace(". .", ".").strip()
        for p in d.persons
    ] or ["- none"]
    lines.append("Vehicles and items:")
    lines += [
        f"- Object {o.id}: {o.label} ({o.kind}"
        + "".join(f", {k} {v}" for k, v in (o.details or {}).items() if v)
        + ")"
        for o in d.objects
    ] or ["- none"]
    lines.append("Places:")
    lines += [f"- Location {loc.id}: {loc.address} ({loc.kind})" for loc in d.locations] or ["- none"]
    lines.append("Events, in time order:")
    lines += [
        f"- Event {e.id} at {_time(e.time_start)} ({e.time_precision}, {e.certainty}): {e.description}"
        + (f" Note: {e.ai_note}" if e.ai_note else "")
        for e in d.events
    ] or ["- none"]
    lines.append("Relationships:")
    names = _names(d)
    lines += [
        f"- {names.get((r.from_type, r.from_id), r.from_type)} {r.kind.replace('_', ' ')} "
        f"{names.get((r.to_type, r.to_id), r.to_type)}" + (f": {r.label}" if r.label else "")
        for r in d.relationships
    ] or ["- none"]
    lines.append("Statements (observations):")
    lines += [
        f"- Observation {o.id} about {names.get((o.subject_type, o.subject_id), o.subject_type)}: {o.statement}"
        for o in d.observations
    ] or ["- none"]
    lines.append("Open conflicts between accounts:")
    lines += [f"- {c.description} (observations {', '.join(map(str, c.observation_ids))})" for c in d.conflicts] or [
        "- none"
    ]
    lines.append("Injuries:")
    lines += [
        f"- {names.get(('person', i.person_id), 'Unknown person')}: {i.type}, {i.body_region}, {i.severity}. {i.description}"
        for i in d.injuries
    ] or ["- none"]
    return "\n".join(lines)


def _names(d: Dossier) -> dict[tuple[str, int], str]:
    names: dict[tuple[str, int], str] = {("case", d.case.id): "the case"}
    names.update({("person", p.id): f"person {p.id} ({p.name})" for p in d.persons})
    names.update({("object", o.id): f"object {o.id} ({o.label})" for o in d.objects})
    names.update({("location", loc.id): f"location {loc.id} ({loc.address})" for loc in d.locations})
    names.update({("evidence", e.id): f"evidence {e.id} ({e.title})" for e in d.evidence})
    names.update({("event", e.id): f"event {e.id}" for e in d.events})
    return names
