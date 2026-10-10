"""Tests for the injuries routes (task B4)."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.models import AuditLog, Injury
from tests.factories import make_case, make_investigator, make_person


def make_injury(db, case, **fields) -> Injury:
    values = {"body_region": "Head", "type": "Laceration", "severity": "moderate"}
    injury = Injury(case_id=case.id, **(values | fields))
    db.add(injury)
    db.commit()
    db.refresh(injury)
    return injury


def audit_rows(db):
    return db.scalars(select(AuditLog).where(AuditLog.record_type == "injury").order_by(AuditLog.id)).all()


def test_list_injuries_returns_only_this_case_in_id_order(client, db):
    case, other = make_case(db), make_case(db, title="Other case")
    person = make_person(db, case, role="victim", name="Rohan Kapoor")
    first = make_injury(
        db,
        case,
        person_id=person.id,
        structure_id="skull_frontal",
        depth="2 cm",
        estimated_time=datetime(2026, 10, 3, 16, 10, tzinfo=UTC),
        description="Above the left eye.",
        origin="ai",
        review_status="pending",
    )
    make_injury(db, other)
    second = make_injury(db, case, body_region="Left forearm", type="Fracture", severity="severe")

    response = client.get(f"/api/cases/{case.id}/injuries")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": first.id,
            "case_id": case.id,
            "person_id": person.id,
            "body_region": "Head",
            "structure_id": "skull_frontal",
            "type": "Laceration",
            "severity": "moderate",
            "depth": "2 cm",
            "estimated_time": "2026-10-03T16:10:00Z",
            "description": "Above the left eye.",
            "origin": "ai",
            "review_status": "pending",
        },
        {
            "id": second.id,
            "case_id": case.id,
            "person_id": None,
            "body_region": "Left forearm",
            "structure_id": None,
            "type": "Fracture",
            "severity": "severe",
            "depth": None,
            "estimated_time": None,
            "description": "",
            "origin": "investigator",
            "review_status": "confirmed",
        },
    ]


def test_list_injuries_of_unknown_case_is_404(client):
    response = client.get("/api/cases/99/injuries")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


def test_create_injury_is_confirmed_and_audited(client, db):
    case = make_case(db)
    person = make_person(db, case, role="victim", name="Rohan Kapoor")
    investigator = make_investigator(db)

    response = client.post(
        f"/api/cases/{case.id}/injuries",
        json={
            "person_id": person.id,
            "body_region": "Chest",
            "type": "Contusion",
            "severity": "minor",
            "estimated_time": "2026-10-03T21:40:00+05:30",
        },
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 201
    injury = response.json()
    assert injury == {
        "id": injury["id"],
        "case_id": case.id,
        "person_id": person.id,
        "body_region": "Chest",
        "structure_id": None,
        "type": "Contusion",
        "severity": "minor",
        "depth": None,
        "estimated_time": "2026-10-03T16:10:00Z",
        "description": "",
        "origin": "investigator",
        "review_status": "confirmed",
    }
    [entry] = audit_rows(db)
    assert (entry.action, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified",
        injury["id"],
        case.id,
        investigator.id,
        {"created": True},
    )


def test_create_injury_person_must_belong_to_the_case(client, db):
    case = make_case(db)
    foreign = make_person(db, make_case(db, title="Other case"))
    body = {"body_region": "Head", "type": "Laceration", "severity": "moderate"}

    for person_id in (foreign.id, 999):
        response = client.post(f"/api/cases/{case.id}/injuries", json=body | {"person_id": person_id})
        assert response.status_code == 422
        assert [e["loc"] for e in response.json()["detail"]] == [["body", "person_id"]]

    assert db.scalars(select(Injury)).all() == []
    assert audit_rows(db) == []


def test_create_injury_rejects_bad_bodies(client, db):
    case = make_case(db)
    url = f"/api/cases/{case.id}/injuries"
    body = {"body_region": "Head", "type": "Laceration", "severity": "moderate"}
    assert client.post(url, json={k: v for k, v in body.items() if k != "severity"}).status_code == 422
    assert client.post(url, json=body | {"severity": "critical"}).status_code == 422
    assert client.post(url, json=body | {"body_region": ""}).status_code == 422
    assert client.post(url, json=body | {"review_status": "pending"}).status_code == 422


def test_create_injury_for_unknown_case_is_404(client):
    response = client.post(
        "/api/cases/99/injuries", json={"body_region": "Head", "type": "Laceration", "severity": "moderate"}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


def test_update_injury_logs_before_and_after(client, db):
    case = make_case(db)
    person = make_person(db, case, role="victim", name="Rohan Kapoor")
    injury = make_injury(db, case)
    investigator = make_investigator(db)

    response = client.patch(
        f"/api/injuries/{injury.id}",
        json={"severity": "severe", "person_id": person.id, "description": "Deep cut."},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 200
    assert response.json()["severity"] == "severe"
    assert response.json()["person_id"] == person.id
    assert response.json()["description"] == "Deep cut."
    assert response.json()["body_region"] == "Head"
    [entry] = audit_rows(db)
    assert (entry.action, entry.record_id, entry.case_id, entry.actor_id) == (
        "modified",
        injury.id,
        case.id,
        investigator.id,
    )
    assert entry.detail == {
        "severity": {"before": "moderate", "after": "severe"},
        "person_id": {"before": None, "after": person.id},
        "description": {"before": "", "after": "Deep cut."},
    }


def test_reviewing_an_ai_injury_logs_reviewed(client, db):
    case = make_case(db)
    injury = make_injury(db, case, origin="ai", review_status="pending")

    response = client.patch(f"/api/injuries/{injury.id}", json={"review_status": "confirmed"})

    assert response.status_code == 200
    assert response.json()["review_status"] == "confirmed"
    assert response.json()["origin"] == "ai"
    [entry] = audit_rows(db)
    assert (entry.action, entry.case_id, entry.detail) == (
        "reviewed",
        case.id,
        {"review_status": {"before": "pending", "after": "confirmed"}},
    )


def test_update_injury_time_comes_back_in_utc(client, db):
    injury = make_injury(db, make_case(db))

    response = client.patch(f"/api/injuries/{injury.id}", json={"estimated_time": "2026-10-03T21:40:00+05:30"})

    assert response.status_code == 200
    assert response.json()["estimated_time"] == "2026-10-03T16:10:00Z"
    assert client.get(f"/api/cases/{injury.case_id}/injuries").json()[0]["estimated_time"] == "2026-10-03T16:10:00Z"


def test_update_injury_without_changes_writes_no_audit(client, db):
    injury = make_injury(db, make_case(db))

    response = client.patch(f"/api/injuries/{injury.id}", json={"severity": "moderate"})

    assert response.status_code == 200
    assert audit_rows(db) == []


def test_update_injury_person_must_belong_to_the_case(client, db):
    case = make_case(db)
    foreign = make_person(db, make_case(db, title="Other case"))
    injury = make_injury(db, case)

    response = client.patch(f"/api/injuries/{injury.id}", json={"person_id": foreign.id})

    assert response.status_code == 422
    assert [e["loc"] for e in response.json()["detail"]] == [["body", "person_id"]]
    db.expire_all()
    assert db.get(Injury, injury.id).person_id is None
    assert audit_rows(db) == []


def test_update_injury_can_unlink_the_person(client, db):
    case = make_case(db)
    person = make_person(db, case)
    injury = make_injury(db, case, person_id=person.id)

    response = client.patch(f"/api/injuries/{injury.id}", json={"person_id": None})

    assert response.status_code == 200
    assert response.json()["person_id"] is None


def test_update_injury_rejects_bad_bodies(client, db):
    injury = make_injury(db, make_case(db))
    url = f"/api/injuries/{injury.id}"
    assert client.patch(url, json={"severity": "critical"}).status_code == 422
    assert client.patch(url, json={"review_status": "maybe"}).status_code == 422
    assert client.patch(url, json={"case_id": 2}).status_code == 422


def test_update_unknown_injury_is_404(client):
    response = client.patch("/api/injuries/99", json={"severity": "minor"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Injury not found"}
