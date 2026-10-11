"""Tests for conflict detection (task A3). Gemini is never called: the pipeline's
fake client stands in for it, answering conflict checks with `findings`."""

import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models import AiRun, Conflict, EvidenceLink, Observation
from app.services.ai import client as ai_client
from app.services.ai.conflicts import (
    RESPONSE_SCHEMA,
    check_case_conflicts,
    detect_conflicts,
    group_observations,
)
from app.services.ai.pipeline import process_evidence
from tests.factories import make_case, make_event, make_evidence, make_location, make_object, make_observation
from tests.test_ai_pipeline import FakeGemini as PipelineFake
from tests.test_ai_pipeline import statement_evidence

AT = datetime(2026, 10, 3, 16, 10, 10, tzinfo=UTC)


class FakeGemini(PipelineFake):
    def __init__(self):
        super().__init__()
        self.findings: dict | str = {"findings": []}
        self.conflict_error: Exception | None = None

    def _generate(self, *, model, contents, config=None):
        if config is None or config.response_json_schema != RESPONSE_SCHEMA:
            return super()._generate(model=model, contents=contents, config=config)
        self.calls.append(SimpleNamespace(model=model, contents=contents, config=config))
        if self.conflict_error is not None:
            raise self.conflict_error
        findings = self.findings
        return SimpleNamespace(text=findings if isinstance(findings, str) else json.dumps(findings))

    def conflict_calls(self):
        return [c for c in self.calls if c.config is not None and c.config.response_json_schema == RESPONSE_SCHEMA]


@pytest.fixture
def gemini(monkeypatch):
    fake = FakeGemini()
    monkeypatch.setattr(ai_client, "get_client", lambda: fake)
    return fake


def ids(groups) -> list[list[int]]:
    return [[o.id for o in group] for group in groups]


def conflicts(db) -> list[Conflict]:
    db.expire_all()
    return list(db.scalars(select(Conflict).order_by(Conflict.id)))


def sent_groups(call) -> list[list[dict]]:
    return json.loads(call.contents[0].split("Observation groups:\n", 1)[1])


def signal_case(db):
    """Two accounts of the hatchback's signal and one of the van's."""
    case = make_case(db)
    hatchback = make_object(db, case)
    van = make_object(db, case, label="Blue delivery van", details={"plate": "KA-05-CD-6789"})
    amber = make_observation(
        db, case, subject_type="object", subject_id=hatchback.id, statement="The hatchback's light was amber."
    )
    red = make_observation(
        db, case, subject_type="object", subject_id=hatchback.id, statement="The hatchback's light was red."
    )
    early = make_observation(
        db, case, subject_type="object", subject_id=van.id, statement="The van moved off before green."
    )
    return case, amber, red, early


# ---------------------------------------------------------------------------
# Grouping
# ---------------------------------------------------------------------------


def test_observations_are_grouped_by_subject_place_and_time(db):
    case = make_case(db)
    hatchback = make_object(db, case)
    junction = make_location(db, case)
    collision = make_event(db, case, location_id=junction.id)

    def observe(subject_type, subject_id, observed_at=None, **fields):
        statement = f"Observation {subject_type} {subject_id} {observed_at}"
        return make_observation(
            db,
            case,
            subject_type=subject_type,
            subject_id=subject_id,
            statement=statement,
            observed_at=observed_at,
            **fields,
        )

    car_1 = observe("object", hatchback.id, AT)
    car_2 = observe("object", hatchback.id)
    place_1 = observe("location", junction.id, AT + timedelta(minutes=30))
    place_2 = observe("event", collision.id)
    time_1 = observe("case", case.id, AT + timedelta(minutes=1))
    later = observe("case", case.id, AT + timedelta(hours=2))  # far in time, same subject as time_1
    observe("object", hatchback.id, AT, review_status="rejected")
    observe("person", 99, AT + timedelta(minutes=4))  # outside the window that starts at car_1

    groups = ids(group_observations(db, case.id))

    assert groups == [
        [car_1.id, car_2.id],
        [place_1.id, place_2.id],
        [time_1.id, later.id],
        [car_1.id, time_1.id],
    ]


def test_identical_groups_are_listed_once(db):
    case = make_case(db)
    junction = make_location(db, case)
    first = make_observation(db, case, subject_type="location", subject_id=junction.id, statement="Light was amber.")
    second = make_observation(db, case, subject_type="location", subject_id=junction.id, statement="Light was red.")

    assert ids(group_observations(db, case.id)) == [[first.id, second.id]]


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------


def test_findings_are_saved_as_open_conflicts_and_logged(db, gemini):
    case, amber, red, early = signal_case(db)
    evidence = make_evidence(db, case, title="Witness statement")
    db.add(EvidenceLink(evidence_id=evidence.id, target_type="observation", target_id=amber.id, passage="amber"))
    db.commit()
    gemini.findings = {
        "findings": [
            {
                "kind": "conflict",
                "observation_ids": [amber.id, red.id, amber.id, 999],
                "description": "Accounts disagree on the hatchback's signal.",
            },
            {"kind": "conflict", "observation_ids": [amber.id, 999], "description": "Only one known observation."},
            {"kind": "gap", "observation_ids": [red.id], "description": "Nobody says who saw the red light."},
            {"kind": "gap", "observation_ids": [amber.id], "description": "   "},
            {"kind": "gap", "observation_ids": [early.id], "description": "Not in a group that was sent."},
        ]
    }

    created = detect_conflicts(db, case.id, gemini)
    db.commit()

    assert [(c.observation_ids, c.description, c.status) for c in conflicts(db)] == [
        ([amber.id, red.id], "Accounts disagree on the hatchback's signal.", "open"),
        ([red.id], "Nobody says who saw the red light.", "open"),
    ]
    assert len(created) == 2

    # Only the hatchback's group has two observations to compare.
    [call] = gemini.conflict_calls()
    [group] = sent_groups(call)
    assert [(item["id"], item["statement"]) for item in group] == [(amber.id, amber.statement), (red.id, red.statement)]
    assert group[0]["subject"] == "object: White hatchback"
    assert group[0]["sources"] == ["Witness statement"]
    assert group[1]["sources"] == []
    assert case.case_number in call.contents[0]

    [run] = db.scalars(select(AiRun).where(AiRun.task == "conflicts")).all()
    assert (run.case_id, run.evidence_id, run.model) == (case.id, None, "gemini-3.5-flash")
    assert run.output == {"groups": [group], "output": gemini.findings}


