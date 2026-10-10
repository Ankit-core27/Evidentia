"""Tests for reports and the case audit trail (task B5)."""

import hashlib
import json
from datetime import UTC, datetime

from sqlalchemy import select

from app.models import AuditLog, Conflict, EvidenceLink, Injury, Reconstruction, Report
from tests.factories import (
    make_case,
    make_event,
    make_evidence,
    make_investigator,
    make_observation,
    make_person,
)


def _save(db, row):
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def make_conflict(db, case, **fields):
    values = {"observation_ids": [], "description": "Witnesses disagree on the signal colour.", "status": "open"}
    return _save(db, Conflict(case_id=case.id, **(values | fields)))


def make_reconstruction(db, case, **fields):
    values = {"scenario": "Van ran the red", "version": 1, "assumptions": "Signal timing from the controller log."}
    return _save(db, Reconstruction(case_id=case.id, **(values | fields)))


def make_injury(db, case, **fields):
    values = {"body_region": "Head", "type": "Laceration", "severity": "moderate"}
    return _save(db, Injury(case_id=case.id, **(values | fields)))


def make_link(db, evidence, target_type, target_id, **fields):
    return _save(db, EvidenceLink(evidence_id=evidence.id, target_type=target_type, target_id=target_id, **fields))


def make_audit(db, **fields):
    values = {"action": "viewed", "record_type": "case", "record_id": 1}
    return _save(db, AuditLog(**(values | fields)))


def make_report(db, case, **fields):
    values = {"template": "summary", "options": {}, "content": {}, "sha256": "f" * 64}
    return _save(db, Report(case_id=case.id, **(values | fields)))


