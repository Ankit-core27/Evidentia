"""Tests for the dashboard and the alerts feed (task B5)."""

from datetime import UTC, datetime

from app.models import Conflict, Injury, Relationship
from tests.factories import (
    make_case,
    make_event,
    make_evidence,
    make_investigator,
    make_location,
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


def make_injury(db, case, **fields):
    values = {"body_region": "Head", "type": "Laceration", "severity": "moderate"}
    return _save(db, Injury(case_id=case.id, **(values | fields)))


def make_relationship(db, case, **fields):
    values = {"from_type": "person", "from_id": 1, "to_type": "object", "to_id": 1, "kind": "drove"}
    return _save(db, Relationship(case_id=case.id, **(values | fields)))


def at(day, hour=12):
    return datetime(2026, 10, day, hour, tzinfo=UTC)


def case_at(db, number, updated_at, **fields):
    """A case with a fixed number and updated_at (make_case would bump updated_at
    when it sets the number)."""
    return make_case(db, case_number=f"FX-2026-{number:04d}", updated_at=updated_at, **fields)


# GET /dashboard --------------------------------------------------------------


def test_empty_dashboard(client, db):
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    assert response.json() == {
        "total_cases": 0,
        "active_cases": 0,
        "pending_reviews": 0,
        "storage_bytes": 0,
        "status_counts": {"open": 0, "in_progress": 0, "under_review": 0, "closed": 0},
        "incident_points": [],
        "investigators": [],
    }


def test_dashboard_counts_cases_by_status(client, db):
    make_case(db, status="open")
    make_case(db, status="open")
    make_case(db, status="under_review")
    make_case(db, status="closed")

    body = client.get("/api/dashboard").json()

    assert body["total_cases"] == 4
    assert body["active_cases"] == 3
    assert body["status_counts"] == {"open": 2, "in_progress": 0, "under_review": 1, "closed": 1}


def test_dashboard_pending_reviews_across_cases(client, db):
    first = make_case(db)
    second = make_case(db, status="closed")
    make_person(db, first, origin="ai", review_status="pending")
    make_event(db, first, origin="ai", review_status="pending")
    make_observation(db, first, origin="ai", review_status="pending")
    make_injury(db, second, origin="ai", review_status="pending")
    make_relationship(db, second, origin="ai", review_status="pending")
    # Reviewed AI rows and investigator rows don't count.
    make_person(db, first, origin="ai", review_status="confirmed")
    make_person(db, first, origin="ai", review_status="rejected")
    make_person(db, second, origin="investigator", review_status="pending")

    assert client.get("/api/dashboard").json()["pending_reviews"] == 5


def test_dashboard_storage_is_the_sum_of_evidence_sizes(client, db):
    first = make_case(db)
    second = make_case(db)
    make_evidence(db, first, size_bytes=1000)
    make_evidence(db, first, size_bytes=24)
    make_evidence(db, second, size_bytes=5_000_000_000)

    assert client.get("/api/dashboard").json()["storage_bytes"] == 5_000_001_024


def test_dashboard_incident_points(client, db):
    case = make_case(db, title="Ring Road junction collision", priority="critical")
    other = make_case(db, title="Warehouse fire", incident_type="fire", incident_at=None)
    make_location(db, case, address="Ring Road and 5th Avenue", lat=12.97, lng=77.59)
    make_location(db, case, kind="witness_position", address="Bus stop", lat=12.98, lng=77.6)
    make_location(db, case, address="No coordinates", lat=None, lng=None)
    make_location(db, case, address="Half a coordinate", lat=12.9, lng=None)
    make_location(db, other, address="Industrial Estate", lat=0.0, lng=0.0)

    points = client.get("/api/dashboard").json()["incident_points"]

    assert points == [
        {
            "case_id": case.id,
            "case_number": case.case_number,
            "title": "Ring Road junction collision",
            "incident_type": "road_accident",
            "priority": "critical",
            "address": "Ring Road and 5th Avenue",
            "lat": 12.97,
            "lng": 77.59,
            "incident_at": "2026-10-03T16:10:00Z",
        },
        {
            "case_id": other.id,
            "case_number": other.case_number,
            "title": "Warehouse fire",
            "incident_type": "fire",
            "priority": "high",
            "address": "Industrial Estate",
            "lat": 0.0,
            "lng": 0.0,
            "incident_at": None,
        },
    ]


def test_dashboard_investigator_stats(client, db):
    rao = make_investigator(db, name="Insp. Meera Rao")
    khan = make_investigator(db, name="SI Arjun Khan", badge_number="TP-2210", role="Field officer")
    idle = make_investigator(db, name="Dr. Leela Nair")
    make_case(db, lead_investigator_id=rao.id, investigator_ids=[rao.id, khan.id], status="open")
    make_case(db, lead_investigator_id=rao.id, investigator_ids=[rao.id], status="closed")
    make_case(db, lead_investigator_id=rao.id, investigator_ids=[khan.id], status="closed")
    make_case(db, lead_investigator_id=khan.id, investigator_ids=[khan.id], status="in_progress")

    investigators = client.get("/api/dashboard").json()["investigators"]

    assert investigators == [
        {
            "id": rao.id,
            "name": "Insp. Meera Rao",
            "badge_number": "TP-1042",
            "role": "Lead investigator",
            "clearance_level": "L3",
            "solved_cases": 2,
            "active_cases": 1,
        },
        {
            "id": khan.id,
            "name": "SI Arjun Khan",
            "badge_number": "TP-2210",
            "role": "Field officer",
            "clearance_level": "L3",
            "solved_cases": 0,
            "active_cases": 2,
        },
        {
            "id": idle.id,
            "name": "Dr. Leela Nair",
            "badge_number": "TP-1042",
            "role": "Lead investigator",
            "clearance_level": "L3",
            "solved_cases": 0,
            "active_cases": 0,
        },
    ]


# GET /alerts -----------------------------------------------------------------


def test_no_alerts(client, db):
    make_case(db)
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json() == []


def test_conflict_alerts_for_open_conflicts(client, db):
    case = case_at(db, 1, at(5))
    conflict = make_conflict(db, case, description="Signal colour disputed.")
    make_conflict(db, case, status="resolved")

    assert client.get("/api/alerts").json() == [
        {
            "id": f"conflict-{conflict.id}",
            "kind": "conflict",
            "severity": "warning",
            "title": "Conflicting statements",
            "message": "Signal colour disputed.",
            "case_id": case.id,
            "case_number": "FX-2026-0001",
            "record_type": "conflict",
            "record_id": conflict.id,
            "created_at": "2026-10-05T12:00:00Z",
        }
    ]


def test_review_alert_per_case_with_pending_proposals(client, db):
    case = case_at(db, 1, at(5))
    quiet = case_at(db, 2, at(6))
    make_person(db, case, origin="ai", review_status="pending")
    make_event(db, case, origin="ai", review_status="pending")
    make_person(db, quiet, origin="ai", review_status="confirmed")

    assert client.get("/api/alerts").json() == [
        {
            "id": f"review-{case.id}",
            "kind": "review",
            "severity": "info",
            "title": "2 AI proposals to review",
            "message": "New people, events, links or statements were proposed from the evidence in FX-2026-0001.",
            "case_id": case.id,
            "case_number": "FX-2026-0001",
            "record_type": None,
            "record_id": None,
            "created_at": "2026-10-05T12:00:00Z",
        }
    ]


def test_processing_alerts_from_processed_at(client, db):
    case = case_at(db, 1, at(1))
    done = make_evidence(db, case, title="Police report.pdf", processing_status="done", processed_at=at(4, 9))
    failed = make_evidence(
        db,
        case,
        title="Dashcam.mp4",
        processing_status="failed",
        processed_at=datetime(2026, 10, 4, 10, 30, 15, 250000, tzinfo=UTC),
    )
    make_evidence(db, case, title="Never processed", processing_status="queued", processed_at=None)
    make_evidence(db, case, title="Being reprocessed", processing_status="processing", processed_at=at(4, 11))
    make_evidence(db, case, title="Done without a time", processing_status="done", processed_at=None)

    alerts = client.get("/api/alerts").json()

    assert alerts == [
        {
            "id": f"processing-{failed.id}-2026-10-04T10:30:15.250000Z",
            "kind": "processing",
            "severity": "critical",
            "title": "Processing failed",
            "message": "Dashcam.mp4",
            "case_id": case.id,
            "case_number": "FX-2026-0001",
            "record_type": "evidence",
            "record_id": failed.id,
            "created_at": "2026-10-04T10:30:15.250000Z",
        },
        {
            "id": f"processing-{done.id}-2026-10-04T09:00:00Z",
            "kind": "processing",
            "severity": "info",
            "title": "Processing finished",
            "message": "Police report.pdf",
            "case_id": case.id,
            "case_number": "FX-2026-0001",
            "record_type": "evidence",
            "record_id": done.id,
            "created_at": "2026-10-04T09:00:00Z",
        },
    ]


def test_alerts_newest_first(client, db):
    older = case_at(db, 1, at(2))
    newer = case_at(db, 2, at(6))
    old_conflict = make_conflict(db, older)
    make_person(db, older, origin="ai", review_status="pending")
    new_conflict = make_conflict(db, newer)
    second_conflict = make_conflict(db, newer)
    make_observation(db, newer, origin="ai", review_status="pending")
    middle = make_evidence(db, older, processed_at=at(4))
    latest = make_evidence(db, newer, processed_at=at(8))

    ids = [alert["id"] for alert in client.get("/api/alerts").json()]

    # Same-time alerts keep the mock's order: per case, its conflicts then its review alert.
    assert ids == [
        f"processing-{latest.id}-2026-10-08T12:00:00Z",
        f"conflict-{new_conflict.id}",
        f"conflict-{second_conflict.id}",
        f"review-{newer.id}",
        f"processing-{middle.id}-2026-10-04T12:00:00Z",
        f"conflict-{old_conflict.id}",
        f"review-{older.id}",
    ]
