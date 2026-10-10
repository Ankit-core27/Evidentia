"""Persons, objects and locations (task B1)."""

import pytest
from sqlalchemy import select

from app.models import (
    AuditLog,
    Building,
    Event,
    EvidenceLink,
    Injury,
    Reconstruction,
    ReconstructionStage,
    Relationship,
    SceneObject,
)
from tests.factories import make_case, make_event, make_evidence, make_investigator, make_location, make_object, make_person

# collection, record type, factory, a valid create body, a valid change, the 404 name
RESOURCES = [
    ("persons", "person", make_person, {"role": "witness", "name": "Anita Desai"}, {"name": "Anita D."}, "Person"),
    ("objects", "object", make_object, {"kind": "vehicle", "label": "Grey van"}, {"label": "White van"}, "Object"),
    (
        "locations",
        "location",
        make_location,
        {"kind": "incident_site", "address": "Ring Road and 5th Avenue"},
        {"address": "Ring Road"},
        "Location",
    ),
]
by_collection = pytest.mark.parametrize(
    "collection,record_type,make,create_body,change,name", RESOURCES, ids=[r[0] for r in RESOURCES]
)


def audit_rows(db):
    db.expire_all()
    return db.scalars(select(AuditLog).order_by(AuditLog.id)).all()


@by_collection
def test_list_is_scoped_to_the_case(client, db, collection, record_type, make, create_body, change, name):
    case = make_case(db)
    other = make_case(db)
    first = make(db, case)
    second = make(db, case)
    make(db, other)
    response = client.get(f"/api/cases/{case.id}/{collection}")
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [first.id, second.id]
    assert client.get(f"/api/cases/999/{collection}").json() == {"detail": "Case not found"}


@by_collection
def test_create_is_confirmed_and_audited(client, db, collection, record_type, make, create_body, change, name):
    investigator = make_investigator(db)
    case = make_case(db)
    response = client.post(
        f"/api/cases/{case.id}/{collection}", json=create_body, headers={"X-Investigator-Id": str(investigator.id)}
    )
    assert response.status_code == 201
    row = response.json()
    assert row["case_id"] == case.id
    assert (row["origin"], row["review_status"]) == ("investigator", "confirmed")
    assert all(row[key] == value for key, value in create_body.items())

    [entry] = audit_rows(db)
    assert (entry.action, entry.record_type, entry.record_id) == ("modified", record_type, row["id"])
    assert (entry.case_id, entry.actor_id, entry.detail) == (case.id, investigator.id, {"created": True})

    assert client.post(f"/api/cases/999/{collection}", json=create_body).status_code == 404
    assert client.post(f"/api/cases/{case.id}/{collection}", json={}).status_code == 422
    assert client.post(f"/api/cases/{case.id}/{collection}", json=create_body | {"origin": "ai"}).status_code == 422


@by_collection
def test_patch_audits_changes_and_reviews(client, db, collection, record_type, make, create_body, change, name):
    case = make_case(db)
    row = make(db, case, origin="ai", review_status="pending")
    (field, after), = change.items()
    before = getattr(row, field)

    response = client.patch(f"/api/{collection}/{row.id}", json=change)
    assert response.status_code == 200
    assert response.json()[field] == after

    response = client.patch(f"/api/{collection}/{row.id}", json={"review_status": "confirmed"})
    assert response.json()["review_status"] == "confirmed"

    modified, reviewed = audit_rows(db)
    assert (modified.action, modified.case_id, modified.detail) == (
        "modified",
        case.id,
        {field: {"before": before, "after": after}},
    )
    assert (reviewed.action, reviewed.detail) == (
        "reviewed",
        {"review_status": {"before": "pending", "after": "confirmed"}},
    )

    assert client.patch(f"/api/{collection}/{row.id}", json={"review_status": "maybe"}).status_code == 422
    assert client.patch(f"/api/{collection}/999", json=change).json() == {"detail": f"{name} not found"}


