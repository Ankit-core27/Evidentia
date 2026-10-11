"""Tests for the reconstruction routes: scenarios, stages, scene placements and
annotations (task B4)."""

from sqlalchemy import select

from app.models import AuditLog, EvidenceLink, Reconstruction, ReconstructionStage, SceneAnnotation, SceneObject
from tests.factories import make_case, make_event, make_evidence, make_investigator, make_object


def _save(db, row):
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def make_reconstruction(db, case, **fields) -> Reconstruction:
    values = {"scenario": "Van ran the red light", "assumptions": "Signal timing from the controller log."}
    return _save(db, Reconstruction(case_id=case.id, **(values | fields)))


def make_stage(db, reconstruction, **fields) -> ReconstructionStage:
    values = {"stage_order": 1, "label": "Approach", "event_ids": []}
    return _save(db, ReconstructionStage(reconstruction_id=reconstruction.id, **(values | fields)))


def make_scene_object(db, stage, **fields) -> SceneObject:
    values = {"model_id": "hatchback", "label": "Hatchback", "position": [1.0, 0.0, 2.0]}
    return _save(db, SceneObject(stage_id=stage.id, **(values | fields)))


def make_annotation(db, reconstruction, **fields) -> SceneAnnotation:
    values = {"kind": "note", "data": {"text": "Skid marks start here"}}
    return _save(db, SceneAnnotation(reconstruction_id=reconstruction.id, **(values | fields)))


def audit_rows(db, record_type):
    return db.scalars(select(AuditLog).where(AuditLog.record_type == record_type).order_by(AuditLog.id)).all()


def body_error(response, loc):
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert [e["loc"] for e in errors] == [["body", *loc]]
    return errors[0]["msg"]


# GET, POST /cases/{id}/reconstructions --------------------------------------


def test_list_reconstructions_returns_only_this_case_in_id_order(client, db):
    case, other = make_case(db), make_case(db, title="Other case")
    first = make_reconstruction(db, case)
    make_reconstruction(db, other)
    second = make_reconstruction(db, case, scenario="Car ran the red light", version=2, scene_file="junction.json")

    response = client.get(f"/api/cases/{case.id}/reconstructions")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": first.id,
            "case_id": case.id,
            "scenario": "Van ran the red light",
            "version": 1,
            "assumptions": "Signal timing from the controller log.",
            "scene_file": None,
            "origin": "investigator",
        },
        {
            "id": second.id,
            "case_id": case.id,
            "scenario": "Car ran the red light",
            "version": 2,
            "assumptions": "Signal timing from the controller log.",
            "scene_file": "junction.json",
            "origin": "investigator",
        },
    ]


def test_list_reconstructions_of_unknown_case_is_404(client):
    response = client.get("/api/cases/99/reconstructions")
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


