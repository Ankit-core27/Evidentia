"""Tests for the chain of custody (app/routers/custody.py, app/services/evidence/custody.py)."""

import hashlib
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.storage import absolute_path
from app.models import CustodyEvent, CustodyTransfer, Evidence, Investigator
from app.models.custody import AppendOnlyError
from app.services.evidence import custody
from tests.factories import make_case, make_investigator

FILE_BYTES = b"Signal controller log J-17-09\n22:13:44 Phase 1 red\n"


@pytest.fixture(autouse=True)
def no_pipeline(monkeypatch):
    """Uploads queue the AI pipeline; these tests don't need it."""
    monkeypatch.setattr("app.routers.evidence.process_evidence", lambda evidence_id: None)


@pytest.fixture
def team(db):
    """A case with a lead and two assigned investigators, plus one who isn't on it."""
    lead = make_investigator(db, name="PSI Anil Pawar")
    officer = make_investigator(db, name="Const. Rahul Verma")
    analyst = make_investigator(db, name="SI Arjun Mehta")
    outsider = make_investigator(db, name="Insp. Meera Rao")
    case = make_case(db, lead_investigator_id=lead.id, investigator_ids=[lead.id, officer.id, analyst.id])
    return {"case": case, "lead": lead.id, "officer": officer.id, "analyst": analyst.id, "outsider": outsider.id}


def as_(investigator_id):
    return {"X-Investigator-Id": str(investigator_id)}


def upload(client, case_id, actor_id=None, data=FILE_BYTES, name="signal-log.txt"):
    headers = as_(actor_id) if actor_id is not None else {}
    response = client.post(f"/api/cases/{case_id}/evidence", files=[("files", (name, data, "text/plain"))], headers=headers)
    assert response.status_code == 201, response.text
    return response.json()[0]


def history(client, evidence_id):
    response = client.get(f"/api/evidence/{evidence_id}/custody")
    assert response.status_code == 200, response.text
    return response.json()


def transfer(client, evidence_id, actor_id, to_id, reason=""):
    return client.post(
        f"/api/evidence/{evidence_id}/custody/transfers",
        json={"to_investigator_id": to_id, "reason": reason},
        headers=as_(actor_id),
    )


def resolve(client, transfer_id, verb, actor_id, note=""):
    return client.post(f"/api/custody-transfers/{transfer_id}/{verb}", json={"note": note}, headers=as_(actor_id))


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def test_upload_records_the_registration_with_actor_server_time_and_hash(client, team):
    before = datetime.now(UTC)
    evidence = upload(client, team["case"].id, team["officer"])
    after = datetime.now(UTC)

    body = history(client, evidence["id"])
    [registered] = body["events"]
    assert registered["action"] == "REGISTERED"
    assert registered["actor_id"] == team["officer"]
    assert registered["actor_name"] == "Const. Rahul Verma"
    assert registered["case_id"] == team["case"].id
    # The hash is of the file's bytes, computed by the server.
    assert registered["sha256"] == hashlib.sha256(FILE_BYTES).hexdigest() == evidence["sha256"]
    at = datetime.fromisoformat(registered["at"])
    assert before - timedelta(seconds=1) <= at <= after + timedelta(seconds=1)
    # Whoever registered it holds it.
    assert body["custodian"] == {"id": team["officer"], "name": "Const. Rahul Verma"}
    assert evidence["custodian_id"] == team["officer"]
    assert body["baseline_sha256"] == evidence["sha256"]
    assert body["pending_transfer"] is None


def test_upload_without_an_investigator_is_registered_with_no_actor(client, team):
    evidence = upload(client, team["case"].id)
    body = history(client, evidence["id"])
    assert body["events"][0]["actor_id"] is None
    assert body["custodian"] is None


