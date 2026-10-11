"""Isolated synthetic reports exercise medical extraction without live Gemini."""
import pytest
from sqlalchemy import select
from app.models import AnatomyFinding, AiRun, AuditLog, EvidenceChunk, EvidenceLink, Injury
from app.services.ai import anatomy
from tests.factories import make_case, make_evidence, make_person
from tests.test_injuries import make_injury

@pytest.fixture
def report(db):
    case = make_case(db, title="SYNTHETIC anatomy acceptance case")
    person = make_person(db, case, name="Synthetic Patient", condition="injured")
    text = "Synthetic Patient. Right clavicle fracture, 3 cm. Liver is normal. Left lung contusion."
    evidence = make_evidence(db, case, type="medical", extracted_text=text)
    db.add(EvidenceChunk(evidence_id=evidence.id, ordinal=0, page=1, text=text))
    db.commit()
    return case, person, evidence

def proposal(**changes):
    return dict(person_reference="Synthetic Patient", anatomical_structure="clavicle_right", body_region="chest",
                finding_type="injury", description="Right clavicle fracture, 3 cm.", injury_type="fracture",
                supporting_passage="Right clavicle fracture, 3 cm.",
                measurements=[{"label": "length", "value": "3 cm"}]) | changes

def run(db, report, monkeypatch, items):
    monkeypatch.setattr(anatomy, "generate_json", lambda *a, **kw: ({"findings": items}, "raw"))
    _, person, evidence = report
    result = anatomy.analyze_medical(db, evidence, person, "medical", object(), None)
    db.commit()
    return result

def test_cited_pending_injury_without_invented_severity_or_death(db, report, monkeypatch):
    result = run(db, report, monkeypatch, [proposal()])
    injury = db.get(Injury, result.injury_ids[0])
    assert (injury.origin, injury.review_status, injury.severity) == ("ai", "pending", "unknown")
    assert injury.medical_details["measurements"] == [{"label": "length", "value": "3 cm"}]
    assert injury.medical_details["marker"] is None
    link = db.scalars(select(EvidenceLink)).one()
    assert (link.target_type, link.target_id, link.evidence_id) == ("injury", injury.id, report[2].id)
    assert db.get(EvidenceChunk, link.chunk_id).page == 1
    assert report[1].condition == "injured"
    assert db.scalars(select(AuditLog)).one().detail["medical_proposal"] is True

def test_normal_is_not_an_injury(db, report, monkeypatch):
    result = run(db, report, monkeypatch, [proposal(finding_type="explicitly_normal", injury_type=None,
        anatomical_structure="liver", body_region="abdomen", description="Liver is normal.",
        supporting_passage="Liver is normal.", measurements=[])])
    assert not result.injury_ids
    finding = db.get(AnatomyFinding, result.finding_ids[0])
    assert (finding.finding_type, finding.review_status) == ("explicitly_normal", "pending")

@pytest.mark.parametrize("change", [
    {"supporting_passage": "The clavicle was shattered."}, {"person_reference": "Another Patient"},
    {"measurements": [{"label": "length", "value": "30 cm"}]}, {"injury_severity_if_supported": "fatal"},
    {"injury_type": None}, {"invented_field": "not allowed"}, {"location_precision": "exact"},
    {"supporting_passage": "lavicle", "measurements": []},
])
def test_invalid_output_is_atomic_and_raw_run_retained(db, report, monkeypatch, change):
    with pytest.raises(ValueError):
        run(db, report, monkeypatch, [proposal(), proposal(**change)])
    db.rollback()
    assert not db.scalars(select(Injury)).all()
    assert not db.scalars(select(AnatomyFinding)).all()
    assert not db.scalars(select(EvidenceLink)).all()
    assert db.scalars(select(AiRun)).one().task == "medical_structure"

@pytest.mark.parametrize("text", ["Liver is abnormal.", "Liver is not normal.", "Liver is possibly normal."])
def test_normal_requires_affirmative_source(db, report, monkeypatch, text):
    db.scalars(select(EvidenceChunk)).one().text += " " + text
    db.commit()
    with pytest.raises(ValueError):
        run(db, report, monkeypatch, [proposal(finding_type="explicitly_normal", supporting_passage=text, measurements=[])])

def test_unsupported_anatomy_is_unresolved(db, report, monkeypatch):
    result = run(db, report, monkeypatch, [proposal(anatomical_structure="invented_organ")])
    injury = db.get(Injury, result.injury_ids[0])
    assert injury.structure_id is None
    assert injury.medical_details["location_precision"] == "unresolved"
    assert "invented_organ" in injury.medical_details["uncertainty"]

