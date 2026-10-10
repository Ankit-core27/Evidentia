"""Tests for the timeline routes: case events and the cleanup when one is deleted."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.models import AuditLog, Event, EvidenceLink, Reconstruction, ReconstructionStage
from tests.factories import _save, make_case, make_event, make_evidence, make_investigator, make_location


def make_reconstruction(db, case, **fields) -> Reconstruction:
    values = {"scenario": "Van ran the red light"}
    return _save(db, Reconstruction(case_id=case.id, **(values | fields)))


def make_stage(db, reconstruction, **fields) -> ReconstructionStage:
    values = {"label": "Approach", "stage_order": 0, "event_ids": []}
    return _save(db, ReconstructionStage(reconstruction_id=reconstruction.id, **(values | fields)))


def make_link(db, evidence, target_type, target_id) -> EvidenceLink:
    return _save(db, EvidenceLink(evidence_id=evidence.id, target_type=target_type, target_id=target_id))


def audit_entries(db) -> list[AuditLog]:
    return db.scalars(select(AuditLog).order_by(AuditLog.id)).all()


def at(hour: int, minute: int) -> datetime:
    return datetime(2026, 10, 3, hour, minute, tzinfo=UTC)


# GET /cases/{id}/events ----------------------------------------------------------


def test_events_by_time_with_untimed_last(client, db):
    case = make_case(db)
    other = make_case(db)
    untimed = make_event(db, case, category="investigation", description="Scene sketched")
    impact = make_event(db, case, time_start=at(16, 10))
    approach = make_event(db, case, category="movement", description="Van approaches", time_start=at(16, 9))
    call = make_event(db, case, category="emergency", description="Ambulance called", time_start=at(16, 10))
    also_untimed = make_event(db, case, category="other", description="Unknown")
    make_event(db, other, time_start=at(15, 0))

    response = client.get(f"/api/cases/{case.id}/events")

    assert response.status_code == 200
    assert [e["id"] for e in response.json()] == [approach.id, impact.id, call.id, untimed.id, also_untimed.id]
    assert response.json()[0] == {
        "id": approach.id, "case_id": case.id, "location_id": None, "category": "movement",
        "time_start": "2026-10-03T16:09:00Z", "time_end": None, "time_precision": "minute",
        "certainty": "established", "description": "Van approaches", "ai_note": None,
        "origin": "investigator", "review_status": "confirmed",
    }


def test_events_filter_by_category(client, db):
    case = make_case(db)
    collision = make_event(db, case, time_start=at(16, 10))
    make_event(db, case, category="movement", description="Van approaches", time_start=at(16, 9))

    response = client.get(f"/api/cases/{case.id}/events?category=collision")

    assert [e["id"] for e in response.json()] == [collision.id]
    assert client.get(f"/api/cases/{case.id}/events?category=party").status_code == 422


def test_events_of_an_unknown_case(client):
    response = client.get("/api/cases/999/events")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


# POST /cases/{id}/events ---------------------------------------------------------


def test_create_event(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    site = make_location(db, case)

    response = client.post(
        f"/api/cases/{case.id}/events",
        json={"category": "collision", "description": "Van strikes the hatchback", "location_id": site.id,
              "time_start": "2026-10-03T21:40:00+05:30", "time_precision": "approximate", "certainty": "disputed"},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 201
    body = response.json()
    assert body == {
        "id": body["id"], "case_id": case.id, "location_id": site.id, "category": "collision",
        "time_start": "2026-10-03T16:10:00Z", "time_end": None, "time_precision": "approximate",
        "certainty": "disputed", "description": "Van strikes the hatchback", "ai_note": None,
        "origin": "investigator", "review_status": "confirmed",
    }
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", "event", body["id"], case.id, investigator.id, {"created": True}
    )


def test_create_event_defaults(client, db):
    case = make_case(db)
    response = client.post(f"/api/cases/{case.id}/events", json={"category": "other", "description": "Note"})
    assert response.status_code == 201
    body = response.json()
    assert (body["time_start"], body["time_precision"], body["certainty"]) == (None, "minute", "established")


def test_create_event_location_must_be_in_the_case(client, db):
    case = make_case(db)
    elsewhere = make_location(db, make_case(db))
    url = f"/api/cases/{case.id}/events"

    for location_id in (elsewhere.id, 999):
        response = client.post(url, json={"category": "other", "description": "Note", "location_id": location_id})
        assert response.status_code == 422
        assert response.json()["detail"] == [
            {"loc": ["body", "location_id"], "msg": "Location not found in this case", "type": "value_error"}
        ]
    assert db.scalars(select(Event)).all() == []


def test_create_event_rejects_bad_bodies(client, db):
    case = make_case(db)
    url = f"/api/cases/{case.id}/events"
    assert client.post(url, json={"category": "other"}).status_code == 422
    assert client.post(url, json={"category": "other", "description": ""}).status_code == 422
    assert client.post(url, json={"category": "other", "description": "x", "certainty": "sure"}).status_code == 422
    assert client.post("/api/cases/999/events", json={"category": "other", "description": "x"}).status_code == 404


# PATCH /events/{id} --------------------------------------------------------------


def test_edit_event(client, db):
    case = make_case(db)
    site = make_location(db, case)
    event = make_event(db, case, time_start=at(16, 10))

    response = client.patch(
        f"/api/events/{event.id}",
        json={"time_start": "2026-10-03T16:11:00Z", "location_id": site.id, "certainty": "hypothesis"},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["time_start"], body["location_id"], body["certainty"]) == ("2026-10-03T16:11:00Z", site.id, "hypothesis")
    [entry] = audit_entries(db)
    assert entry.action == "modified"
    assert entry.case_id == case.id
    assert entry.detail == {
        "time_start": {"before": "2026-10-03T16:10:00Z", "after": "2026-10-03T16:11:00Z"},
        "location_id": {"before": None, "after": site.id},
        "certainty": {"before": "established", "after": "hypothesis"},
    }


def test_edit_event_times_are_stored_and_audited_in_utc(client, db):
    case = make_case(db)
    event = make_event(db, case, time_start=at(16, 10))

    same_instant = client.patch(f"/api/events/{event.id}", json={"time_start": "2026-10-03T21:40:00+05:30"})
    naive = client.patch(f"/api/events/{event.id}", json={"time_end": "2026-10-03T16:12:00"})

    assert same_instant.json()["time_start"] == "2026-10-03T16:10:00Z"
    assert naive.json()["time_end"] == "2026-10-03T16:12:00Z"
    [entry] = audit_entries(db)
    assert entry.detail == {"time_end": {"before": None, "after": "2026-10-03T16:12:00Z"}}


def test_review_event(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    event = make_event(db, case, origin="ai", review_status="pending")

    response = client.patch(
        f"/api/events/{event.id}", json={"review_status": "rejected"}, headers={"X-Investigator-Id": str(investigator.id)}
    )

    assert response.json()["review_status"] == "rejected"
    [entry] = audit_entries(db)
    assert (entry.action, entry.actor_id, entry.detail) == (
        "reviewed", investigator.id, {"review_status": {"before": "pending", "after": "rejected"}}
    )


def test_edit_event_location_must_be_in_the_case(client, db):
    case = make_case(db)
    site = make_location(db, case)
    elsewhere = make_location(db, make_case(db))
    event = make_event(db, case, location_id=site.id)

    response = client.patch(f"/api/events/{event.id}", json={"location_id": elsewhere.id})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "location_id"]
    db.refresh(event)
    assert event.location_id == site.id

    cleared = client.patch(f"/api/events/{event.id}", json={"location_id": None})
    assert cleared.status_code == 200
    assert cleared.json()["location_id"] is None


def test_edit_unknown_event(client):
    response = client.patch("/api/events/999", json={"description": "x"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}


# DELETE /events/{id} -------------------------------------------------------------


def test_delete_event_cleans_up_stages_and_links(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case)
    approach = make_event(db, case, category="movement", description="Van approaches")
    impact = make_event(db, case)
    reconstruction = make_reconstruction(db, case)
    first = make_stage(db, reconstruction, event_ids=[approach.id, impact.id])
    second = make_stage(db, reconstruction, label="Impact", stage_order=1, event_ids=[impact.id])
    untouched = make_stage(db, make_reconstruction(db, case, scenario="Car ran the red"), event_ids=[approach.id])
    make_link(db, evidence, "event", impact.id)
    kept_link = make_link(db, evidence, "event", approach.id)

    impact_id = impact.id

    response = client.delete(f"/api/events/{impact_id}", headers={"X-Investigator-Id": str(investigator.id)})

    assert response.status_code == 204
    assert response.content == b""
    db.expire_all()
    assert [e.id for e in db.scalars(select(Event))] == [approach.id]
    assert db.get(ReconstructionStage, first.id).event_ids == [approach.id]
    assert db.get(ReconstructionStage, second.id).event_ids == []
    assert db.get(ReconstructionStage, untouched.id).event_ids == [approach.id]
    assert [link.id for link in db.scalars(select(EvidenceLink))] == [kept_link.id]
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", "event", impact_id, case.id, investigator.id, {"deleted": True}
    )


def test_delete_unknown_event(client):
    response = client.delete("/api/events/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}