def test_evidence_is_never_registered_without_its_custody_record(client, db, team, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("custody store unavailable")

    monkeypatch.setattr("app.services.evidence.files.record_registration", fail)
    with pytest.raises(RuntimeError):
        client.post(
            f"/api/cases/{team['case'].id}/evidence",
            files=[("files", ("a.txt", b"one", "text/plain"))],
            headers=as_(team["officer"]),
        )
    assert db.scalars(select(Evidence)).all() == []
    assert db.scalars(select(CustodyEvent)).all() == []
    folder = absolute_path(str(team["case"].id))
    assert not folder.exists() or list(folder.iterdir()) == []


def test_requests_cannot_set_the_actor_or_the_time(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    for extra in ({"actor_id": team["lead"]}, {"at": "2020-01-01T00:00:00Z"}):
        response = client.post(
            f"/api/evidence/{evidence['id']}/custody/transfers",
            json={"to_investigator_id": team["analyst"], **extra},
            headers=as_(team["officer"]),
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------


def test_transfer_is_pending_until_the_recipient_accepts(client, db, team):
    evidence = upload(client, team["case"].id, team["officer"])

    started = transfer(client, evidence["id"], team["officer"], team["analyst"], "For speed analysis")
    assert started.status_code == 201, started.text
    pending = started.json()
    assert pending["status"] == "PENDING"
    assert (pending["from_investigator_id"], pending["to_investigator_id"]) == (team["officer"], team["analyst"])
    assert pending["initiated_by_id"] == team["officer"]

    body = history(client, evidence["id"])
    # A pending transfer is not a handover: the custodian hasn't changed.
    assert body["custodian"]["id"] == team["officer"]
    assert body["pending_transfer"]["id"] == pending["id"]
    transferred = body["events"][-1]
    assert transferred["action"] == "TRANSFERRED"
    assert transferred["transfer_status"] == "PENDING"
    assert transferred["note"] == "For speed analysis"

    accepted = resolve(client, pending["id"], "accept", team["analyst"], "Seal intact")
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "ACCEPTED"

    body = history(client, evidence["id"])
    assert body["custodian"]["id"] == team["analyst"]
    assert body["pending_transfer"] is None
    assert [e["action"] for e in body["events"]] == ["REGISTERED", "TRANSFERRED", "RECEIVED"]
    received = body["events"][-1]
    assert received["actor_id"] == team["analyst"]
    assert (received["from_custodian_id"], received["to_custodian_id"]) == (team["officer"], team["analyst"])
    assert body["events"][1]["transfer_status"] == "ACCEPTED"
    assert db.get(Evidence, evidence["id"]).custodian_id == team["analyst"]


def test_the_case_lead_can_transfer_and_assign_unheld_evidence(client, team):
    held = upload(client, team["case"].id, team["officer"])
    assert transfer(client, held["id"], team["lead"], team["analyst"]).status_code == 201

    unheld = upload(client, team["case"].id)
    assert transfer(client, unheld["id"], team["officer"], team["analyst"]).status_code == 403
    started = transfer(client, unheld["id"], team["lead"], team["analyst"])
    assert started.status_code == 201
    assert started.json()["from_investigator_id"] is None
    assert resolve(client, started.json()["id"], "accept", team["analyst"]).status_code == 200
    assert history(client, unheld["id"])["custodian"]["id"] == team["analyst"]


def test_reject_and_cancel_leave_custody_where_it_was(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    first = transfer(client, evidence["id"], team["officer"], team["analyst"]).json()
    assert resolve(client, first["id"], "reject", team["analyst"], "Not my area").json()["status"] == "REJECTED"
    second = transfer(client, evidence["id"], team["officer"], team["analyst"]).json()
    assert resolve(client, second["id"], "cancel", team["officer"]).json()["status"] == "CANCELLED"

    body = history(client, evidence["id"])
    assert body["custodian"]["id"] == team["officer"]
    assert [e["action"] for e in body["events"]] == [
        "REGISTERED", "TRANSFERRED", "TRANSFER_REJECTED", "TRANSFERRED", "TRANSFER_CANCELLED"
    ]  # fmt: skip
    assert body["events"][2]["note"] == "Not my area"


def test_unauthorized_transfers_are_refused(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    url = f"/api/evidence/{evidence['id']}/custody/transfers"
    # No investigator chosen.
    assert client.post(url, json={"to_investigator_id": team["analyst"]}).status_code == 401
    # Not assigned to the case.
    assert transfer(client, evidence["id"], team["outsider"], team["analyst"]).status_code == 403
    # Assigned, but neither the custodian nor the lead.
    assert transfer(client, evidence["id"], team["analyst"], team["lead"]).status_code == 403

    pending = transfer(client, evidence["id"], team["officer"], team["analyst"]).json()
    # Only the recipient accepts or rejects; only the initiator or lead cancels.
    assert resolve(client, pending["id"], "accept", team["officer"]).status_code == 403
    assert resolve(client, pending["id"], "accept", team["lead"]).status_code == 403
    assert resolve(client, pending["id"], "reject", team["lead"]).status_code == 403
    assert resolve(client, pending["id"], "cancel", team["analyst"]).status_code == 403
    assert resolve(client, pending["id"], "accept", team["outsider"]).status_code == 403
    assert history(client, evidence["id"])["custodian"]["id"] == team["officer"]


def test_invalid_recipients_evidence_and_transfers(client, team):
    evidence = upload(client, team["case"].id, team["officer"])

    def field_error(response):
        assert response.status_code == 422, response.text
        return response.json()["detail"][0]

    assert field_error(transfer(client, evidence["id"], team["officer"], 9999))["loc"] == ["body", "to_investigator_id"]
    assert "isn't assigned" in field_error(transfer(client, evidence["id"], team["officer"], team["outsider"]))["msg"]
    # Self-transfer: the recipient already holds it.
    assert "already holds" in field_error(transfer(client, evidence["id"], team["officer"], team["officer"]))["msg"]
    assert transfer(client, evidence["id"], team["officer"], 0).status_code == 422
    assert transfer(client, 9999, team["officer"], team["analyst"]).status_code == 404
    assert resolve(client, 9999, "accept", team["analyst"]).status_code == 404
    assert client.get("/api/evidence/9999/custody").status_code == 404


# ---------------------------------------------------------------------------
# Concurrency and consistency
# ---------------------------------------------------------------------------


def test_only_one_transfer_can_be_pending(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    assert transfer(client, evidence["id"], team["officer"], team["analyst"]).status_code == 201
    assert transfer(client, evidence["id"], team["lead"], team["analyst"]).status_code == 409


def test_the_database_refuses_a_second_pending_transfer(db, team):
    """The guard that holds even if two requests pass the service's check at once."""
    evidence = Evidence(case_id=team["case"].id, type="document", title="x", sha256="", custodian_id=team["officer"])
    db.add(evidence)
    db.commit()
    for _ in range(2):
        db.add(CustodyTransfer(evidence_id=evidence.id, to_investigator_id=team["analyst"], status="PENDING"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_a_transfer_resolves_once(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    pending = transfer(client, evidence["id"], team["officer"], team["analyst"]).json()
    assert resolve(client, pending["id"], "accept", team["analyst"]).status_code == 200
    assert resolve(client, pending["id"], "accept", team["analyst"]).status_code == 409
    assert resolve(client, pending["id"], "reject", team["analyst"]).status_code == 409
    assert [e["action"] for e in history(client, evidence["id"])["events"]].count("RECEIVED") == 1


def test_accept_fails_if_custody_moved_since_the_transfer_started(client, db, team):
    evidence = upload(client, team["case"].id, team["officer"])
    pending = transfer(client, evidence["id"], team["officer"], team["analyst"]).json()
    # Custody changes under the pending transfer (as a racing request could).
    row = db.get(Evidence, evidence["id"])
    row.custodian_id = team["lead"]
    db.commit()

    assert resolve(client, pending["id"], "accept", team["analyst"]).status_code == 409
    db.expire_all()
    assert db.get(Evidence, evidence["id"]).custodian_id == team["lead"]
    assert db.get(CustodyTransfer, pending["id"]).status == "PENDING"
    assert "RECEIVED" not in [e["action"] for e in history(client, evidence["id"])["events"]]


# ---------------------------------------------------------------------------
# Append-only history
# ---------------------------------------------------------------------------


def test_custody_events_cannot_be_edited_or_deleted_through_the_api(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    url = f"/api/evidence/{evidence['id']}/custody"
    event_id = history(client, evidence["id"])["events"][0]["id"]
    for method in ("put", "patch", "delete"):
        assert getattr(client, method)(url).status_code == 405
        assert client.request(method.upper(), f"{url}/events/{event_id}").status_code in (404, 405)
    assert len(history(client, evidence["id"])["events"]) == 1


def test_the_orm_refuses_to_rewrite_custody_events(client, db, team):
    upload(client, team["case"].id, team["officer"])
    event = db.scalars(select(CustodyEvent)).one()
    event.note = "rewritten"
    with pytest.raises(AppendOnlyError):
        db.commit()
    db.rollback()
    event = db.scalars(select(CustodyEvent)).one()
    db.delete(event)
    with pytest.raises(AppendOnlyError):
        db.commit()


def test_history_survives_a_removed_investigator(client, db, team):
    evidence = upload(client, team["case"].id, team["officer"])
    db.delete(db.get(Investigator, team["officer"]))
    db.commit()
    body = history(client, evidence["id"])
    assert body["events"][0]["actor_id"] is None
    assert body["events"][0]["actor_name"] == "Const. Rahul Verma"
    assert body["custodian"] is None


# ---------------------------------------------------------------------------
# Integrity
# ---------------------------------------------------------------------------


def verify(client, evidence_id, actor_id):
    return client.post(f"/api/evidence/{evidence_id}/custody/verify", headers=as_(actor_id))


def stored_path(db, evidence_id) -> Path:
    return absolute_path(db.get(Evidence, evidence_id).file_path)


def test_hash_is_of_the_stored_bytes(client, db, team):
    evidence = upload(client, team["case"].id, team["officer"], data=b"\x00\x01binary\xff")
    row = db.get(Evidence, evidence["id"])
    checked = custody.hash_stored_file(row, row.sha256)
    assert checked.actual == hashlib.sha256(b"\x00\x01binary\xff").hexdigest()
    assert checked.result == "MATCH"


def test_verify_matches_an_unchanged_file_and_records_the_check(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    response = verify(client, evidence["id"], team["analyst"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["result"] == "MATCH"
    assert body["actual_sha256"] == body["expected_sha256"] == evidence["sha256"]
    assert "doesn't by itself show the evidence is authentic" in body["detail"]
    event = body["event"]
    assert (event["action"], event["actor_id"], event["integrity_result"]) == ("INTEGRITY_CHECKED", team["analyst"], "MATCH")
    assert history(client, evidence["id"])["events"][-1]["id"] == event["id"]


def test_verify_detects_changed_bytes_without_moving_the_baseline(client, db, team):
    evidence = upload(client, team["case"].id, team["officer"])
    stored_path(db, evidence["id"]).write_bytes(FILE_BYTES.replace(b"red", b"amber"))

    body = verify(client, evidence["id"], team["officer"]).json()
    assert body["result"] == "MISMATCH"
    assert body["expected_sha256"] == evidence["sha256"]
    assert body["actual_sha256"] == hashlib.sha256(FILE_BYTES.replace(b"red", b"amber")).hexdigest()
    # The baseline stays as registered.
    after = history(client, evidence["id"])
    assert after["baseline_sha256"] == evidence["sha256"]
    assert after["events"][0]["sha256"] == evidence["sha256"]
    db.expire_all()
    assert db.get(Evidence, evidence["id"]).sha256 == evidence["sha256"]


def test_verify_reports_a_missing_file(client, db, team):
    evidence = upload(client, team["case"].id, team["officer"])
    stored_path(db, evidence["id"]).unlink()
    body = verify(client, evidence["id"], team["officer"]).json()
    assert body["result"] == "FILE_MISSING"
    assert body["actual_sha256"] is None
    assert body["event"]["integrity_result"] == "FILE_MISSING"


def test_verify_reports_a_storage_error(client, team, monkeypatch):
    evidence = upload(client, team["case"].id, team["officer"])

    def unreadable(self, *args, **kwargs):
        raise PermissionError(13, "Permission denied")

    monkeypatch.setattr(Path, "open", unreadable)
    body = verify(client, evidence["id"], team["officer"]).json()
    assert body["result"] == "STORAGE_ERROR"
    assert "Permission denied" in body["detail"]


def test_case_access_is_required_to_verify_or_record_analysis(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    assert client.post(f"/api/evidence/{evidence['id']}/custody/verify").status_code == 401
    assert verify(client, evidence["id"], team["outsider"]).status_code == 403

    url = f"/api/evidence/{evidence['id']}/custody/analyses"
    note = {"note": "Pre-crash timeline checked"}
    assert client.post(url, json=note, headers=as_(team["outsider"])).status_code == 403
    # Only the current custodian records an analysis.
    assert client.post(url, json=note, headers=as_(team["analyst"])).status_code == 403
    assert client.post(url, json={"note": ""}, headers=as_(team["officer"])).status_code == 422
    recorded = client.post(url, json=note, headers=as_(team["officer"]))
    assert recorded.status_code == 201
    assert recorded.json()["action"] == "ANALYSED"
    actions = [e["action"] for e in history(client, evidence["id"])["events"]]
    assert actions == ["REGISTERED", "ANALYSED"]


def test_events_are_in_a_fixed_order(client, team):
    evidence = upload(client, team["case"].id, team["officer"])
    for _ in range(3):
        verify(client, evidence["id"], team["officer"])
    events = history(client, evidence["id"])["events"]
    keys = [(e["at"], e["id"]) for e in events]
    assert keys == sorted(keys)
