"""Tests for the evidence router (task B2): uploads, lists, detail, edits, the
original files, reprocessing, evidence links and the integrity check.

The pipeline is replaced by a recorder in every test, so these tests only check
that it is queued and never depend on what it does (or call Gemini)."""

import hashlib
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.core.storage import absolute_path, save_bytes
from app.models import AuditLog, Evidence, EvidenceChunk, EvidenceLink
from app.routers import evidence as evidence_router
from app.services.evidence.files import evidence_type_for
from tests.factories import make_case, make_event, make_evidence, make_investigator, make_person

PDF = b"%PDF-1.4 police report"
PNG = b"\x89PNG\r\n\x1a\n scene photo"


@pytest.fixture(autouse=True)
def queued(monkeypatch):
    """Evidence IDs handed to process_evidence, in order."""
    calls: list[int] = []
    monkeypatch.setattr(evidence_router, "process_evidence", calls.append)
    return calls


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def upload(client, case_id, *files, actor_id=None):
    headers = {"X-Investigator-Id": str(actor_id)} if actor_id is not None else {}
    return client.post(f"/api/cases/{case_id}/evidence", files=[("files", f) for f in files], headers=headers)


def audit_rows(db, **filters):
    query = select(AuditLog).filter_by(**filters).order_by(AuditLog.id)
    return db.scalars(query).all()


def at(day: int) -> datetime:
    return datetime(2026, 10, day, 9, 0, tzinfo=UTC)


# Upload ---------------------------------------------------------------------


def test_upload_stores_each_file_and_queues_it(client, db, queued):
    investigator = make_investigator(db)
    case = make_case(db)

    response = upload(
        client,
        case.id,
        ("police-report.pdf", PDF, "application/pdf"),
        ("scene.png", PNG, "image/png"),
        actor_id=investigator.id,
    )

    assert response.status_code == 201
    rows = response.json()
    assert [(r["title"], r["type"], r["mime_type"]) for r in rows] == [
        ("police-report.pdf", "document", "application/pdf"),
        ("scene.png", "photo", "image/png"),
    ]
    assert [(r["size_bytes"], r["sha256"]) for r in rows] == [(len(PDF), sha(PDF)), (len(PNG), sha(PNG))]
    assert {r["processing_status"] for r in rows} == {"queued"}
    assert {r["case_id"] for r in rows} == {case.id}
    assert "extracted_text" not in rows[0] and "file_path" not in rows[0]
    assert queued == [r["id"] for r in rows]

    stored = db.get(Evidence, rows[0]["id"])
    assert stored.file_path.startswith(f"{case.id}/")
    assert absolute_path(stored.file_path).read_bytes() == PDF

    entries = audit_rows(db, action="uploaded")
    assert [(e.record_type, e.record_id, e.case_id, e.actor_id) for e in entries] == [
        ("evidence", rows[0]["id"], case.id, investigator.id),
        ("evidence", rows[1]["id"], case.id, investigator.id),
    ]
    assert entries[0].detail == {"file_name": "police-report.pdf", "sha256": sha(PDF)}


@pytest.mark.parametrize(
    ("mime_type", "expected"),
    [
        ("image/jpeg", "photo"),
        ("video/mp4", "video"),
        ("audio/mpeg", "audio"),
        ("application/pdf", "document"),
        ("application/msword", "document"),
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document"),
        ("text/plain", "document"),
        ("IMAGE/PNG", "photo"),
        ("application/json", "other"),
        ("application/octet-stream", "other"),
    ],
)
def test_type_is_guessed_from_the_mime_type(mime_type, expected):
    assert evidence_type_for(mime_type) == expected


def test_upload_needs_at_least_one_file(client, db):
    case = make_case(db)
    assert client.post(f"/api/cases/{case.id}/evidence").status_code == 422


def test_upload_to_an_unknown_case_is_404(client, queued):
    response = upload(client, 999, ("a.txt", b"hello", "text/plain"))
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}
    assert queued == []


# Lists ----------------------------------------------------------------------


def test_case_evidence_is_newest_first_and_scoped_to_the_case(client, db):
    case = make_case(db)
    other = make_case(db)
    old = make_evidence(db, case, title="Old", created_at=at(1))
    new = make_evidence(db, case, title="New", created_at=at(3))
    make_evidence(db, other, title="Elsewhere", created_at=at(2))

    response = client.get(f"/api/cases/{case.id}/evidence")

    assert response.status_code == 200
    assert [r["id"] for r in response.json()] == [new.id, old.id]
    assert client.get("/api/cases/999/evidence").status_code == 404