@pytest.mark.parametrize("status", ["pending", "confirmed", "rejected"])
def test_reanalysis_preserves_review_and_citation(db, report, monkeypatch, status):
    first = run(db, report, monkeypatch, [proposal()])
    injury = db.get(Injury, first.injury_ids[0])
    injury.review_status = status
    injury.description = "Investigator's retained wording"
    db.commit()
    second = run(db, report, monkeypatch, [proposal()])
    assert (second.created, second.retained, second.injury_ids) == (0, 1, first.injury_ids)
    db.refresh(injury)
    assert (injury.review_status, injury.description) == (status, "Investigator's retained wording")
    assert len(db.scalars(select(EvidenceLink)).all()) == 1

def test_different_trauma_types_in_one_passage_are_not_collapsed(db, report, monkeypatch):
    text = "Right clavicle fracture and laceration."
    db.scalars(select(EvidenceChunk)).one().text += " " + text
    db.commit()
    items = [proposal(injury_type=t, supporting_passage=text, measurements=[]) for t in ("fracture", "laceration")]
    assert run(db, report, monkeypatch, items).created == 2

def test_person_and_report_isolation(db, report, monkeypatch):
    first = run(db, report, monkeypatch, [proposal()])
    case, person, _ = report
    other = make_person(db, case, name="Synthetic Other", condition="deceased")
    evidence = make_evidence(db, case, type="medical", extracted_text="Synthetic Other. Liver is normal.")
    db.add(EvidenceChunk(evidence_id=evidence.id, text=evidence.extracted_text))
    db.commit()
    run(db, (case, other, evidence), monkeypatch, [proposal(person_reference=other.name,
        finding_type="explicitly_normal", supporting_passage="Liver is normal.", anatomical_structure="liver", measurements=[])])
    assert db.get(Injury, first.injury_ids[0]).person_id == person.id
    assert db.scalars(select(AnatomyFinding)).one().person_id == other.id

def test_missing_patient_identity_does_not_call_ai(db, report, monkeypatch):
    monkeypatch.setattr(anatomy, "generate_json", lambda *a, **kw: pytest.fail("AI must not run"))
    report[1].name = "Another Patient"
    with pytest.raises(ValueError, match="identity"):
        anatomy.analyze_medical(db, report[2], report[1], "medical", object(), None)

def test_routes_validate_case_membership_and_optional_ai(client, db, report):
    case, person, evidence = report
    body = {"person_id": person.id, "evidence_id": evidence.id, "report_kind": "medical"}
    url = f"/api/cases/{case.id}/medical-analysis"
    assert client.post(url, json=body).status_code == 503
    foreign = make_person(db, make_case(db))
    assert client.post(url, json=body | {"person_id": foreign.id}).status_code == 422
    foreign_evidence = make_evidence(db, make_case(db))
    assert client.post(url, json=body | {"evidence_id": foreign_evidence.id}).status_code == 422
    assert client.get(f"/api/cases/{case.id}/anatomy-findings").json() == []
    assert client.get("/api/cases/999/anatomy-findings").status_code == 404

def test_review_is_audited_and_case_scoped(client, db, report, monkeypatch):
    result = run(db, report, monkeypatch, [proposal(finding_type="abnormality")])
    fid = result.finding_ids[0]
    assert client.patch(f"/api/anatomy-findings/{fid}", json={"review_status": "rejected"}).status_code == 200
    db.expire_all()
    assert db.get(AnatomyFinding, fid).review_status == "rejected"
    audit = db.scalars(select(AuditLog).where(AuditLog.action == "reviewed")).one()
    assert (audit.record_type, audit.record_id) == ("anatomy_finding", fid)
    assert client.patch(f"/api/anatomy-findings/{fid}", json={"person_id": 22}).status_code == 422
    assert client.get(f"/api/cases/{make_case(db).id}/anatomy-findings").json() == []

def test_marker_bounds_and_origin(client, db, report):
    injury = make_injury(db, report[0], person_id=report[1].id, structure_id="clavicle_right")
    marker = {"structure_id": "clavicle_right", "local_position": [0, 0, 0]}
    url = f"/api/injuries/{injury.id}"
    response = client.patch(url, json={"medical_details": {"marker": marker}})
    assert response.status_code == 200
    assert response.json()["medical_details"]["marker"]["placement_origin"] == "investigator"
    for bad in [marker | {"local_position": [1, 0, 0]}, marker | {"structure_id": "heart"}, marker | {"placement_origin": "ai"}]:
        assert client.patch(url, json={"medical_details": {"marker": bad}}).status_code == 422
    assert client.patch(url, json={"structure_id": "heart"}).status_code == 422

