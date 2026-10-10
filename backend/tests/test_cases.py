"""Cases, investigators and the workspace call (task B1)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import AuditLog, Conflict, EvidenceLink, Injury, Relationship
from app.models.base import utcnow
from tests.factories import (
    make_case,
    make_event,
    make_evidence,
    make_investigator,
    make_location,
    make_object,
    make_person,
)


def audit_rows(db):
    db.expire_all()
    return db.scalars(select(AuditLog).order_by(AuditLog.id)).all()


def test_investigators_are_listed_by_id(client, db):
    first = make_investigator(db)
    second = make_investigator(db, name="SI Arjun Menon", badge_number="TP-2210")
    response = client.get("/api/investigators")
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [first.id, second.id]
    assert response.json()[0] == {
        "id": first.id,
        "name": "Insp. Meera Rao",
        "badge_number": "TP-1042",
        "role": "Lead investigator",
        "clearance_level": "L3",
    }


def test_create_case_numbers_it_and_audits(client, db):
    lead = make_investigator(db)
    response = client.post(
        "/api/cases",
        json={
            "title": "Ring Road junction collision",
            "incident_type": "road_accident",
            "priority": "high",
            "incident_at": "2026-10-03T21:40:00+05:30",
            "lead_investigator_id": lead.id,
            "investigator_ids": [lead.id],
        },
        headers={"X-Investigator-Id": str(lead.id)},
    )
    assert response.status_code == 201
    case = response.json()
    assert case["case_number"] == f"FX-{utcnow().year}-{case['id']:04d}"
    assert case["status"] == "open"
    assert case["description"] == ""
    assert case["incident_at"] == "2026-10-03T16:10:00Z"
    assert case["investigator_ids"] == [lead.id]
    assert case["created_at"].endswith("Z")

    [entry] = audit_rows(db)
    assert (entry.action, entry.record_type, entry.record_id) == ("modified", "case", case["id"])
    assert (entry.case_id, entry.actor_id, entry.detail) == (case["id"], lead.id, {"created": True})


def test_create_case_rejects_unknown_investigators(client, db):
    lead = make_investigator(db)
    body = {"title": "Collision", "incident_type": "road_accident", "priority": "high"}

    response = client.post("/api/cases", json=body | {"lead_investigator_id": 99})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "lead_investigator_id"]

    response = client.post("/api/cases", json=body | {"investigator_ids": [lead.id, 98, 99]})
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Investigators not found: 98, 99"

    assert client.post("/api/cases", json=body | {"colour": "red"}).status_code == 422
    assert client.post("/api/cases", json=body | {"title": ""}).status_code == 422
    assert client.get("/api/cases").json() == []
    assert audit_rows(db) == []


def test_list_cases_newest_first_with_evidence_count(client, db):
    now = datetime.now(UTC)
    older = make_case(db, created_at=now - timedelta(days=2))
    newer = make_case(db, created_at=now)
    make_evidence(db, older)
    make_evidence(db, older)

    rows = client.get("/api/cases").json()
    assert [row["id"] for row in rows] == [newer.id, older.id]
    assert [row["evidence_count"] for row in rows] == [0, 2]
    assert rows[1]["case_number"] == older.case_number


def test_list_cases_filters_by_status_and_priority(client, db):
    open_high = make_case(db, status="open", priority="high")
    make_case(db, status="closed", priority="high")
    make_case(db, status="open", priority="low")

    assert [r["id"] for r in client.get("/api/cases?status=open&priority=high").json()] == [open_high.id]
    assert len(client.get("/api/cases?status=closed").json()) == 1
    assert client.get("/api/cases?status=archived").status_code == 422


def test_list_cases_searches_related_records(client, db):
    lead = make_investigator(db, name="Insp. Meera Rao")
    by_lead = make_case(db, title="Lead case", description="", lead_investigator_id=lead.id)
    by_place = make_case(db, title="Place case", description="")
    make_location(db, by_place, address="Ring Road and 5th Avenue")
    by_person = make_case(db, title="Person case", description="")
    make_person(db, by_person, name="Ravi Kumar")
    by_text = make_case(db, title="Hit and run", description="Grey SUV fled north")

    def search(q):
        return {row["id"] for row in client.get("/api/cases", params={"q": q}).json()}

    assert search("meera") == {by_lead.id}
    assert search("5TH AVENUE") == {by_place.id}
    assert search("ravi") == {by_person.id}
    assert search("suv") == {by_text.id}
    assert search(by_place.case_number) == {by_place.id}
    assert search("  ") == {by_lead.id, by_place.id, by_person.id, by_text.id}
    assert search("100%") == set()


def test_get_case_and_404(client, db):
    case = make_case(db)
    assert client.get(f"/api/cases/{case.id}").json()["title"] == case.title
    response = client.get("/api/cases/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


def make_stale_case(db):
    case = make_case(db)
    case.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    db.commit()
    return case


def test_patch_case_audits_and_bumps_updated_at(client, db):
    investigator = make_investigator(db)
    case = make_stale_case(db)

    response = client.patch(
        f"/api/cases/{case.id}",
        json={"status": "in_progress", "priority": "high", "lead_investigator_id": investigator.id},
        headers={"X-Investigator-Id": str(investigator.id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["lead_investigator_id"]) == ("in_progress", investigator.id)
    assert body["updated_at"] > "2026-01-02"

    [entry] = audit_rows(db)
    assert (entry.action, entry.record_type, entry.case_id) == ("modified", "case", case.id)
    assert entry.detail == {
        "status": {"before": "open", "after": "in_progress"},
        "lead_investigator_id": {"before": None, "after": investigator.id},
    }


def test_patch_case_without_changes_writes_nothing(client, db):
    case = make_stale_case(db)
    body = client.patch(f"/api/cases/{case.id}", json={"title": case.title}).json()
    assert body["updated_at"] == "2026-01-01T00:00:00Z"
    assert audit_rows(db) == []


def test_patch_case_rejects_bad_values(client, db):
    case = make_case(db)
    for body, field in [
        ({"status": None}, "status"),
        ({"investigator_ids": None}, "investigator_ids"),
        ({"lead_investigator_id": 42}, "lead_investigator_id"),
        ({"investigator_ids": [42]}, "investigator_ids"),
    ]:
        response = client.patch(f"/api/cases/{case.id}", json=body)
        assert response.status_code == 422, body
        assert response.json()["detail"][0]["loc"] == ["body", field]

    assert client.patch(f"/api/cases/{case.id}", json={"incident_at": None}).json()["incident_at"] is None
    assert client.patch("/api/cases/999", json={"title": "x"}).status_code == 404


def test_workspace_returns_the_case_records_and_counts(client, db):
    case = make_case(db)
    other = make_case(db)
    evidence = make_evidence(db, case)
    other_evidence = make_evidence(db, other)
    driver = make_person(db, case, role="suspect", name="Suresh Nair", origin="ai", review_status="pending")
    make_person(db, other)
    van = make_object(db, case)
    site = make_location(db, case)
    event = make_event(db, case, location_id=site.id)
    db.add_all([
        Relationship(case_id=case.id, from_type="person", from_id=driver.id, to_type="object", to_id=van.id, kind="drove"),
        Injury(case_id=case.id, person_id=driver.id, body_region="head", type="laceration", severity="minor"),
        Conflict(case_id=case.id, description="Signal colour"),
        EvidenceLink(evidence_id=evidence.id, target_type="event", target_id=event.id, passage="at 16:10"),
        EvidenceLink(evidence_id=other_evidence.id, target_type="case", target_id=other.id),
    ])
    db.commit()

    response = client.get(f"/api/cases/{case.id}/workspace")
    assert response.status_code == 200
    workspace = response.json()
    assert workspace["case"]["id"] == case.id
    assert [p["id"] for p in workspace["persons"]] == [driver.id]
    assert [o["id"] for o in workspace["objects"]] == [van.id]
    assert [loc["id"] for loc in workspace["locations"]] == [site.id]
    assert [e["id"] for e in workspace["evidence"]] == [evidence.id]
    assert "extracted_text" not in workspace["evidence"][0]
    assert [e["location_id"] for e in workspace["events"]] == [site.id]
    assert [r["kind"] for r in workspace["relationships"]] == ["drove"]
    assert [i["body_region"] for i in workspace["injuries"]] == ["head"]
    assert [(link["target_type"], link["passage"]) for link in workspace["links"]] == [("event", "at 16:10")]
    assert workspace["counts"] == {
        "evidence": 1,
        "pending_reviews": 1,
        "open_conflicts": 1,
        "ai_items_total": 1,
        "ai_items_reviewed": 0,
    }

    assert client.get("/api/cases/999/workspace").status_code == 404