@by_collection
def test_patch_rejects_null_for_required_fields(client, db, collection, record_type, make, create_body, change, name):
    case = make_case(db)
    row = make(db, case)
    (field, _), = change.items()
    response = client.patch(f"/api/{collection}/{row.id}", json={field: None})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]
    assert audit_rows(db) == []


@by_collection
def test_delete_removes_relationships_and_links(client, db, collection, record_type, make, create_body, change, name):
    case = make_case(db)
    evidence = make_evidence(db, case)
    row = make(db, case)
    witness = make_person(db, case, name="Ravi Kumar")
    edge = Relationship(
        case_id=case.id, from_type="person", from_id=witness.id, to_type=record_type, to_id=row.id, kind="other"
    )
    db.add(edge)
    db.commit()
    db.add_all([
        EvidenceLink(evidence_id=evidence.id, target_type=record_type, target_id=row.id),
        EvidenceLink(evidence_id=evidence.id, target_type="relationship", target_id=edge.id),
        EvidenceLink(evidence_id=evidence.id, target_type="person", target_id=witness.id),
    ])
    db.commit()
    row_id = row.id

    response = client.delete(f"/api/{collection}/{row_id}")
    assert response.status_code == 204
    assert response.content == b""

    db.expire_all()
    assert db.scalars(select(Relationship)).all() == []
    assert [(link.target_type, link.target_id) for link in db.scalars(select(EvidenceLink))] == [("person", witness.id)]
    [entry] = audit_rows(db)
    assert (entry.action, entry.record_type, entry.record_id) == ("modified", record_type, row_id)
    assert (entry.case_id, entry.detail) == (case.id, {"deleted": True})

    assert client.delete(f"/api/{collection}/{row_id}").json() == {"detail": f"{name} not found"}


def test_deleting_referenced_records_clears_the_references(client, db):
    case = make_case(db)
    victim = make_person(db, case, role="victim")
    van = make_object(db, case)
    site = make_location(db, case)
    event = make_event(db, case, location_id=site.id)
    injury = Injury(case_id=case.id, person_id=victim.id, body_region="head", type="laceration", severity="minor")
    reconstruction = Reconstruction(case_id=case.id, scenario="Van ran the red")
    db.add_all([injury, reconstruction])
    db.commit()
    stage = ReconstructionStage(reconstruction_id=reconstruction.id, label="Impact")
    db.add(stage)
    db.commit()
    placed = SceneObject(stage_id=stage.id, model_id="van", object_id=van.id)
    db.add(placed)
    db.commit()

    for path in (f"/api/persons/{victim.id}", f"/api/objects/{van.id}", f"/api/locations/{site.id}"):
        assert client.delete(path).status_code == 204

    db.expire_all()
    assert db.get(Injury, injury.id).person_id is None
    assert db.get(SceneObject, placed.id).object_id is None
    assert db.get(Event, event.id).location_id is None


def test_location_building_must_exist(client, db):
    case = make_case(db)
    building = Building(name="Metro station")
    db.add(building)
    db.commit()
    body = {"kind": "zone", "address": "Station forecourt"}

    response = client.post(f"/api/cases/{case.id}/locations", json=body | {"building_id": 99})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "building_id"]

    location = client.post(f"/api/cases/{case.id}/locations", json=body | {"building_id": building.id}).json()
    assert location["building_id"] == building.id
    assert client.patch(f"/api/locations/{location['id']}", json={"building_id": 99}).status_code == 422
    assert client.patch(f"/api/locations/{location['id']}", json={"building_id": None}).json()["building_id"] is None


def test_person_fields_round_trip(client, db):
    case = make_case(db)
    body = {
        "role": "victim",
        "name": "Ravi Kumar",
        "age": 34,
        "occupation": "Courier",
        "condition": "injured",
        "contact": "+91 98450 00000",
        "notes": "Taken to City Hospital",
        "details": {"helmet": True},
    }
    person = client.post(f"/api/cases/{case.id}/persons", json=body).json()
    assert {key: person[key] for key in body} == body
    assert client.patch(f"/api/persons/{person['id']}", json={"age": None}).json()["age"] is None