@pytest.mark.parametrize("status", ["pending", "confirmed", "rejected"])
def test_reports_only_include_confirmed_anatomy_with_sources(db, report, monkeypatch, status):
    from app.services.reports.builder import build_report_content
    from app.schemas.reports import ReportOptions
    result = run(db, report, monkeypatch, [proposal(finding_type="abnormality")])
    finding = db.get(AnatomyFinding, result.finding_ids[0])
    finding.review_status = status
    db.commit()
    content = build_report_content(db, report[0], "medical", ReportOptions())
    assert len(content["confirmed_findings"]) == int(status == "confirmed")
    if status == "confirmed":
        assert content["confirmed_findings"][0]["evidence_ids"] == [report[2].id]
        assert report[1].name in content["confirmed_findings"][0]["statement"]


def test_route_ai_failure_retains_existing_findings(client, db, report, monkeypatch):
    from app.routers import anatomy as router
    run(db, report, monkeypatch, [proposal()])
    monkeypatch.setattr(router.client, "get_client", lambda: object())
    monkeypatch.setattr(anatomy, "generate_json", lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("offline")))
    response = client.post(f"/api/cases/{report[0].id}/medical-analysis", json={
        "person_id": report[1].id, "evidence_id": report[2].id, "report_kind": "medical"})
    assert response.status_code == 502
    assert len(db.scalars(select(Injury)).all()) == 1


def test_migration_round_trip_preserves_existing_injuries(tmp_path):
    import os
    from pathlib import Path
    import sqlite3
    import subprocess
    import sys
    backend = Path(__file__).resolve().parents[1]
    database = tmp_path / "migration.db"
    env = os.environ | {"DATABASE_URL": f"sqlite:///{database}", "STORAGE_DIR": str(tmp_path / "storage")}
    def migrate(*command):
        subprocess.run([sys.executable, "-m", "alembic", *command], cwd=backend, env=env, check=True, capture_output=True)
    migrate("upgrade", "0001")
    with sqlite3.connect(database) as db:
        db.execute("INSERT INTO cases (id,case_number,title,incident_type,status,priority,description,investigator_ids,created_at,updated_at) VALUES (1,'TEST','Retain this case','other','open','low','','[]','2026-10-11','2026-10-11')")
        db.execute("INSERT INTO injuries (id,case_id,body_region,type,severity,description,origin,review_status) VALUES (1,1,'head','laceration','minor','Original description','ai','confirmed')")
    migrate("upgrade", "head")
    with sqlite3.connect(database) as db:
        assert db.execute("SELECT description,review_status,medical_details FROM injuries").fetchone() == ('Original description', 'confirmed', '{}')
        assert db.execute("SELECT COUNT(*) FROM anatomy_findings").fetchone()[0] == 0
    migrate("downgrade", "0001")
    with sqlite3.connect(database) as db:
        assert db.execute("SELECT description,review_status FROM injuries").fetchone() == ('Original description', 'confirmed')
        assert 'medical_details' not in [row[1] for row in db.execute('PRAGMA table_info(injuries)')]
    migrate("upgrade", "head")

@pytest.mark.parametrize("text", ["The injury is non-fatal.", "The injury is not considered fatal."])
def test_negated_fatality_is_not_a_fatal_injury(db, report, monkeypatch, text):
    db.scalars(select(EvidenceChunk)).one().text += " " + text
    db.commit()
    with pytest.raises(ValueError, match="negated severity"):
        run(db, report, monkeypatch, [proposal(supporting_passage=text, measurements=[], injury_severity_if_supported="fatal")])


def test_configured_analysis_runs_only_on_explicit_post(client, db, report, monkeypatch):
    from app.core.records import case_counts
    from app.routers import anatomy as router
    calls = []
    def extract(*args, **kwargs):
        calls.append(kwargs["system"])
        return {"findings": [proposal()]}, "raw"
    monkeypatch.setattr(router.client, "get_client", lambda: object())
    monkeypatch.setattr(anatomy, "generate_json", extract)
    case, person, evidence = report
    assert client.get(f"/api/cases/{case.id}/anatomy-findings").status_code == 200
    assert client.get(f"/api/cases/{case.id}/injuries").status_code == 200
    assert not calls
    body = {"person_id": person.id, "evidence_id": evidence.id, "report_kind": "postmortem"}
    response = client.post(f"/api/cases/{case.id}/medical-analysis", json=body)
    assert response.status_code == 200
    assert response.json()["created"] == 1
    assert len(calls) == 1
    assert case_counts(db, case.id)["pending_reviews"] == 1
    injury_id = response.json()["injury_ids"][0]
    injury = db.get(Injury, injury_id)
    assert injury.medical_details["report_kind"] == "postmortem"
    assert person.condition == "injured"
    again = client.post(f"/api/cases/{case.id}/medical-analysis", json=body)
    assert (again.json()["created"], again.json()["retained"]) == (0, 1)
