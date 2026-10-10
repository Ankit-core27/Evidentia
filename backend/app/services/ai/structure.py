"""Step 3 of the pipeline: one Gemini call turns the extracted text into a summary
and proposed records (persons, objects, locations, events, relationships and
observations), each with the passage it came from.

The raw output goes to ai_runs and the summary onto the evidence. Each proposal
is saved as origin="ai", review_status="pending", with an evidence_links row
pointing at its passage and the chunk that holds it. People, vehicles and
places already in the case are matched by name, plate or address and linked
instead of duplicated.
"""

import re
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.records import delete_links_to, delete_relationships_of
from app.models import (
    Case,
    CaseObject,
    Conflict,
    Event,
    Evidence,
    EvidenceLink,
    Location,
    Observation,
    Person,
    Reconstruction,
    ReconstructionStage,
    Relationship,
)
from app.schemas.common import (
    Certainty,
    EventCategory,
    LocationKind,
    ObjectKind,
    PersonCondition,
    PersonRole,
    RelationshipKind,
    TimePrecision,
)
from app.services.ai.gemini import generate_json, log_run
from app.services.ai.passages import ChunkFinder, normalize

# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

TIME_HELP = "ISO 8601 with a UTC offset, such as 2026-10-03T21:40:00+05:30, or null if the text gives no time."


class Proposal(BaseModel):
    passage: str = Field(
        description="The shortest sentence or clause of the evidence text this item comes from, copied verbatim."
    )


class PersonProposal(Proposal):
    ref: str = Field(description='A short id for this person, such as "p1".')
    name: str = Field(description='The name, or a description such as "Van driver" if the text gives none.')
    role: PersonRole
    age: int | None = None
    occupation: str = ""
    condition: PersonCondition | None = None
    contact: str = ""
    notes: str = ""


class ObjectProposal(Proposal):
    ref: str = Field(description='A short id for this object, such as "o1".')
    kind: ObjectKind
    label: str = Field(description='A short description, such as "White hatchback".')
    plate: str = Field("", description="Registration plate, for vehicles.")
    number: str = Field("", description="Phone number, serial number or similar.")
    make: str = ""
    model: str = ""
    colour: str = ""


class LocationProposal(Proposal):
    ref: str = Field(description='A short id for this place, such as "l1".')
    kind: LocationKind
    address: str = Field(description="The address, or a description of the place.")


class EventProposal(Proposal):
    ref: str = Field(description='A short id for this event, such as "e1".')
    category: EventCategory
    description: str
    time_start: str | None = Field(None, description=TIME_HELP)
    time_end: str | None = Field(None, description=TIME_HELP)
    time_precision: TimePrecision = "minute"
    certainty: Certainty = "hypothesis"
    location_ref: str | None = Field(None, description="The ref of the location where it happened.")
    note: str | None = Field(None, description="What an investigator should know, such as where the time comes from.")


class RelationshipProposal(Proposal):
    from_ref: str = Field(description='The ref of a person, object or location, or "evidence" for this evidence.')
    to_ref: str = Field(description='The ref of a person, object or location, or "evidence" for this evidence.')
    kind: RelationshipKind
    label: str = Field("", description='A few words, such as "Driver of the van".')
    confidence: float | None = Field(None, description="How sure the text makes this, from 0 to 1.")


class ObservationProposal(Proposal):
    subject_ref: str | None = Field(
        None, description="The ref of the person, object, location or event the statement is about; null for the case."
    )
    statement: str = Field(description="One claim, as a short sentence that makes sense on its own.")
    observed_at: str | None = Field(None, description="When the observed thing happened. " + TIME_HELP)


class StructuredEvidence(BaseModel):
    summary: str = Field(description="Two to four neutral sentences on what the evidence says.")
    persons: list[PersonProposal] = []
    objects: list[ObjectProposal] = []
    locations: list[LocationProposal] = []
    events: list[EventProposal] = []
    relationships: list[RelationshipProposal] = []
    observations: list[ObservationProposal] = []


RESPONSE_SCHEMA = StructuredEvidence.model_json_schema()

SYSTEM_PROMPT = """You extract facts from evidence for a forensic investigation. Read the evidence text and return a summary plus the persons, objects (vehicles, phones, weapons, other items), locations, events, relationships and observations it mentions.

Rules:
- Use only what the text states. Don't guess, infer motives or fill gaps.
- Every item has a passage: the shortest sentence or clause of the text that supports it, copied character for character.
- Give each person, object, location and event a ref (p1, o1, l1, e1 and so on) and use those refs in relationships, observations and event locations. The ref "evidence" means this evidence itself.
- When the text refers to someone or something under "Known records", use the same name, plate or address.
- Observations are single claims that could be checked against other accounts: what someone saw or heard, signal colours, speeds, positions, times, injuries, who did what. Keep each source's claims separate, and say whose claim it is when it is someone's account ("The van driver says he moved off on green.").
- Times are ISO 8601 with a UTC offset. Take the time zone from the places in the case and the date from the text or the incident date. Leave a time null when the text gives none, and set time_precision to how exact the text is.
- certainty is established for facts recorded by instruments, records or officials, hypothesis for a single account or an estimate, and disputed when the text itself says accounts differ.
- Return an empty list when there is nothing of a kind."""

