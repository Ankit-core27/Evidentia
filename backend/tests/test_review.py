"""Tests for the review routes: the observation queue and conflicts."""

from sqlalchemy import select

from app.models import AuditLog, Conflict
from tests.factories import _save, make_case, make_investigator, make_observation


def make_conflict(db, case, **fields) -> Conflict:
    values = {"description": "Witnesses disagree on the signal colour", "observation_ids": [], "status": "open"}
    return _save(db, Conflict(case_id=case.id, **(values | fields)))


def audit_entries(db) -> list[AuditLog]:
    return db.scalars(select(AuditLog).order_by(AuditLog.id)).all()


# GET /cases/{id}/observations ------------------------------------------------------


def test_list_observations(client, db):
    case = make_case(db)
    other = make_case(db)
    amber = make_observation(db, case, origin="ai", review_status="pending")
    red = make_observation(db, case, statement="The light was red.", origin="ai", review_status="confirmed")
    mine = make_observation(db, case, statement="Skid marks are 14 m long.")
    make_observation(db, other, origin="ai", review_status="pending")

    response = client.get(f"/api/cases/{case.id}/observations")

    assert response.status_code == 200
    assert [o["id"] for o in response.json()] == [amber.id, red.id, mine.id]
    assert response.json()[0] == {
        "id": amber.id, "case_id": case.id, "subject_type": "case", "subject_id": case.id,
        "statement": "The light was amber.", "observed_at": None, "author_id": None,
        "origin": "ai", "review_status": "pending",
    }


def test_observations_filter_by_status(client, db):
    case = make_case(db)
    pending = make_observation(db, case, origin="ai", review_status="pending")
    make_observation(db, case, statement="The light was red.", origin="ai", review_status="rejected")
    confirmed = make_observation(db, case, statement="Skid marks are 14 m long.")
    url = f"/api/cases/{case.id}/observations"

    assert [o["id"] for o in client.get(f"{url}?status=pending").json()] == [pending.id]
    assert [o["id"] for o in client.get(f"{url}?status=confirmed").json()] == [confirmed.id]
    assert client.get(f"{url}?status=open").status_code == 422


def test_observations_of_an_unknown_case(client):
    response = client.get("/api/cases/999/observations")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


# PATCH /observations/{id} ---------------------------------------------------------


def test_confirm_an_observation(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    observation = make_observation(db, case, origin="ai", review_status="pending")

    response = client.patch(
        f"/api/observations/{observation.id}",
        json={"review_status": "confirmed"},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 200
    assert response.json()["review_status"] == "confirmed"
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "reviewed", "observation", observation.id, case.id, investigator.id,
        {"review_status": {"before": "pending", "after": "confirmed"}},
    )


def test_edit_and_confirm_an_observation(client, db):
    case = make_case(db)
    observation = make_observation(db, case, origin="ai", review_status="pending")

    response = client.patch(
        f"/api/observations/{observation.id}",
        json={"statement": "The light was turning amber.", "review_status": "confirmed"},
    )

    assert response.json()["statement"] == "The light was turning amber."
    [entry] = audit_entries(db)
    assert entry.action == "modified"
    assert entry.detail == {
        "statement": {"before": "The light was amber.", "after": "The light was turning amber."},
        "review_status": {"before": "pending", "after": "confirmed"},
    }


def test_patch_observation_rejects_bad_bodies_and_unknown_ids(client, db):
    case = make_case(db)
    observation = make_observation(db, case)

    assert client.patch(f"/api/observations/{observation.id}", json={"statement": ""}).status_code == 422
    assert client.patch(f"/api/observations/{observation.id}", json={"subject_id": 3}).status_code == 422
    missing = client.patch("/api/observations/999", json={"review_status": "rejected"})
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Observation not found"}
    assert audit_entries(db) == []


# GET /cases/{id}/conflicts ---------------------------------------------------------


def test_list_conflicts(client, db):
    case = make_case(db)
    other = make_case(db)
    amber = make_observation(db, case)
    red = make_observation(db, case, statement="The light was red.")
    signal = make_conflict(db, case, observation_ids=[amber.id, red.id])
    resolved = make_conflict(db, case, description="Time of the call", status="resolved")
    make_conflict(db, other)
    url = f"/api/cases/{case.id}/conflicts"

    response = client.get(url)

    assert response.status_code == 200
    assert response.json() == [
        {"id": signal.id, "case_id": case.id, "observation_ids": [amber.id, red.id],
         "description": "Witnesses disagree on the signal colour", "status": "open"},
        {"id": resolved.id, "case_id": case.id, "observation_ids": [], "description": "Time of the call",
         "status": "resolved"},
    ]
    assert [c["id"] for c in client.get(f"{url}?status=open").json()] == [signal.id]
    assert [c["id"] for c in client.get(f"{url}?status=resolved").json()] == [resolved.id]
    assert client.get(f"{url}?status=pending").status_code == 422
    assert client.get("/api/cases/999/conflicts").status_code == 404


# PATCH /conflicts/{id} -------------------------------------------------------------


def test_resolve_a_conflict(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    conflict = make_conflict(db, case)

    response = client.patch(
        f"/api/conflicts/{conflict.id}", json={"status": "resolved"}, headers={"X-Investigator-Id": str(investigator.id)}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", "conflict", conflict.id, case.id, investigator.id,
        {"status": {"before": "open", "after": "resolved"}},
    )


def test_patch_conflict_rejects_bad_bodies_and_unknown_ids(client, db):
    case = make_case(db)
    conflict = make_conflict(db, case)

    assert client.patch(f"/api/conflicts/{conflict.id}", json={}).status_code == 422
    assert client.patch(f"/api/conflicts/{conflict.id}", json={"status": "closed"}).status_code == 422
    missing = client.patch("/api/conflicts/999", json={"status": "resolved"})
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Conflict not found"}