def test_global_evidence_lists_every_case_with_its_number_and_title(client, db):
    case = make_case(db, title="Ring Road junction collision")
    other = make_case(db, title="Warehouse fire")
    first = make_evidence(db, case, created_at=at(1))
    second = make_evidence(db, other, created_at=at(2))

    rows = client.get("/api/evidence").json()

    assert [r["id"] for r in rows] == [second.id, first.id]
    assert (rows[1]["case_number"], rows[1]["case_title"]) == (case.case_number, "Ring Road junction collision")
    assert "extracted_text" not in rows[0]


def test_global_evidence_query_matches_title_description_case_and_summary(client, db):
    case = make_case(db, case_number="FX-2026-0042", title="Ring Road junction collision")
    other = make_case(db, title="Warehouse fire")
    by_title = make_evidence(db, other, title="CCTV clip.mp4", created_at=at(1))
    by_description = make_evidence(db, other, title="a", description="Dashcam footage from the van", created_at=at(2))
    by_summary = make_evidence(db, other, title="b", summary="The witness saw a red signal.", created_at=at(3))
    in_case = make_evidence(db, case, title="c", created_at=at(4))

    def ids(q):
        return [r["id"] for r in client.get("/api/evidence", params={"q": q}).json()]

    assert ids("cctv") == [by_title.id]
    assert ids("DASHCAM") == [by_description.id]
    assert ids("red signal") == [by_summary.id]
    assert ids("fx-2026-0042") == [in_case.id]
    assert ids("junction") == [in_case.id]
    assert ids("100%") == []
    assert len(ids("")) == 4


def test_global_evidence_filters_by_type(client, db):
    case = make_case(db)
    photo = make_evidence(db, case, type="photo", title="Skid marks", created_at=at(1))
    make_evidence(db, case, type="document", title="Skid analysis", created_at=at(2))
    make_evidence(db, case, type="photo", title="Debris", created_at=at(3))

    response = client.get("/api/evidence", params={"type": "photo", "q": "skid"})

    assert [r["id"] for r in response.json()] == [photo.id]
    assert client.get("/api/evidence", params={"type": "fingerprint"}).status_code == 422


# Detail and edits -----------------------------------------------------------