# Records the structuring step creates, which a reprocess replaces.
PROPOSAL_MODELS: dict[str, type] = {
    "person": Person,
    "object": CaseObject,
    "location": Location,
    "event": Event,
    "relationship": Relationship,
    "observation": Observation,
}
GRAPH_NODE_TYPES = {"person", "object", "location", "evidence"}
KNOWN_RECORDS_LIMIT = 100

# ---------------------------------------------------------------------------
# The step
# ---------------------------------------------------------------------------


def structure_evidence(db: Session, evidence: Evidence, text: str, finder: ChunkFinder, client) -> None:
    """Calls Gemini, logs its raw output and saves the proposals. The ai_runs row
    is committed straight away, so the output is kept even if it can't be used."""
    case = db.get(Case, evidence.case_id)
    data, raw = generate_json(client, [_prompt(db, case, evidence, text)], RESPONSE_SCHEMA, system=SYSTEM_PROMPT)
    log_run(db, "structure", data if data is not None else raw, evidence_id=evidence.id, case_id=evidence.case_id)
    db.commit()
    if data is None:
        raise ValueError("Gemini did not return valid JSON")
    result = StructuredEvidence.model_validate(data)

    clear_previous_proposals(db, evidence)
    _Proposals(db, evidence, finder).save(result)
    evidence.summary = result.summary.strip() or None


def _prompt(db: Session, case: Case, evidence: Evidence, text: str) -> str:
    incident_at = case.incident_at.isoformat() if case.incident_at else "unknown"
    lines = [
        f"Case {case.case_number}: {case.title} ({case.incident_type}). Incident at {incident_at} (UTC).",
        case.description,
        "",
        f"Evidence: {evidence.title} ({evidence.type}). {evidence.description}".strip(),
        "",
        "Known records:",
    ]
    persons = _active(db, Person, case.id)[:KNOWN_RECORDS_LIMIT]
    objects = _active(db, CaseObject, case.id)[:KNOWN_RECORDS_LIMIT]
    locations = _active(db, Location, case.id)[:KNOWN_RECORDS_LIMIT]
    lines.append("Persons: " + ("; ".join(f"{p.name} ({p.role})" for p in persons) or "none"))
    lines.append("Objects: " + ("; ".join(_describe_object(o) for o in objects) or "none"))
    lines.append("Locations: " + ("; ".join(f"{loc.address} ({loc.kind})" for loc in locations) or "none"))
    lines += ["", "Evidence text:", '"""', text, '"""']
    return "\n".join(lines)


def _describe_object(obj: CaseObject) -> str:
    details = obj.details or {}
    extra = [f"{key} {details[key]}" for key in ("plate", "number") if details.get(key)]
    return f"{obj.label} ({obj.kind}{', ' + ', '.join(extra) if extra else ''})"


# ---------------------------------------------------------------------------
# Reprocessing
# ---------------------------------------------------------------------------


def clear_previous_proposals(db: Session, evidence: Evidence) -> None:
    """Before new proposals are saved, removes this evidence's earlier ones that
    are still pending and that no other evidence supports. A pending record other
    evidence also supports only loses this evidence's links. Reviewed records keep
    theirs, as do pending events already placed in a reconstruction stage."""
    links = db.scalars(
        select(EvidenceLink).where(
            EvidenceLink.evidence_id == evidence.id, EvidenceLink.target_type.in_(PROPOSAL_MODELS)
        )
    ).all()
    targets = sorted({(link.target_type, link.target_id) for link in links})
    staged_events = _staged_event_ids(db, evidence.case_id)
    removed_observations: set[int] = set()

    for target_type, target_id in targets:
        row = db.get(PROPOSAL_MODELS[target_type], target_id)
        if row is not None and (row.origin != "ai" or row.review_status != "pending"):
            continue
        if row is None or _supported_elsewhere(db, evidence.id, target_type, target_id):
            db.execute(
                delete(EvidenceLink).where(
                    EvidenceLink.evidence_id == evidence.id,
                    EvidenceLink.target_type == target_type,
                    EvidenceLink.target_id == target_id,
                )
            )
            continue
        if target_type == "event" and target_id in staged_events:
            continue
        if target_type in GRAPH_NODE_TYPES:
            delete_relationships_of(db, target_type, target_id)
        delete_links_to(db, target_type, target_id)
        db.delete(row)
        if target_type == "observation":
            removed_observations.add(target_id)

    _drop_conflicts_citing(db, evidence.case_id, removed_observations)
    db.flush()