def test_create_reconstruction_starts_at_version_1_and_is_audited(client, db):
    case = make_case(db)
    investigator = make_investigator(db)

    response = client.post(
        f"/api/cases/{case.id}/reconstructions",
        json={"scenario": "Van ran the red light", "scene_file": "ring-road-junction.json"},
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 201
    created = response.json()
    assert created == {
        "id": created["id"],
        "case_id": case.id,
        "scenario": "Van ran the red light",
        "version": 1,
        "assumptions": "",
        "scene_file": "ring-road-junction.json",
        "origin": "investigator",
    }
    [entry] = audit_rows(db, "reconstruction")
    assert (entry.action, entry.record_id, entry.case_id, entry.actor_id) == (
        "modified",
        created["id"],
        case.id,
        investigator.id,
    )
    assert entry.detail == {"created": True}


def test_create_reconstruction_rejects_bad_bodies(client, db):
    case = make_case(db)
    assert client.post(f"/api/cases/{case.id}/reconstructions", json={}).status_code == 422
    assert client.post(f"/api/cases/{case.id}/reconstructions", json={"scenario": ""}).status_code == 422
    # The version is set by the server, not the client.
    response = client.post(f"/api/cases/{case.id}/reconstructions", json={"scenario": "A", "version": 3})
    assert response.status_code == 422
    assert db.scalars(select(Reconstruction)).all() == []


def test_create_reconstruction_for_unknown_case_is_404(client):
    response = client.post("/api/cases/99/reconstructions", json={"scenario": "Van ran the red light"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


# GET /reconstructions/{id} --------------------------------------------------


def test_get_reconstruction_has_stages_in_order_with_objects_and_annotations(client, db):
    case = make_case(db)
    vehicle = make_object(db, case)
    event = make_event(db, case)
    reconstruction = make_reconstruction(db, case)
    impact = make_stage(db, reconstruction, stage_order=2, label="Impact", event_ids=[event.id])
    approach = make_stage(db, reconstruction, stage_order=1, label="Approach")
    car = make_scene_object(db, impact, object_id=vehicle.id, rotation=[0.0, 1.57, 0.0])
    van = make_scene_object(db, impact, model_id="van", label="Van", scale=[1.0, 1.2, 1.0])
    everywhere = make_annotation(db, reconstruction)
    at_impact = make_annotation(db, reconstruction, stage_id=impact.id, kind="measurement", data={"metres": 14.2})
    # Another scenario's rows stay out.
    other = make_reconstruction(db, case, scenario="Car ran the red light")
    make_scene_object(db, make_stage(db, other))
    make_annotation(db, other)

    response = client.get(f"/api/reconstructions/{reconstruction.id}")

    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == reconstruction.id
    assert detail["scenario"] == "Van ran the red light"
    assert detail["version"] == 1
    assert [s["label"] for s in detail["stages"]] == ["Approach", "Impact"]
    assert detail["stages"][0] == {
        "id": approach.id,
        "reconstruction_id": reconstruction.id,
        "stage_order": 1,
        "label": "Approach",
        "event_ids": [],
        "scene_objects": [],
    }
    assert detail["stages"][1]["event_ids"] == [event.id]
    assert detail["stages"][1]["scene_objects"] == [
        {
            "id": car.id,
            "stage_id": impact.id,
            "model_id": "hatchback",
            "object_id": vehicle.id,
            "label": "Hatchback",
            "position": [1.0, 0.0, 2.0],
            "rotation": [0.0, 1.57, 0.0],
            "scale": [1.0, 1.0, 1.0],
        },
        {
            "id": van.id,
            "stage_id": impact.id,
            "model_id": "van",
            "object_id": None,
            "label": "Van",
            "position": [1.0, 0.0, 2.0],
            "rotation": [0.0, 0.0, 0.0],
            "scale": [1.0, 1.2, 1.0],
        },
    ]
    assert detail["annotations"] == [
        {
            "id": everywhere.id,
            "reconstruction_id": reconstruction.id,
            "stage_id": None,
            "kind": "note",
            "data": {"text": "Skid marks start here"},
        },
        {
            "id": at_impact.id,
            "reconstruction_id": reconstruction.id,
            "stage_id": impact.id,
            "kind": "measurement",
            "data": {"metres": 14.2},
        },
    ]


def test_get_reconstruction_without_stages(client, db):
    reconstruction = make_reconstruction(db, make_case(db))
    detail = client.get(f"/api/reconstructions/{reconstruction.id}").json()
    assert detail["stages"] == []
    assert detail["annotations"] == []


def test_get_unknown_reconstruction_is_404(client):
    response = client.get("/api/reconstructions/99")
    assert response.status_code == 404
    assert response.json() == {"detail": "Reconstruction not found"}


# POST /reconstructions/{id}/stages ------------------------------------------


def test_first_stage_defaults_to_order_1_and_is_audited(client, db):
    case = make_case(db)
    event = make_event(db, case)
    reconstruction = make_reconstruction(db, case)

    response = client.post(
        f"/api/reconstructions/{reconstruction.id}/stages", json={"label": "Approach", "event_ids": [event.id]}
    )

    assert response.status_code == 201
    stage = response.json()
    assert stage == {
        "id": stage["id"],
        "reconstruction_id": reconstruction.id,
        "stage_order": 1,
        "label": "Approach",
        "event_ids": [event.id],
    }
    [entry] = audit_rows(db, "stage")
    assert (entry.action, entry.record_id, entry.case_id, entry.detail) == (
        "modified",
        stage["id"],
        case.id,
        {"created": True},
    )


def test_stage_order_defaults_to_after_the_last_stage(client, db):
    reconstruction = make_reconstruction(db, make_case(db))
    make_stage(db, reconstruction, stage_order=1)
    make_stage(db, reconstruction, stage_order=5, label="Aftermath")
    # Stages of another scenario don't count.
    make_stage(db, make_reconstruction(db, make_case(db)), stage_order=9)

    response = client.post(f"/api/reconstructions/{reconstruction.id}/stages", json={"label": "Rest"})

    assert response.status_code == 201
    assert response.json()["stage_order"] == 6
    assert response.json()["event_ids"] == []


def test_stage_order_can_be_given(client, db):
    reconstruction = make_reconstruction(db, make_case(db))
    make_stage(db, reconstruction, stage_order=1)

    response = client.post(
        f"/api/reconstructions/{reconstruction.id}/stages", json={"label": "Before", "stage_order": 0}
    )

    assert response.status_code == 201
    assert response.json()["stage_order"] == 0


def test_stage_events_must_belong_to_the_case(client, db):
    case = make_case(db)
    own = make_event(db, case)
    foreign = make_event(db, make_case(db, title="Other case"))
    reconstruction = make_reconstruction(db, case)
    url = f"/api/reconstructions/{reconstruction.id}/stages"

    msg = body_error(client.post(url, json={"label": "Impact", "event_ids": [own.id, foreign.id]}), ["event_ids"])
    assert str(foreign.id) in msg
    body_error(client.post(url, json={"label": "Impact", "event_ids": [999]}), ["event_ids"])

    assert db.scalars(select(ReconstructionStage)).all() == []
    assert audit_rows(db, "stage") == []


def test_stage_rejects_bad_bodies(client, db):
    reconstruction = make_reconstruction(db, make_case(db))
    url = f"/api/reconstructions/{reconstruction.id}/stages"
    assert client.post(url, json={}).status_code == 422
    assert client.post(url, json={"label": ""}).status_code == 422
    assert client.post(url, json={"label": "Impact", "scene_objects": []}).status_code == 422


def test_stage_for_unknown_reconstruction_is_404(client):
    response = client.post("/api/reconstructions/99/stages", json={"label": "Approach"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Reconstruction not found"}


# PUT /stages/{id}/scene-objects ---------------------------------------------


def test_put_scene_objects_replaces_the_stage_placements(client, db):
    case = make_case(db)
    vehicle = make_object(db, case)
    reconstruction = make_reconstruction(db, case)
    stage = make_stage(db, reconstruction)
    old_id = make_scene_object(db, stage).id
    other_stage = make_stage(db, reconstruction, stage_order=2, label="Impact")
    untouched = make_scene_object(db, other_stage)
    investigator = make_investigator(db)

    response = client.put(
        f"/api/stages/{stage.id}/scene-objects",
        json=[
            {
                "model_id": "hatchback",
                "object_id": vehicle.id,
                "label": "Hatchback",
                "position": [3.5, 0, -1.25],
                "rotation": [0, 3.14, 0],
                "scale": [1, 1, 1],
            },
            {"model_id": "traffic_light"},
        ],
        headers={"X-Investigator-Id": str(investigator.id)},
    )

    assert response.status_code == 200
    placed = response.json()
    assert [{k: v for k, v in o.items() if k != "id"} for o in placed] == [
        {
            "stage_id": stage.id,
            "model_id": "hatchback",
            "object_id": vehicle.id,
            "label": "Hatchback",
            "position": [3.5, 0.0, -1.25],
            "rotation": [0.0, 3.14, 0.0],
            "scale": [1.0, 1.0, 1.0],
        },
        {
            "stage_id": stage.id,
            "model_id": "traffic_light",
            "object_id": None,
            "label": "",
            "position": [0.0, 0.0, 0.0],
            "rotation": [0.0, 0.0, 0.0],
            "scale": [1.0, 1.0, 1.0],
        },
    ]
    db.expire_all()
    rows = db.scalars(select(SceneObject).where(SceneObject.stage_id == stage.id).order_by(SceneObject.id)).all()
    assert [r.id for r in rows] == [o["id"] for o in placed]
    assert old_id not in [r.id for r in rows]
    assert db.get(SceneObject, untouched.id) is not None
    # The detail serves the new placements.
    detail = client.get(f"/api/reconstructions/{reconstruction.id}").json()
    assert detail["stages"][0]["scene_objects"] == placed
    [entry] = audit_rows(db, "stage")
    assert (entry.action, entry.record_id, entry.case_id, entry.actor_id, entry.detail) == (
        "modified",
        stage.id,
        case.id,
        investigator.id,
        {"scene_objects": 2},
    )


def test_put_empty_list_clears_the_stage(client, db):
    stage = make_stage(db, make_reconstruction(db, make_case(db)))
    make_scene_object(db, stage)
    make_scene_object(db, stage, model_id="van")

    response = client.put(f"/api/stages/{stage.id}/scene-objects", json=[])

    assert response.status_code == 200
    assert response.json() == []
    assert db.scalars(select(SceneObject)).all() == []
    assert audit_rows(db, "stage")[0].detail == {"scene_objects": 0}


def test_put_scene_objects_removes_links_to_the_replaced_placements(client, db):
    case = make_case(db)
    evidence = make_evidence(db, case)
    stage = make_stage(db, make_reconstruction(db, case))
    old_id = make_scene_object(db, stage).id
    db.add_all(
        [
            EvidenceLink(evidence_id=evidence.id, target_type="scene_object", target_id=old_id),
            EvidenceLink(evidence_id=evidence.id, target_type="event", target_id=old_id),
        ]
    )
    db.commit()

    assert client.put(f"/api/stages/{stage.id}/scene-objects", json=[{"model_id": "hatchback"}]).status_code == 200

    db.expire_all()
    assert [(link.target_type, link.target_id) for link in db.scalars(select(EvidenceLink))] == [("event", old_id)]


def test_put_scene_objects_must_use_objects_of_the_case(client, db):
    case = make_case(db)
    own = make_object(db, case)
    foreign = make_object(db, make_case(db, title="Other case"))
    stage = make_stage(db, make_reconstruction(db, case))
    kept = make_scene_object(db, stage)
    url = f"/api/stages/{stage.id}/scene-objects"

    response = client.put(
        url, json=[{"model_id": "hatchback", "object_id": own.id}, {"model_id": "van", "object_id": foreign.id}]
    )
    assert str(foreign.id) in body_error(response, [1, "object_id"])
    body_error(client.put(url, json=[{"model_id": "van", "object_id": 999}]), [0, "object_id"])

    db.expire_all()
    assert [r.id for r in db.scalars(select(SceneObject))] == [kept.id]
    assert audit_rows(db, "stage") == []


def test_put_scene_objects_rejects_bad_bodies(client, db):
    stage = make_stage(db, make_reconstruction(db, make_case(db)))
    url = f"/api/stages/{stage.id}/scene-objects"
    assert client.put(url, json={"model_id": "hatchback"}).status_code == 422
    assert client.put(url, json=[{"label": "No model"}]).status_code == 422
    assert client.put(url, json=[{"model_id": "van", "position": [1, 2]}]).status_code == 422
    assert client.put(url, json=[{"model_id": "van", "id": 4}]).status_code == 422


def test_put_scene_objects_on_unknown_stage_is_404(client):
    response = client.put("/api/stages/99/scene-objects", json=[])
    assert response.status_code == 404
    assert response.json() == {"detail": "Stage not found"}


# GET, POST /reconstructions/{id}/annotations --------------------------------


def test_list_annotations_returns_this_reconstruction_in_id_order(client, db):
    case = make_case(db)
    reconstruction = make_reconstruction(db, case)
    stage = make_stage(db, reconstruction)
    first = make_annotation(db, reconstruction, kind="viewpoint", data={"position": [0, 10, 20]})
    make_annotation(db, make_reconstruction(db, case))
    second = make_annotation(db, reconstruction, stage_id=stage.id)

    response = client.get(f"/api/reconstructions/{reconstruction.id}/annotations")

    assert response.status_code == 200
    assert [(a["id"], a["kind"], a["stage_id"]) for a in response.json()] == [
        (first.id, "viewpoint", None),
        (second.id, "note", stage.id),
    ]
    assert response.json()[0]["data"] == {"position": [0, 10, 20]}


def test_list_annotations_of_unknown_reconstruction_is_404(client):
    response = client.get("/api/reconstructions/99/annotations")
    assert response.status_code == 404
    assert response.json() == {"detail": "Reconstruction not found"}


def test_create_annotation_is_audited(client, db):
    case = make_case(db)
    reconstruction = make_reconstruction(db, case)
    stage = make_stage(db, reconstruction)

    response = client.post(
        f"/api/reconstructions/{reconstruction.id}/annotations",
        json={"stage_id": stage.id, "kind": "measurement", "data": {"from": [0, 0, 0], "to": [14, 0, 0]}},
    )

    assert response.status_code == 201
    annotation = response.json()
    assert annotation == {
        "id": annotation["id"],
        "reconstruction_id": reconstruction.id,
        "stage_id": stage.id,
        "kind": "measurement",
        "data": {"from": [0, 0, 0], "to": [14, 0, 0]},
    }
    [entry] = audit_rows(db, "annotation")
    assert (entry.action, entry.record_id, entry.case_id, entry.detail) == (
        "modified",
        annotation["id"],
        case.id,
        {"created": True},
    )


def test_create_annotation_for_every_stage(client, db):
    reconstruction = make_reconstruction(db, make_case(db))

    response = client.post(f"/api/reconstructions/{reconstruction.id}/annotations", json={"kind": "note"})

    assert response.status_code == 201
    assert response.json()["stage_id"] is None
    assert response.json()["data"] == {}


def test_annotation_stage_must_belong_to_the_reconstruction(client, db):
    case = make_case(db)
    reconstruction = make_reconstruction(db, case)
    other_stage = make_stage(db, make_reconstruction(db, case, scenario="Car ran the red light"))
    url = f"/api/reconstructions/{reconstruction.id}/annotations"

    body_error(client.post(url, json={"kind": "note", "stage_id": other_stage.id}), ["stage_id"])
    body_error(client.post(url, json={"kind": "note", "stage_id": 999}), ["stage_id"])

    assert db.scalars(select(SceneAnnotation)).all() == []
    assert audit_rows(db, "annotation") == []


def test_create_annotation_rejects_bad_bodies(client, db):
    reconstruction = make_reconstruction(db, make_case(db))
    url = f"/api/reconstructions/{reconstruction.id}/annotations"
    assert client.post(url, json={}).status_code == 422
    assert client.post(url, json={"kind": "sketch"}).status_code == 422
    assert client.post(url, json={"kind": "note", "data": [1, 2]}).status_code == 422


def test_create_annotation_for_unknown_reconstruction_is_404(client):
    response = client.post("/api/reconstructions/99/annotations", json={"kind": "note"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Reconstruction not found"}