def canonical_sha256(content):
    return hashlib.sha256(json.dumps(content, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def at(hour, minute=0):
    return datetime(2026, 10, 3, hour, minute, tzinfo=UTC)


def post_report(client, case_id, template, headers=None, **options):
    return client.post(f"/api/cases/{case_id}/reports", json={"template": template, "options": options}, headers=headers)


# POST /cases/{id}/reports ----------------------------------------------------


def test_create_report_stores_and_hashes_the_content(client, db):
    investigator = make_investigator(db)
    case = make_case(db, lead_investigator_id=investigator.id)
    make_evidence(db, case)

    response = post_report(client, case.id, "summary", headers={"X-Investigator-Id": str(investigator.id)})

    assert response.status_code == 201
    report = response.json()
    assert report["case_id"] == case.id
    assert report["template"] == "summary"
    assert report["options"] == {"include_ai_insights": False, "include_custody": False}
    assert report["created_by"] == investigator.id
    assert report["created_at"].endswith("Z")
    assert report["sha256"] == canonical_sha256(report["content"])
    stored = db.get(Report, report["id"])
    assert stored.sha256 == report["sha256"]
    assert stored.content == report["content"]


def test_create_report_audits_the_export(client, db):
    investigator = make_investigator(db)
    case = make_case(db)

    report = post_report(client, case.id, "court", headers={"X-Investigator-Id": str(investigator.id)}).json()

    entries = db.scalars(select(AuditLog)).all()
    assert [(e.action, e.record_type, e.record_id, e.case_id, e.actor_id, e.detail) for e in entries] == [
        ("exported", "report", report["id"], case.id, investigator.id, {"template": "court"})
    ]


def test_create_report_without_an_investigator(client, db):
    case = make_case(db)
    report = post_report(client, case.id, "summary").json()
    assert report["created_by"] is None
    assert db.scalars(select(AuditLog)).one().actor_id is None


def test_create_report_defaults_the_options(client, db):
    case = make_case(db)
    response = client.post(f"/api/cases/{case.id}/reports", json={"template": "court"})
    assert response.status_code == 201
    assert response.json()["options"] == {"include_ai_insights": False, "include_custody": False}


def test_create_report_rejects_unknown_cases_and_bad_bodies(client, db):
    case = make_case(db)
    missing = post_report(client, case.id + 1, "court")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Case not found"
    assert client.post(f"/api/cases/{case.id}/reports", json={"template": "autopsy"}).status_code == 422
    assert client.post(f"/api/cases/{case.id}/reports", json={}).status_code == 422
    assert (
        client.post(f"/api/cases/{case.id}/reports", json={"template": "court", "options": {"pdf": True}}).status_code
        == 422
    )
    assert db.scalars(select(Report)).all() == []


def test_court_report_content(client, db):
    lead = make_investigator(db, name="Insp. Meera Rao")
    case = make_case(db, lead_investigator_id=lead.id, description="Car and van collide at a junction.")
    other = make_case(db, title="Warehouse fire")
    statement = make_evidence(db, case, type="statement", title="Witness statement", collected_at=at(18))
    photo = make_evidence(db, case, type="photo", title="Scene photo", sha256="a" * 64, size_bytes=2048)
    make_evidence(db, other, title="Other case file")

    victim = make_person(db, case, role="victim", name="Ravi Kumar")
    make_person(db, case, name="Rejected proposal", origin="ai", review_status="rejected")
    pending_person = make_person(db, case, name="Pending proposal", origin="ai", review_status="pending")

    late = make_event(db, case, description="Ambulance arrives.", time_start=at(16, 25), category="emergency")
    untimed = make_event(db, case, description="Phone call to the driver.", certainty="hypothesis")
    early = make_event(db, case, description="Van enters the junction.", time_start=at(16, 9), certainty="disputed")
    make_event(db, case, description="Rejected event.", time_start=at(16, 0), review_status="rejected")

    amber = make_observation(db, case, statement="The light was amber.")
    red = make_observation(db, case, statement="The light was red.")
    make_observation(db, case, statement="Pending statement.", origin="ai", review_status="pending")
    make_link(db, statement, "observation", amber.id, passage="amber")
    make_link(db, photo, "observation", amber.id)
    make_link(db, statement, "observation", amber.id, passage="amber again")
    make_conflict(db, case, observation_ids=[amber.id, red.id, 999], description="Signal colour disputed.")
    make_conflict(db, case, description="Resolved already.", status="resolved")

    make_reconstruction(db, case, scenario="Van ran the red", version=2, assumptions="Signal log is accurate.")
    make_injury(db, case, person_id=victim.id, body_region="Head")
    make_injury(db, case, body_region="Arm", review_status="rejected", origin="ai")

    content = post_report(client, case.id, "court").json()["content"]

    assert content["case"]["id"] == case.id
    assert content["case"]["case_number"] == case.case_number
    assert content["case"]["lead_investigator_name"] == "Insp. Meera Rao"
    assert content["summary"] == "Car and van collide at a junction."
    assert content["evidence"] == [
        {
            "id": statement.id,
            "title": "Witness statement",
            "type": "statement",
            "sha256": "0" * 64,
            "size_bytes": 1024,
            "collected_at": "2026-10-03T18:00:00Z",
        },
        {
            "id": photo.id,
            "title": "Scene photo",
            "type": "photo",
            "sha256": "a" * 64,
            "size_bytes": 2048,
            "collected_at": None,
        },
    ]
    assert [e["id"] for e in content["timeline"]] == [early.id, late.id, untimed.id]
    assert content["timeline"][0]["certainty"] == "disputed"
    assert [p["id"] for p in content["persons"]] == [victim.id, pending_person.id]
    assert content["confirmed_findings"] == [
        {"statement": "The light was amber.", "evidence_ids": [statement.id, photo.id]},
        {"statement": "The light was red.", "evidence_ids": []},
    ]
    assert content["open_conflicts"] == [
        {
            "description": "Signal colour disputed.",
            "statements": ["The light was amber.", "The light was red.", ""],
        }
    ]
    assert content["uncertainties"] == [
        "Van enters the junction. (disputed)",
        "Phone call to the driver. (hypothesis)",
        "2 AI-proposed items are still waiting for review.",
    ]
    assert content["reconstructions"] == [
        {"scenario": "Van ran the red", "version": 2, "assumptions": "Signal log is accurate."}
    ]
    assert [(i["body_region"], i["person_id"]) for i in content["injuries"]] == [("Head", victim.id)]
    assert content["ai_insights"] is None
    assert content["custody"] is None


def test_court_report_without_a_lead_or_pending_reviews(client, db):
    case = make_case(db, lead_investigator_id=None)
    content = post_report(client, case.id, "court").json()["content"]
    assert content["case"]["lead_investigator_name"] is None
    assert content["uncertainties"] == []


def test_summary_report_leaves_out_reconstructions_and_injuries(client, db):
    case = make_case(db)
    event = make_event(db, case, time_start=at(16, 10))
    make_conflict(db, case)
    make_reconstruction(db, case)
    make_injury(db, case)

    content = post_report(client, case.id, "summary").json()["content"]

    assert [e["id"] for e in content["timeline"]] == [event.id]
    assert len(content["open_conflicts"]) == 1
    assert content["reconstructions"] == []
    assert content["injuries"] == []
    assert content["custody"] is None


def test_custody_report_holds_the_ledger_but_no_analysis(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    other = make_case(db, title="Other case")
    first = make_evidence(db, case, title="First.pdf", summary="A summary")
    second = make_evidence(db, case, title="Second.pdf")
    elsewhere = make_evidence(db, other)
    make_event(db, case, certainty="hypothesis")
    make_conflict(db, case)
    make_injury(db, case)
    later = make_audit(db, action="viewed", record_type="evidence", record_id=second.id, at=at(17), case_id=case.id)
    earlier = make_audit(
        db,
        action="uploaded",
        record_type="evidence",
        record_id=first.id,
        at=at(16),
        case_id=case.id,
        actor_id=investigator.id,
    )
    make_audit(db, record_type="evidence", record_id=elsewhere.id, at=at(15), case_id=other.id)
    make_audit(db, record_type="case", record_id=case.id, at=at(15), case_id=case.id)

    content = post_report(client, case.id, "custody", include_ai_insights=True).json()["content"]

    assert [e["id"] for e in content["evidence"]] == [first.id, second.id]
    assert content["custody"] == [
        {
            "id": earlier.id,
            "actor_id": investigator.id,
            "actor_name": investigator.name,
            "action": "uploaded",
            "record_type": "evidence",
            "record_id": first.id,
            "at": "2026-10-03T16:00:00Z",
            "detail": None,
        },
        {
            "id": later.id,
            "actor_id": None,
            "actor_name": None,
            "action": "viewed",
            "record_type": "evidence",
            "record_id": second.id,
            "at": "2026-10-03T17:00:00Z",
            "detail": None,
        },
    ]
    assert content["ai_insights"] is None
    assert content["timeline"] == []
    assert content["open_conflicts"] == []
    assert content["uncertainties"] == []
    assert content["reconstructions"] == []
    assert content["injuries"] == []


def test_medical_report_keeps_to_medical_evidence_and_persons(client, db):
    case = make_case(db)
    autopsy = make_evidence(db, case, type="medical", title="Autopsy.pdf", summary="Blunt force trauma.")
    make_evidence(db, case, type="statement", title="Statement.pdf", summary="Saw the van.")
    unsummarised = make_evidence(db, case, type="medical", title="Unsummarised.pdf")
    victim = make_person(db, case, role="victim", name="Ravi Kumar")
    make_observation(db, case, subject_type="person", subject_id=victim.id, statement="Head wound.")
    make_observation(db, case, statement="The light was red.")
    make_event(db, case, time_start=at(16, 10))
    make_conflict(db, case)
    make_reconstruction(db, case)
    injury = make_injury(db, case, person_id=victim.id)

    content = post_report(client, case.id, "medical", include_ai_insights=True).json()["content"]

    assert [e["id"] for e in content["evidence"]] == [autopsy.id, unsummarised.id]
    assert [f["statement"] for f in content["confirmed_findings"]] == ["Head wound."]
    assert [i["id"] for i in content["injuries"]] == [injury.id]
    assert content["ai_insights"] == ["Autopsy.pdf: Blunt force trauma."]
    assert content["timeline"] == []
    assert content["open_conflicts"] == []
    assert content["uncertainties"] == []
    assert content["reconstructions"] == []
    assert content["custody"] is None


def test_options_add_ai_insights_and_custody(client, db):
    case = make_case(db)
    report_pdf = make_evidence(db, case, title="Police report.pdf", summary="Van ran the red.")
    make_evidence(db, case, title="Photo.jpg", type="photo", summary="")
    make_evidence(db, case, title="Audio.mp3", type="audio", summary=None)
    make_audit(db, action="uploaded", record_type="evidence", record_id=report_pdf.id, case_id=case.id)

    response = post_report(client, case.id, "court", include_ai_insights=True, include_custody=True)

    report = response.json()
    assert report["options"] == {"include_ai_insights": True, "include_custody": True}
    assert report["content"]["ai_insights"] == ["Police report.pdf: Van ran the red."]
    assert [(e["action"], e["record_id"]) for e in report["content"]["custody"]] == [("uploaded", report_pdf.id)]


def test_same_content_gives_the_same_hash(client, db):
    case = make_case(db)
    make_evidence(db, case)
    first = post_report(client, case.id, "summary").json()
    second = post_report(client, case.id, "summary").json()
    assert first["id"] != second["id"]
    assert first["sha256"] == second["sha256"]
    make_evidence(db, case, title="New file.pdf")
    assert post_report(client, case.id, "summary").json()["sha256"] != first["sha256"]


# GET /reports/{id} and GET /cases/{id}/reports ---------------------------------


def test_get_report_returns_the_stored_content(client, db):
    case = make_case(db)
    make_evidence(db, case, collected_at=at(18))
    make_event(db, case, time_start=at(16, 10))
    created = post_report(client, case.id, "court", include_custody=True).json()

    response = client.get(f"/api/reports/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created
    assert canonical_sha256(response.json()["content"]) == created["sha256"]


def test_get_report_not_found(client, db):
    response = client.get("/api/reports/42")
    assert response.status_code == 404
    assert response.json()["detail"] == "Report not found"


def test_list_reports_newest_first_without_content(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    other = make_case(db, title="Other case")
    older = make_report(db, case, template="court", created_at=at(9), created_by=investigator.id)
    newer = make_report(
        db,
        case,
        template="custody",
        created_at=at(11),
        options={"include_ai_insights": False, "include_custody": True},
    )
    same_time = make_report(db, case, created_at=at(9))
    make_report(db, other, created_at=at(12))

    response = client.get(f"/api/cases/{case.id}/reports")

    assert response.status_code == 200
    rows = response.json()
    assert [r["id"] for r in rows] == [newer.id, same_time.id, older.id]
    assert rows[0] == {
        "id": newer.id,
        "case_id": case.id,
        "template": "custody",
        "options": {"include_ai_insights": False, "include_custody": True},
        "sha256": "f" * 64,
        "created_by": None,
        "created_at": "2026-10-03T11:00:00Z",
    }
    assert rows[2]["options"] == {"include_ai_insights": False, "include_custody": False}
    assert rows[2]["created_by"] == investigator.id


def test_list_reports_for_unknown_case(client, db):
    assert client.get("/api/cases/7/reports").status_code == 404


# GET /cases/{id}/audit -------------------------------------------------------


def test_case_audit_newest_first_by_case_id(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    other = make_case(db, title="Other case")
    first = make_audit(db, action="uploaded", record_type="evidence", record_id=4, case_id=case.id, at=at(9))
    # A record that has since been deleted still shows, through its case_id.
    second = make_audit(
        db,
        action="modified",
        record_type="person",
        record_id=12,
        case_id=case.id,
        at=at(10),
        actor_id=investigator.id,
        detail={"deleted": True},
    )
    tie = make_audit(db, action="reviewed", record_type="observation", record_id=3, case_id=case.id, at=at(9))
    make_audit(db, action="viewed", record_type="evidence", record_id=5, case_id=other.id, at=at(11))
    make_audit(db, action="viewed", record_type="case", record_id=case.id, case_id=None, at=at(11))

    response = client.get(f"/api/cases/{case.id}/audit")

    assert response.status_code == 200
    entries = response.json()
    assert [e["id"] for e in entries] == [second.id, tie.id, first.id]
    assert entries[0] == {
        "id": second.id,
        "actor_id": investigator.id,
        "actor_name": investigator.name,
        "action": "modified",
        "record_type": "person",
        "record_id": 12,
        "at": "2026-10-03T10:00:00Z",
        "detail": {"deleted": True},
    }


def test_case_audit_includes_report_exports(client, db):
    case = make_case(db)
    report = post_report(client, case.id, "summary").json()
    entries = client.get(f"/api/cases/{case.id}/audit").json()
    assert [(e["action"], e["record_type"], e["record_id"]) for e in entries] == [
        ("exported", "report", report["id"])
    ]


def test_case_audit_for_unknown_case(client, db):
    response = client.get("/api/cases/3/audit")
    assert response.status_code == 404
    assert response.json()["detail"] == "Case not found"
