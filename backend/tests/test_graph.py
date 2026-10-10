"""Tests for the graph routes: the canvas's nodes and edges, and relationship CRUD."""

from sqlalchemy import select

from app.models import AuditLog, EvidenceLink, Relationship
from tests.factories import (
    _save,
    make_case,
    make_evidence,
    make_investigator,
    make_location,
    make_object,
    make_person,
)


def make_relationship(db, case, from_, to, **fields) -> Relationship:
    from_type, from_id = from_
    to_type, to_id = to
    values = {"kind": "involved_in", "label": "Involved in"}
    return _save(
        db,
        Relationship(
            case_id=case.id, from_type=from_type, from_id=from_id, to_type=to_type, to_id=to_id, **(values | fields)
        ),
    )


def make_link(db, evidence, target_type, target_id) -> EvidenceLink:
    return _save(db, EvidenceLink(evidence_id=evidence.id, target_type=target_type, target_id=target_id))


def audit_entries(db) -> list[AuditLog]:
    return db.scalars(select(AuditLog).order_by(AuditLog.id)).all()


# GET /cases/{id}/graph ----------------------------------------------------------


def test_graph_nodes_and_edges(client, db):
    case = make_case(db)
    other = make_case(db)
    victim = make_person(db, case, role="victim", name="Rahul Verma", condition="deceased")
    driver = make_person(db, case, role="suspect", name="Suresh Nair", origin="ai", review_status="pending")
    hatchback = make_object(db, case)
    phone = make_object(db, case, kind="phone", label="Victim's phone", details={})
    site = make_location(db, case)
    make_location(db, case, kind="witness_position", address="Bus stop")  # untouched: not a node
    report = make_evidence(db, case, type="statement", title="Witness statement.pdf")
    make_evidence(db, case)  # untouched: not a node
    stranger = make_person(db, other, name="Someone else")
    drove = make_relationship(db, case, ("person", driver.id), ("object", hatchback.id), kind="drove", label="Drove",
                              confidence=0.8, flagged=True, origin="ai", review_status="pending")
    at = make_relationship(db, case, ("object", hatchback.id), ("location", site.id), kind="located_at", label="At")
    mentions = make_relationship(db, case, ("evidence", report.id), ("person", victim.id), kind="mentions",
                                 label="Mentions")
    # An end that isn't in this case: the location it touches still shows, but no edge.
    make_relationship(db, case, ("person", stranger.id), ("location", site.id), kind="witnessed")
    make_relationship(db, other, ("person", stranger.id), ("person", stranger.id))

    response = client.get(f"/api/cases/{case.id}/graph")

    assert response.status_code == 200
    graph = response.json()
    assert graph["nodes"] == [
        {"id": f"person:{victim.id}", "type": "person", "record_id": victim.id, "label": "Rahul Verma",
         "sublabel": "Victim, deceased", "review_status": "confirmed"},
        {"id": f"person:{driver.id}", "type": "person", "record_id": driver.id, "label": "Suresh Nair",
         "sublabel": "Suspect", "review_status": "pending"},
        {"id": f"object:{hatchback.id}", "type": "object", "record_id": hatchback.id, "label": "White hatchback",
         "sublabel": "KA-01-AB-1234", "review_status": "confirmed"},
        {"id": f"object:{phone.id}", "type": "object", "record_id": phone.id, "label": "Victim's phone",
         "sublabel": "Phone", "review_status": "confirmed"},
        {"id": f"location:{site.id}", "type": "location", "record_id": site.id, "label": "Ring Road and 5th Avenue",
         "sublabel": "Incident site", "review_status": "confirmed"},
        {"id": f"evidence:{report.id}", "type": "evidence", "record_id": report.id, "label": "Witness statement.pdf",
         "sublabel": "Statement", "review_status": "confirmed"},
    ]
    assert graph["edges"] == [
        {"id": f"relationship:{drove.id}", "relationship_id": drove.id, "source": f"person:{driver.id}",
         "target": f"object:{hatchback.id}", "kind": "drove", "label": "Drove", "confidence": 0.8, "flagged": True,
         "review_status": "pending"},
        {"id": f"relationship:{at.id}", "relationship_id": at.id, "source": f"object:{hatchback.id}",
         "target": f"location:{site.id}", "kind": "located_at", "label": "At", "confidence": None, "flagged": False,
         "review_status": "confirmed"},
        {"id": f"relationship:{mentions.id}", "relationship_id": mentions.id, "source": f"evidence:{report.id}",
         "target": f"person:{victim.id}", "kind": "mentions", "label": "Mentions", "confidence": None,
         "flagged": False, "review_status": "confirmed"},
    ]