def test_groups_and_findings_matching_a_conflict_are_skipped(db, gemini):
    case, amber, red, _ = signal_case(db)
    db.add(Conflict(case_id=case.id, observation_ids=[red.id, amber.id], description="Known", status="resolved"))
    db.commit()

    assert detect_conflicts(db, case.id, gemini) == []
    assert gemini.conflict_calls() == []

    # A third account changes the group; a finding repeating the known conflict is still skipped.
    third = make_observation(db, case, subject_type=amber.subject_type, subject_id=amber.subject_id, statement="Green.")
    gemini.findings = {
        "findings": [
            {"kind": "conflict", "observation_ids": [amber.id, red.id], "description": "Same as before."},
            {"kind": "conflict", "observation_ids": [amber.id, third.id], "description": "Amber or green."},
        ]
    }
    detect_conflicts(db, case.id, gemini)
    db.commit()

    assert [c.observation_ids for c in conflicts(db)] == [[red.id, amber.id], [amber.id, third.id]]


def test_unchanged_groups_are_not_checked_twice(db, gemini):
    case, amber, red, _ = signal_case(db)

    detect_conflicts(db, case.id, gemini)
    db.commit()
    detect_conflicts(db, case.id, gemini)
    assert len(gemini.conflict_calls()) == 1

    # An edited statement is a change, so the group is checked again.
    red.statement = "The hatchback's light was green."
    db.commit()
    detect_conflicts(db, case.id, gemini)
    assert len(gemini.conflict_calls()) == 2


def test_invalid_json_is_logged_and_checked_again_next_time(db, gemini):
    case, *_ = signal_case(db)
    gemini.findings = "not json"

    with pytest.raises(ValueError):
        detect_conflicts(db, case.id, gemini)
    db.rollback()

    [run] = db.scalars(select(AiRun).where(AiRun.task == "conflicts")).all()
    assert run.output["output"] == "not json"
    gemini.findings = {"findings": []}
    detect_conflicts(db, case.id, gemini)
    assert len(gemini.conflict_calls()) == 2


def test_nothing_happens_without_a_key(db):
    case, *_ = signal_case(db)

    check_case_conflicts(db, case.id)

    assert conflicts(db) == []
    assert db.scalars(select(AiRun)).all() == []


def test_a_failed_check_is_logged_not_raised(db, gemini):
    case, *_ = signal_case(db)
    gemini.conflict_error = RuntimeError("503 UNAVAILABLE")

    check_case_conflicts(db, case.id)

    assert conflicts(db) == []


# ---------------------------------------------------------------------------
# From the pipeline
# ---------------------------------------------------------------------------


def test_a_new_statement_opens_a_conflict_when_evidence_is_processed(db, gemini):
    case = make_case(db)
    hatchback = make_object(db, case, details={"plate": "KA-01-AB-1234"})
    red = make_observation(
        db,
        case,
        subject_type="object",
        subject_id=hatchback.id,
        statement="The hatchback's signal was red before it reached the junction.",
        review_status="confirmed",
    )
    gemini.structured = {
        "summary": "A witness says the hatchback entered on amber.",
        "objects": [
            {
                "ref": "o1",
                "kind": "vehicle",
                "label": "White hatchback",
                "plate": "KA 01 AB 1234",
                "passage": "The white hatchback, KA 01 AB 1234, entered the junction on amber.",
            }
        ],
        "observations": [
            {
                "subject_ref": "o1",
                "statement": "The witness says the hatchback entered the junction on amber.",
                "passage": "The white hatchback, KA 01 AB 1234, entered the junction on amber.",
            }
        ],
    }
    # Each test starts with an empty database, so the new observation is the next ID.
    amber_id = red.id + 1
    gemini.findings = {
        "findings": [
            {
                "kind": "conflict",
                "observation_ids": [red.id, amber_id],
                "description": "Witnesses disagree on the hatchback's signal when it entered the junction.",
            }
        ]
    }
    evidence = statement_evidence(db, case)

    process_evidence(evidence.id)

    [conflict] = conflicts(db)
    amber = db.scalar(select(Observation).where(Observation.origin == "ai"))
    assert amber.id == amber_id
    assert conflict.observation_ids == [red.id, amber.id]
    assert conflict.status == "open"
    assert db.get(type(evidence), evidence.id).processing_status == "done"


def test_a_failed_check_leaves_the_evidence_done(db, gemini):
    case, *_ = signal_case(db)
    gemini.conflict_error = RuntimeError("503 UNAVAILABLE")
    evidence = statement_evidence(db, case)

    process_evidence(evidence.id)

    db.expire_all()
    evidence = db.get(type(evidence), evidence.id)
    assert (evidence.processing_status, evidence.summary) == ("done", None)
    assert len(gemini.conflict_calls()) == 1
