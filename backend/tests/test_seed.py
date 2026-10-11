"""Tests for the seed case (app/seed.py)."""

from datetime import UTC, datetime

import pymupdf
import pytest
from google.genai.models import Models
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.records import case_counts
from app.core.storage import absolute_path, sha256_of, storage_root
from app.models import (
    AuditLog,
    Case,
    CaseObject,
    Conflict,
    Event,
    Evidence,
    EvidenceChunk,
    EvidenceLink,
    Injury,
    Investigator,
    Location,
    Observation,
    Person,
    Reconstruction,
    ReconstructionStage,
    Relationship,
    SceneAnnotation,
    SceneObject,
)
from app.seed import SeedError, main, seed

EXPECTED_COUNTS = {
    Investigator: 4,
    Case: 4,
    Evidence: 12,
    Person: 6,
    CaseObject: 4,
    Location: 8,
    Event: 14,
    Relationship: 12,
    Observation: 8,
    Conflict: 2,
    Injury: 3,
    Reconstruction: 2,
    ReconstructionStage: 5,
    SceneObject: 10,
    SceneAnnotation: 3,
    EvidenceLink: 36,
    # One upload per evidence item, plus a view, two reviews and a status change.
    AuditLog: 16,
}


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def test_seed_loads_every_record_of_the_mock(db):
    seed(db)
    assert {model: count(db, model) for model in EXPECTED_COUNTS} == EXPECTED_COUNTS


def test_cases_match_the_mock(db):
    seed(db)
    cases = db.scalars(select(Case).order_by(Case.id)).all()
    assert [case.case_number for case in cases] == ["FX-2026-0001", "FX-2026-0002", "FX-2026-0003", "FX-2026-0004"]
    collision = cases[0]
    assert collision.status == "in_progress"
    assert collision.incident_at == datetime(2026, 10, 3, 16, 10, 12, tzinfo=UTC)
    # Setting the case number after the insert keeps the seeded updated_at.
    assert collision.updated_at == datetime(2026, 10, 5, 5, 50, tzinfo=UTC)
    lead = db.get(Investigator, collision.lead_investigator_id)
    assert lead.name == "Insp. Meera Rao"
    assert len(collision.investigator_ids) == 4
    assert case_counts(db, collision.id) == {
        "evidence": 8,
        "pending_reviews": 15,
        "open_conflicts": 2,
        "ai_items_total": 22,
        "ai_items_reviewed": 7,
    }


def test_origin_and_review_status_follow_the_mock(db):
    seed(db)
    cyclist = db.scalar(select(Person).where(Person.name == "Unidentified cyclist"))
    assert (cyclist.origin, cyclist.review_status) == ("ai", "pending")
    rohan = db.scalar(select(Person).where(Person.name == "Rohan Kapoor"))
    assert (rohan.origin, rohan.review_status) == ("investigator", "confirmed")
    van_moves_off = db.scalar(select(Event).where(Event.description == "Van moves off into the junction"))
    assert (van_moves_off.origin, van_moves_off.review_status, van_moves_off.certainty) == ("ai", "pending", "disputed")
    contradicts = db.scalar(select(Relationship).where(Relationship.kind == "contradicts"))
    assert contradicts.flagged and contradicts.confidence == 0.92
    assert {contradicts.from_type, contradicts.to_type} == {"evidence"}


def test_signal_conflicts_point_at_their_observations(db):
    seed(db)
    for conflict in db.scalars(select(Conflict)):
        observations = [db.get(Observation, observation_id) for observation_id in conflict.observation_ids]
        assert all(observation.case_id == conflict.case_id for observation in observations)
    hatchback_signal = db.scalar(select(Conflict).where(Conflict.description.like("%hatchback's signal%")))
    statements = [db.get(Observation, i).statement for i in hatchback_signal.observation_ids]
    assert any("amber" in s for s in statements) and any("red" in s for s in statements)