def test_detail_has_extracted_text_links_and_custody_oldest_first(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case, extracted_text="Statement of Anita Desai.")
    person = make_person(db, case)
    event = make_event(db, case)
    db.add_all([
        EvidenceLink(evidence_id=evidence.id, target_type="person", target_id=person.id, passage="Anita Desai"),
        EvidenceLink(evidence_id=evidence.id, target_type="event", target_id=event.id),
        AuditLog(action="viewed", record_type="evidence", record_id=evidence.id, case_id=case.id, at=at(5),
                 actor_id=investigator.id),
        AuditLog(action="uploaded", record_type="evidence", record_id=evidence.id, case_id=case.id, at=at(1)),
        AuditLog(action="modified", record_type="person", record_id=evidence.id, case_id=case.id, at=at(2)),
    ])
    db.commit()

    response = client.get(f"/api/evidence/{evidence.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == evidence.id
    assert (body["case_number"], body["case_title"]) == (case.case_number, case.title)
    assert body["extracted_text"] == "Statement of Anita Desai."
    assert [(link["target_type"], link["target_id"], link["passage"]) for link in body["links"]] == [
        ("person", person.id, "Anita Desai"),
        ("event", event.id, None),
    ]
    assert [(entry["action"], entry["actor_name"]) for entry in body["custody"]] == [
        ("uploaded", None),
        ("viewed", investigator.name),
    ]
    assert body["custody"][0]["at"] == "2026-10-01T09:00:00Z"


def test_detail_of_unknown_evidence_is_404(client):
    response = client.get("/api/evidence/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Evidence not found"}


def test_update_changes_fields_and_audits_before_and_after(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case, type="document", notes="")

    response = client.patch(
        f"/api/evidence/{evidence.id}",
        json={"type": "statement", "notes": "Signed by the witness", "title": evidence.title},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 200
    assert (response.json()["type"], response.json()["notes"]) == ("statement", "Signed by the witness")
    [entry] = audit_rows(db, record_type="evidence")
    assert (entry.action, entry.record_id, entry.case_id, entry.actor_id) == (
        "modified", evidence.id, case.id, investigator.id
    )
    assert entry.detail == {
        "type": {"before": "document", "after": "statement"},
        "notes": {"before": "", "after": "Signed by the witness"},
    }


def test_update_rejects_bad_bodies_and_unknown_evidence(client, db):
    case = make_case(db)
    evidence = make_evidence(db, case)
    assert client.patch(f"/api/evidence/{evidence.id}", json={"type": "fingerprint"}).status_code == 422
    assert client.patch(f"/api/evidence/{evidence.id}", json={"sha256": "f" * 64}).status_code == 422
    assert client.patch("/api/evidence/999", json={"notes": "x"}).status_code == 404


# Files ----------------------------------------------------------------------


def test_file_is_served_inline_and_logged_as_viewed(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    [row] = upload(client, case.id, ("scene.png", PNG, "image/png")).json()

    response = client.get(f"/api/evidence/{row['id']}/file", params={"investigator_id": investigator.id})

    assert response.status_code == 200
    assert response.content == PNG
    assert response.headers["content-type"] == "image/png"
    assert response.headers["content-disposition"] == 'inline; filename="scene.png"'
    [entry] = audit_rows(db, action="viewed")
    assert (entry.record_type, entry.record_id, entry.case_id, entry.actor_id) == (
        "evidence", row["id"], case.id, investigator.id
    )


def test_download_is_an_attachment_named_after_the_title_and_logged_as_exported(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    [row] = upload(client, case.id, ("police-report.pdf", PDF, "application/pdf")).json()
    client.patch(f"/api/evidence/{row['id']}", json={"title": "Police report"})

    response = client.get(f"/api/evidence/{row['id']}/file?download=1&investigator_id={investigator.id}")

    assert response.status_code == 200
    assert response.content == PDF
    assert response.headers["content-disposition"] == "attachment; filename*=utf-8''Police%20report.pdf"
    [entry] = audit_rows(db, action="exported")
    assert (entry.record_id, entry.case_id, entry.actor_id) == (row["id"], case.id, investigator.id)
    assert audit_rows(db, action="viewed") == []


def test_missing_file_is_404_and_not_logged(client, db):
    case = make_case(db)
    no_file = make_evidence(db, case)
    [row] = upload(client, case.id, ("scene.png", PNG, "image/png")).json()
    absolute_path(db.get(Evidence, row["id"]).file_path).unlink()

    for evidence_id in (no_file.id, row["id"]):
        response = client.get(f"/api/evidence/{evidence_id}/file")
        assert response.status_code == 404
        assert response.json() == {"detail": "File not found"}
    assert client.get("/api/evidence/999/file").json() == {"detail": "Evidence not found"}
    assert audit_rows(db, action="viewed") == []


# Reprocess ------------------------------------------------------------------


def test_reprocess_requeues_audits_and_runs_the_pipeline_again(client, db, queued):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case, processing_status="failed")

    response = client.post(
        f"/api/evidence/{evidence.id}/reprocess", headers={"X-Investigator-Id": str(investigator.id)}
    )

    assert response.status_code == 200
    assert response.json()["processing_status"] == "queued"
    assert queued == [evidence.id]
    [entry] = audit_rows(db, record_type="evidence")
    assert (entry.action, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", evidence.id, case.id, investigator.id, {"reprocess": True}
    )
    assert client.post("/api/evidence/999/reprocess").status_code == 404


# Evidence links -------------------------------------------------------------


def test_link_is_created_and_audited_on_the_target(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case)
    event = make_event(db, case)
    chunk = EvidenceChunk(evidence_id=evidence.id, ordinal=0, text="The van ran the light.")
    db.add(chunk)
    db.commit()

    response = client.post(
        "/api/evidence-links",
        json={
            "evidence_id": evidence.id,
            "chunk_id": chunk.id,
            "target_type": "event",
            "target_id": event.id,
            "passage": "ran the light",
        },
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 201
    link = response.json()
    assert link == {
        "id": link["id"],
        "evidence_id": evidence.id,
        "chunk_id": chunk.id,
        "target_type": "event",
        "target_id": event.id,
        "passage": "ran the light",
    }
    assert db.get(EvidenceLink, link["id"]) is not None
    [entry] = audit_rows(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", "event", event.id, case.id, investigator.id, {"linked_evidence": evidence.id}
    )


def test_link_needs_an_existing_evidence_target_and_chunk(client, db):
    case = make_case(db)
    evidence = make_evidence(db, case)
    other_evidence = make_evidence(db, case)
    person = make_person(db, case)
    other_chunk = EvidenceChunk(evidence_id=other_evidence.id, ordinal=0, text="Elsewhere.")
    db.add(other_chunk)
    db.commit()

    def post(**fields):
        body = {"evidence_id": evidence.id, "target_type": "person", "target_id": person.id} | fields
        return client.post("/api/evidence-links", json=body)

    assert post(evidence_id=999).json() == {"detail": "Evidence not found"}
    assert post(target_id=999).json() == {"detail": "Person not found"}
    assert post(target_type="object").json() == {"detail": "Object not found"}
    assert post(chunk_id=other_chunk.id).json() == {"detail": "Chunk not found"}
    assert post(chunk_id=999).status_code == 404
    assert post(target_type="fingerprint").status_code == 422
    assert post(rank=1).status_code == 422
    assert db.scalars(select(EvidenceLink)).all() == []
    assert audit_rows(db) == []
    assert post(target_type="case", target_id=case.id).status_code == 201


def test_deleting_a_link_audits_the_target(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case)
    person = make_person(db, case)
    link = EvidenceLink(evidence_id=evidence.id, target_type="person", target_id=person.id)
    db.add(link)
    db.commit()
    link_id = link.id

    response = client.delete(f"/api/evidence-links/{link_id}", headers={"X-Investigator-Id": str(investigator.id)})

    assert response.status_code == 204
    assert response.content == b""
    db.expire_all()
    assert db.scalars(select(EvidenceLink)).all() == []
    [entry] = audit_rows(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", "person", person.id, case.id, investigator.id, {"unlinked_evidence": evidence.id}
    )
    again = client.delete(f"/api/evidence-links/{link_id}")
    assert again.status_code == 404
    assert again.json() == {"detail": "Evidence link not found"}


# Integrity check ------------------------------------------------------------


def test_verify_passes_for_untouched_files(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    upload(client, case.id, ("police-report.pdf", PDF, "application/pdf"), ("scene.png", PNG, "image/png"))

    response = client.post(f"/api/cases/{case.id}/verify", headers={"X-Investigator-Id": str(investigator.id)})

    assert response.status_code == 200
    body = response.json()
    assert (body["checked"], body["mismatches"]) == (2, [])
    assert body["verified_at"].endswith("Z")
    [entry] = audit_rows(db, action="reviewed")
    assert (entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "case", case.id, case.id, investigator.id, {"integrity_check": {"checked": 2, "mismatches": 0}}
    )


def test_verify_reports_tampered_and_missing_files(client, db):
    case = make_case(db)
    other = make_case(db)
    intact, tampered, missing = upload(
        client,
        case.id,
        ("intact.pdf", PDF, "application/pdf"),
        ("tampered.png", PNG, "image/png"),
        ("missing.txt", b"statement", "text/plain"),
    ).json()
    absolute_path(db.get(Evidence, tampered["id"]).file_path).write_bytes(b"edited")
    absolute_path(db.get(Evidence, missing["id"]).file_path).unlink()
    make_evidence(db, case, title="No stored file")  # not checked
    elsewhere = save_bytes(other.id, "other.pdf", b"x")
    make_evidence(db, other, file_path=elsewhere.file_path, sha256="0" * 64)  # another case

    body = client.post(f"/api/cases/{case.id}/verify").json()

    assert body["checked"] == 3
    assert body["mismatches"] == [
        {"evidence_id": tampered["id"], "title": "tampered.png", "expected": sha(PNG), "actual": sha(b"edited")},
        {"evidence_id": missing["id"], "title": "missing.txt", "expected": sha(b"statement"), "actual": None},
    ]
    [entry] = audit_rows(db, action="reviewed")
    assert entry.detail == {"integrity_check": {"checked": 3, "mismatches": 2}}
    assert intact["id"] not in [m["evidence_id"] for m in body["mismatches"]]


def test_verify_unknown_case_is_404(client):
    response = client.post("/api/cases/999/verify")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}