def _supported_elsewhere(db: Session, evidence_id: int, target_type: str, target_id: int) -> bool:
    query = select(EvidenceLink.id).where(
        EvidenceLink.target_type == target_type,
        EvidenceLink.target_id == target_id,
        EvidenceLink.evidence_id != evidence_id,
    )
    return db.scalar(query.limit(1)) is not None


def _staged_event_ids(db: Session, case_id: int) -> set[int]:
    query = (
        select(ReconstructionStage.event_ids)
        .join(Reconstruction, Reconstruction.id == ReconstructionStage.reconstruction_id)
        .where(Reconstruction.case_id == case_id)
    )
    return {event_id for event_ids in db.scalars(query) for event_id in event_ids or []}


def _drop_conflicts_citing(db: Session, case_id: int, observation_ids: set[int]) -> None:
    """Open conflicts that cite a removed observation are dropped, to be found
    again among the new observations; resolved ones just lose the IDs."""
    if not observation_ids:
        return
    for conflict in db.scalars(select(Conflict).where(Conflict.case_id == case_id)).all():
        if not observation_ids.intersection(conflict.observation_ids):
            continue
        if conflict.status == "open":
            delete_links_to(db, "conflict", conflict.id)
            db.delete(conflict)
        else:
            conflict.observation_ids = [i for i in conflict.observation_ids if i not in observation_ids]


# ---------------------------------------------------------------------------
# Saving proposals
# ---------------------------------------------------------------------------

NAME_TITLES = {
    "mr",
    "mrs",
    "ms",
    "miss",
    "dr",
    "shri",
    "smt",
    "sri",
    "insp",
    "inspector",
    "sgt",
    "constable",
    "officer",
}


def name_key(name: str) -> str:
    words = normalize(name).split()
    while words and words[0] in NAME_TITLES:
        words.pop(0)
    return " ".join(words)


def plate_key(plate: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(plate or "").upper())


def number_key(number: Any) -> str:
    digits = re.sub(r"\D", "", str(number or ""))
    return digits if len(digits) >= 5 else ""


def parse_time(value: str | None) -> datetime | None:
    """ISO 8601 from the model; a time without an offset is taken as UTC, and
    anything unreadable as no time."""
    if not value or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