def test_reconstructions_have_staged_scene_objects(db):
    seed(db)
    for reconstruction in db.scalars(select(Reconstruction)):
        stages = db.scalars(
            select(ReconstructionStage)
            .where(ReconstructionStage.reconstruction_id == reconstruction.id)
            .order_by(ReconstructionStage.stage_order)
        ).all()
        assert [stage.label for stage in stages][:2] == ["Approach", "Impact"]
        for stage in stages:
            assert all(db.get(Event, event_id).case_id == reconstruction.case_id for event_id in stage.event_ids)
            placed = db.scalars(select(SceneObject).where(SceneObject.stage_id == stage.id)).all()
            assert {db.get(CaseObject, p.object_id).label for p in placed} == {"White hatchback", "Delivery van"}


def test_evidence_files_are_stored_and_verify(db):
    seed(db)
    evidence = db.scalars(select(Evidence)).all()
    mismatches = [e.id for e in evidence if sha256_of(e.file_path) != e.sha256]
    assert mismatches == []
    for item in evidence:
        assert item.file_path.startswith(f"{item.case_id}/")
        assert item.size_bytes == absolute_path(item.file_path).stat().st_size > 0
        assert item.processing_status == "done"
        assert item.processed_at is not None and item.processed_at > item.created_at


def test_pdfs_have_a_text_layer(db):
    seed(db)
    report = db.scalar(select(Evidence).where(Evidence.title.like("Police accident report%")))
    with pymupdf.open(absolute_path(report.file_path)) as pdf:
        assert pdf.page_count == 2
        assert "Rohan Kapoor" in pdf[0].get_text()
        assert "skid marks" in pdf[1].get_text()


def test_text_evidence_is_indexed(db):
    seed(db)
    for item in db.scalars(select(Evidence)):
        chunks = db.scalars(select(EvidenceChunk).where(EvidenceChunk.evidence_id == item.id)).all()
        if item.extracted_text is None:
            assert item.type == "photo" and chunks == []
            continue
        assert chunks
        if item.mime_type == "application/pdf":
            assert all(chunk.page is not None for chunk in chunks)
        else:
            assert all(chunk.page is None for chunk in chunks)


def test_every_link_points_at_the_chunk_holding_its_passage(db):
    seed(db)
    links = db.scalars(select(EvidenceLink)).all()
    for link in links:
        assert link.chunk_id is not None
        chunk = db.get(EvidenceChunk, link.chunk_id)
        assert chunk.evidence_id == link.evidence_id
        assert " ".join(link.passage.split()) in " ".join(chunk.text.split())
    injury_links = [link for link in links if link.target_type == "injury"]
    assert {link.target_id for link in injury_links} == set(db.scalars(select(Injury.id)))


def test_audit_history_is_in_time_order(db):
    seed(db)
    entries = db.scalars(select(AuditLog).order_by(AuditLog.id)).all()
    assert [entry.at for entry in entries] == sorted(entry.at for entry in entries)
    assert all(entry.case_id is not None for entry in entries)
    status_change = db.scalar(select(AuditLog).where(AuditLog.record_type == "case"))
    assert status_change.detail == {"status": {"before": "open", "after": "in_progress"}}
    assert status_change.actor_name == "Insp. Meera Rao"


def test_seed_never_calls_gemini(db, monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("the seed called Gemini")

    monkeypatch.setattr(Models, "embed_content", refuse)
    monkeypatch.setattr(Models, "generate_content", refuse)
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")
    seed(db)
    assert get_settings().gemini_api_key == "test-key"
    assert all(chunk.embedding is None for chunk in db.scalars(select(EvidenceChunk)))


def test_second_run_refuses(db):
    seed(db)
    with pytest.raises(SeedError):
        seed(db)
    assert count(db, Case) == 4
    assert count(db, Evidence) == 12


def test_cli_refuses_a_seeded_database_and_reset_reloads_it(capsys):
    assert main([]) == 0
    assert "Seeded 4 investigators, 4 cases, 12 evidence files" in capsys.readouterr().out
    assert main([]) == 1
    assert "already has cases" in capsys.readouterr().err

    assert main(["--reset"]) == 0
    with SessionLocal() as db:
        assert count(db, Case) == 4
        assert count(db, Investigator) == 4
        stored = {e.file_path for e in db.scalars(select(Evidence))}
    # The reset removed the first run's files, so only the new ones are left.
    on_disk = {path.relative_to(storage_root()).as_posix() for path in storage_root().rglob("*") if path.is_file()}
    assert on_disk == stored