def test_graph_of_an_empty_case(client, db):
    case = make_case(db)
    assert client.get(f"/api/cases/{case.id}/graph").json() == {"nodes": [], "edges": []}


def test_graph_of_an_unknown_case(client):
    response = client.get("/api/cases/999/graph")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


# POST /cases/{id}/relationships --------------------------------------------------


def test_create_relationship(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    driver = make_person(db, case, role="suspect", name="Suresh Nair")
    van = make_object(db, case, label="Delivery van")

    response = client.post(
        f"/api/cases/{case.id}/relationships",
        json={"from_type": "person", "from_id": driver.id, "to_type": "object", "to_id": van.id, "kind": "drove",
              "label": "Drove the van", "confidence": 0.9},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 201
    body = response.json()
    assert body == {
        "id": body["id"], "case_id": case.id, "from_type": "person", "from_id": driver.id, "to_type": "object",
        "to_id": van.id, "kind": "drove", "label": "Drove the van", "confidence": 0.9, "flagged": False, "notes": "",
        "origin": "investigator", "review_status": "confirmed",
    }
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id) == ("modified", "relationship", body["id"])
    assert (entry.case_id, entry.actor_id, entry.detail) == (case.id, investigator.id, {"created": True})


def test_empty_relationship_label_becomes_the_humanised_kind(client, db):
    case = make_case(db)
    person = make_person(db, case)
    site = make_location(db, case)
    ends = {"from_type": "person", "from_id": person.id, "to_type": "location", "to_id": site.id}

    omitted = client.post(f"/api/cases/{case.id}/relationships", json=ends | {"kind": "involved_in"})
    blank = client.post(f"/api/cases/{case.id}/relationships", json=ends | {"kind": "located_at", "label": "  "})

    assert omitted.json()["label"] == "Involved in"
    assert blank.json()["label"] == "Located at"


def test_relationship_ends_must_be_in_the_case(client, db):
    case = make_case(db)
    other = make_case(db)
    person = make_person(db, case)
    elsewhere = make_object(db, other)
    evidence = make_evidence(db, case)
    url = f"/api/cases/{case.id}/relationships"

    wrong_case = client.post(url, json={"from_type": "person", "from_id": person.id, "to_type": "object",
                                        "to_id": elsewhere.id, "kind": "drove"})
    missing = client.post(url, json={"from_type": "location", "from_id": 999, "to_type": "evidence",
                                     "to_id": evidence.id, "kind": "located_at"})
    wrong_type = client.post(url, json={"from_type": "person", "from_id": person.id, "to_type": "event",
                                        "to_id": 1, "kind": "involved_in"})

    assert wrong_case.status_code == 422
    assert wrong_case.json()["detail"][0]["loc"] == ["body", "to_id"]
    assert wrong_case.json()["detail"][0]["msg"] == "Object not found in this case"
    assert missing.status_code == 422
    assert missing.json()["detail"][0]["loc"] == ["body", "from_id"]
    assert wrong_type.status_code == 422
    assert db.scalars(select(Relationship)).all() == []
    assert audit_entries(db) == []


def test_create_relationship_in_an_unknown_case(client, db):
    response = client.post("/api/cases/999/relationships", json={"from_type": "person", "from_id": 1,
                                                                 "to_type": "person", "to_id": 2, "kind": "other"})
    assert response.status_code == 404


def test_create_relationship_rejects_bad_bodies(client, db):
    case = make_case(db)
    person = make_person(db, case)
    ends = {"from_type": "person", "from_id": person.id, "to_type": "person", "to_id": person.id}
    url = f"/api/cases/{case.id}/relationships"

    assert client.post(url, json=ends | {"kind": "loves"}).status_code == 422
    assert client.post(url, json=ends | {"kind": "other", "confidence": 1.5}).status_code == 422
    assert client.post(url, json=ends | {"kind": "other", "colour": "red"}).status_code == 422


# PATCH /relationships/{id} ---------------------------------------------------------


def test_review_a_relationship(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    a, b = make_person(db, case), make_person(db, case, name="Ravi Kumar")
    relationship = make_relationship(db, case, ("person", a.id), ("person", b.id), origin="ai", review_status="pending")

    response = client.patch(
        f"/api/relationships/{relationship.id}",
        json={"review_status": "confirmed"},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 200
    assert response.json()["review_status"] == "confirmed"
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id) == (
        "reviewed", "relationship", relationship.id, case.id, investigator.id
    )
    assert entry.detail == {"review_status": {"before": "pending", "after": "confirmed"}}


def test_edit_a_relationship(client, db):
    case = make_case(db)
    a, b = make_person(db, case), make_person(db, case, name="Ravi Kumar")
    relationship = make_relationship(db, case, ("person", a.id), ("person", b.id))

    response = client.patch(
        f"/api/relationships/{relationship.id}",
        json={"kind": "witnessed", "label": "Saw", "flagged": True, "notes": "Check the angle", "confidence": 0.4},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["kind"], body["label"], body["flagged"], body["notes"], body["confidence"]) == (
        "witnessed", "Saw", True, "Check the angle", 0.4
    )
    [entry] = audit_entries(db)
    assert entry.action == "modified"
    assert entry.detail["label"] == {"before": "Involved in", "after": "Saw"}
    assert entry.detail["flagged"] == {"before": False, "after": True}


def test_patch_relationship_rejects_bad_bodies_and_unknown_ids(client, db):
    case = make_case(db)
    person = make_person(db, case)
    relationship = make_relationship(db, case, ("person", person.id), ("person", person.id))

    assert client.patch(f"/api/relationships/{relationship.id}", json={"from_id": 5}).status_code == 422
    assert client.patch(f"/api/relationships/{relationship.id}", json={"review_status": "maybe"}).status_code == 422
    missing = client.patch("/api/relationships/999", json={"label": "x"})
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Relationship not found"}


# DELETE /relationships/{id} --------------------------------------------------------


def test_delete_relationship_removes_its_links(client, db):
    investigator = make_investigator(db)
    case = make_case(db)
    evidence = make_evidence(db, case)
    a, b = make_person(db, case), make_person(db, case, name="Ravi Kumar")
    relationship = make_relationship(db, case, ("person", a.id), ("person", b.id))
    kept = make_relationship(db, case, ("person", b.id), ("person", a.id))
    make_link(db, evidence, "relationship", relationship.id)
    other_link = make_link(db, evidence, "relationship", kept.id)

    response = client.delete(
        f"/api/relationships/{relationship.id}", headers={"X-Investigator-Id": str(investigator.id)}
    )

    assert response.status_code == 204
    assert response.content == b""
    assert [r.id for r in db.scalars(select(Relationship))] == [kept.id]
    assert [link.id for link in db.scalars(select(EvidenceLink))] == [other_link.id]
    [entry] = audit_entries(db)
    assert (entry.action, entry.record_type, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified", "relationship", relationship.id, case.id, investigator.id, {"deleted": True}
    )
    assert client.delete(f"/api/relationships/{relationship.id}").status_code == 404