class _Proposals:
    """Saves one structuring result, resolving the model's refs to record IDs."""

    def __init__(self, db: Session, evidence: Evidence, finder: ChunkFinder):
        self.db = db
        self.evidence = evidence
        self.case_id = evidence.case_id
        self.finder = finder
        self.refs: dict[str, tuple[str, int]] = {"evidence": ("evidence", evidence.id)}

        self.persons: dict[str, Person] = {}
        for person in _active(db, Person, self.case_id):
            self.persons.setdefault(name_key(person.name), person)
        self.objects_by_plate: dict[str, CaseObject] = {}
        self.objects_by_number: dict[str, CaseObject] = {}
        self.objects_by_label: dict[tuple[str, str], CaseObject] = {}
        for obj in _active(db, CaseObject, self.case_id):
            self._index_object(obj)
        self.locations: dict[str, Location] = {}
        for location in _active(db, Location, self.case_id):
            self.locations.setdefault(normalize(location.address), location)
        self.relationships: dict[tuple, Relationship] = {}
        for rel in _active(db, Relationship, self.case_id):
            self.relationships.setdefault(
                _relationship_key(rel.from_type, rel.from_id, rel.to_type, rel.to_id, rel.kind), rel
            )
        self.linked = {
            (link.target_type, link.target_id, normalize(link.passage or ""))
            for link in db.scalars(select(EvidenceLink).where(EvidenceLink.evidence_id == evidence.id))
        }

    def save(self, result: StructuredEvidence) -> None:
        for location in result.locations:
            self._location(location)
        for person in result.persons:
            self._person(person)
        for obj in result.objects:
            self._object(obj)
        for event in result.events:
            self._event(event)
        for relationship in result.relationships:
            self._relationship(relationship)
        for observation in result.observations:
            self._observation(observation)
        self.db.flush()

    # Records

    def _person(self, item: PersonProposal) -> None:
        key = name_key(item.name)
        if not key:
            return
        person = self.persons.get(key)
        if person is None:
            person = self._add(
                Person(
                    case_id=self.case_id,
                    role=item.role,
                    name=item.name.strip(),
                    age=item.age,
                    occupation=item.occupation.strip(),
                    condition=item.condition,
                    contact=item.contact.strip(),
                    notes=item.notes.strip(),
                    details={},
                )
            )
            self.persons[key] = person
        self._found(item.ref, "person", person.id, item.passage)

    def _object(self, item: ObjectProposal) -> None:
        plate, number, label = plate_key(item.plate), number_key(item.number), normalize(item.label)
        obj = (
            (plate and self.objects_by_plate.get(plate))
            or (number and self.objects_by_number.get(number))
            or (label and self.objects_by_label.get((item.kind, label)))
            or None
        )
        if obj is None:
            fields = {
                "plate": item.plate,
                "number": item.number,
                "make": item.make,
                "model": item.model,
                "colour": item.colour,
            }
            details = {key: value.strip() for key, value in fields.items() if value.strip()}
            label = item.label.strip() or details.get("plate") or item.kind.capitalize()
            obj = self._add(CaseObject(case_id=self.case_id, kind=item.kind, label=label, details=details))
            self._index_object(obj)
        self._found(item.ref, "object", obj.id, item.passage)

    def _location(self, item: LocationProposal) -> None:
        key = normalize(item.address)
        if not key:
            return
        location = self.locations.get(key)
        if location is None:
            location = self._add(Location(case_id=self.case_id, kind=item.kind, address=item.address.strip()))
            self.locations[key] = location
        self._found(item.ref, "location", location.id, item.passage)

    def _event(self, item: EventProposal) -> None:
        description = item.description.strip()
        if not description:
            return
        location = self.refs.get(item.location_ref or "")
        event = self._add(
            Event(
                case_id=self.case_id,
                location_id=location[1] if location and location[0] == "location" else None,
                category=item.category,
                time_start=parse_time(item.time_start),
                time_end=parse_time(item.time_end),
                time_precision=item.time_precision,
                certainty=item.certainty,
                description=description,
                ai_note=(item.note or "").strip() or None,
            )
        )
        self._found(item.ref, "event", event.id, item.passage)

    def _relationship(self, item: RelationshipProposal) -> None:
        source, target = self.refs.get(item.from_ref), self.refs.get(item.to_ref)
        if source is None or target is None or source == target:
            return
        if source[0] not in GRAPH_NODE_TYPES or target[0] not in GRAPH_NODE_TYPES:
            return
        key = _relationship_key(*source, *target, item.kind)
        relationship = self.relationships.get(key)
        if relationship is None:
            confidence = None if item.confidence is None else min(max(item.confidence, 0.0), 1.0)
            relationship = self._add(
                Relationship(
                    case_id=self.case_id,
                    from_type=source[0],
                    from_id=source[1],
                    to_type=target[0],
                    to_id=target[1],
                    kind=item.kind,
                    label=item.label.strip() or item.kind.replace("_", " ").capitalize(),
                    confidence=confidence,
                )
            )
            self.relationships[key] = relationship
        self._link("relationship", relationship.id, item.passage)

    def _observation(self, item: ObservationProposal) -> None:
        statement = item.statement.strip()
        if not statement:
            return
        subject_type, subject_id = self.refs.get(item.subject_ref or "", ("case", self.case_id))
        observation = self._add(
            Observation(
                case_id=self.case_id,
                subject_type=subject_type,
                subject_id=subject_id,
                statement=statement,
                observed_at=parse_time(item.observed_at),
            )
        )
        self._link("observation", observation.id, item.passage)

    # Helpers

    def _add(self, row):
        row.origin = "ai"
        row.review_status = "pending"
        self.db.add(row)
        self.db.flush()
        return row

    def _found(self, ref: str, record_type: str, record_id: int, passage: str) -> None:
        if ref.strip():
            self.refs[ref.strip()] = (record_type, record_id)
        self._link(record_type, record_id, passage)

    def _link(self, target_type: str, target_id: int, passage: str) -> None:
        passage = passage.strip()
        key = (target_type, target_id, normalize(passage))
        if key in self.linked:
            return
        self.linked.add(key)
        chunk = self.finder.find(passage)
        self.db.add(
            EvidenceLink(
                evidence_id=self.evidence.id,
                chunk_id=chunk.id if chunk else None,
                target_type=target_type,
                target_id=target_id,
                passage=passage or None,
            )
        )

    def _index_object(self, obj: CaseObject) -> None:
        details = obj.details or {}
        if plate := plate_key(details.get("plate")):
            self.objects_by_plate.setdefault(plate, obj)
        if number := number_key(details.get("number")):
            self.objects_by_number.setdefault(number, obj)
        if label := normalize(obj.label):
            self.objects_by_label.setdefault((obj.kind, label), obj)


def _active(db: Session, model: type, case_id: int) -> list[Any]:
    """A case's records that haven't been rejected, oldest first."""
    query = select(model).where(model.case_id == case_id, model.review_status != "rejected").order_by(model.id)
    return list(db.scalars(query))


def _relationship_key(from_type: str, from_id: int, to_type: str, to_id: int, kind: str) -> tuple:
    return (from_type, from_id, to_type, to_id, kind)
