"""Tests for generating reconstructions from a case's evidence
(POST /api/cases/{id}/reconstructions/generate). Gemini is never called: a fake
client answers with a scene script, and without one the rules planner drafts it."""

import json
import math
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models import AiRun, AuditLog, EvidenceLink, Reconstruction, SceneAnnotation, SceneObject
from app.seed import seed
from app.services.ai import client as ai_client
from app.services.reconstruction.script import RESPONSE_SCHEMA
from tests.factories import make_case, make_evidence, make_investigator, make_object

HEADERS = {"X-Investigator-Id": "1"}


class FakeGemini:
    """Answers generate_content with `script` (a dict, or raw text), or raises `error`."""

    def __init__(self, script):
        self.script = script
        self.error: Exception | None = None
        self.calls = []
        self.models = SimpleNamespace(generate_content=self._generate)

    def _generate(self, *, model, contents, config=None):
        self.calls.append(SimpleNamespace(model=model, contents=contents, config=config))
        if self.error is not None:
            raise self.error
        text = self.script if isinstance(self.script, str) else json.dumps(self.script)
        return SimpleNamespace(text=text)


@pytest.fixture
def seeded(db):
    seed(db)
    return db


def generate(client, case_id, **body):
    return client.post(f"/api/cases/{case_id}/reconstructions/generate", json=body, headers=HEADERS)


def detail(client, reconstruction_id):
    return client.get(f"/api/reconstructions/{reconstruction_id}").json()


def placement(stage, label):
    return next(o for o in stage["scene_objects"] if o["label"] == label)


def bearing(o):
    """The compass bearing a scene object faces."""
    return round(90 - math.degrees(o["rotation"][1])) % 360


# Without Gemini: the rules planner ------------------------------------------


def test_without_gemini_the_junction_case_is_drafted_from_its_records(client, seeded):
    response = generate(client, 1)

    assert response.status_code == 201
    body = response.json()
    assert body["generator"] == "rules"
    assert body["warnings"] == ["GEMINI_API_KEY isn't set, so this is a draft from the case records, made without AI."]
    [created] = body["reconstructions"]
    assert (created["origin"], created["version"], created["scene_file"]) == ("ai", 1, None)

    d = detail(client, created["id"])
    scene = d["scene"]
    assert scene["setting"]["kind"] == "road"
    assert scene["setting"]["time_of_day"] == "night"
    assert {(r["name"], r["axis"]) for r in scene["roads"]} == {("Ring Road", "x"), ("5th Avenue", "z")}
    assert scene["junction"]["signals"] is True
    assert scene["generated"]["by"] == "rules"
    assert [s["label"] for s in d["stages"]] == ["Approach", "Impact", "Rest positions"]
    assert [s["event_ids"] for s in d["stages"]] == [[1, 2, 3, 4], [5, 6, 7], [8, 9, 10]]

    approach, impact, rest = d["stages"]
    # Eastbound on Ring Road in the left lane; northbound on 5th Avenue, waiting at its stop line.
    hatchback = placement(impact, "White hatchback")
    assert (hatchback["model_id"], hatchback["object_id"], bearing(hatchback)) == ("hatchback", 1, 90)
    assert hatchback["position"][2] == pytest.approx(-1.75)
    van = placement(approach, "Delivery van")
    assert (van["model_id"], van["object_id"], bearing(van)) == ("delivery-van", 2, 0)
    assert van["position"][0] == pytest.approx(-1.75)
    assert van["position"][2] > 8
    # The van's front meets the hatchback's side at the moment of impact.
    van_front = placement(impact, "Delivery van")["position"][2] - 3.8 / 2
    assert van_front == pytest.approx(hatchback["position"][2] + 1.74 / 2, abs=0.05)
    # The witnesses stand at their corners; the cyclist rides away north.
    desai = placement(approach, "Anita Desai")
    assert desai["position"][0] > 3.5 and desai["position"][2] < -3.5
    assert placement(rest, "Unidentified cyclist")["position"][2] < -20

    skid = next(s for s in scene["static"] if s["kind"] == "skid-marks")
    assert skid["to"][0] - skid["from"][0] == pytest.approx(8.4)
    assert skid["evidence"][0]["evidence_id"] == 1
    store = next(s for s in scene["static"] if s.get("sign") == "CORNER STORE")
    assert store["position"][0] < 0 and store["position"][2] > 0
    kinds = sorted(a["kind"] for a in d["annotations"])
    assert kinds == ["measurement", "viewpoint", "viewpoint", "viewpoint"]

    links = seeded.scalars(
        select(EvidenceLink).where(EvidenceLink.target_type == "scene_object", EvidenceLink.target_id == hatchback["id"])
    ).all()
    assert [(link.evidence_id, link.chunk_id is not None) for link in links] == [(1, True)]
    assert "travelling east on Ring Road" in links[0].passage
    run = seeded.scalars(select(AiRun).where(AiRun.task == "scene_script")).one()
    assert (run.case_id, run.model) == (1, "rules-v1")
    audit = seeded.scalars(
        select(AuditLog).where(AuditLog.record_type == "reconstruction", AuditLog.record_id == created["id"])
    ).one()
    assert audit.detail == {"created": True, "generated_by": "rules"}


def test_without_gemini_the_hit_and_run_car_leaves_the_scene(client, seeded):
    [created] = generate(client, 2).json()["reconstructions"]

    d = detail(client, created["id"])
    assert [s["label"] for s in d["stages"]] == ["Approach", "Impact", "Aftermath"]
    impact, after = d["stages"][1:]
    car = placement(impact, "Dark hatchback (unidentified)")
    assert placement(after, "Dark hatchback (unidentified)")["position"][0] - car["position"][0] > 30
    assert placement(after, "Unidentified pedestrian")["model_id"] == "person:lying"
    labels = {s.get("label") for s in d["scene"]["static"]}
    assert {"Bus stop 14", "Route 220 bus"} <= labels


def test_without_gemini_the_burglary_is_drawn_as_rooms_with_the_forced_door(client, seeded):
    [created] = generate(client, 4).json()["reconstructions"]

    scene = detail(client, created["id"])["scene"]
    assert scene["setting"]["kind"] == "indoor"
    assert [r["name"] for r in scene["rooms"]] == ["Living room", "Bedroom", "Kitchen", "Balcony"]
    door = next(o for o in scene["rooms"][0]["openings"] if o["label"] == "Balcony door")
    assert door["state"] == "forced"
    trace = next(s for s in scene["static"] if s["kind"] == "trace")
    assert (trace["trace"], trace["evidence"][0]["evidence_id"]) == ("forced_entry", 12)


def test_without_gemini_the_fire_marks_its_origin(client, seeded):
    [created] = generate(client, 3).json()["reconstructions"]

    scene = detail(client, created["id"])["scene"]
    traces = {s["trace"]: s for s in scene["static"] if s["kind"] == "trace"}
    assert traces["fire_origin"]["label"] == "Fire origin: electrical panel"
    assert traces["burn_area"]["radius"] == 6
    assert any(s.get("model") == "electrical-panel" for s in scene["static"])


def test_generating_again_adds_a_new_version(client, seeded):
    first = generate(client, 1).json()["reconstructions"][0]
    second = generate(client, 1).json()["reconstructions"][0]

    assert (first["version"], second["version"]) == (1, 2)
    assert second["id"] != first["id"]


def test_generate_for_an_unknown_case_is_404(client):
    response = generate(client, 99)
    assert response.status_code == 404


# With Gemini -----------------------------------------------------------------


def two_scenario_script(case_id_objects):
    hatchback, van = case_id_objects
    car = {"ref": "v1", "kind": "vehicle", "model": "hatchback", "label": "White hatchback", "object_id": hatchback,
           "colour": "White", "sources": [{"evidence_id": 1, "passage": "travelling east on Ring Road"}]}  # fmt: skip
    lorry = {"ref": "v2", "kind": "vehicle", "model": "spaceship", "label": "Van", "object_id": 99}
    stage = lambda label, east: {  # noqa: E731
        "label": label, "description": label, "event_ids": [1, 404],
        "placements": [
            {"ref": "v1", "position": {"east": east, "north": 1.75}, "heading_deg": 90},
            {"ref": "v2", "position": {"east": -1.75, "north": -6}, "heading_deg": 0},
            {"ref": "ghost", "position": {"east": 0, "north": 0}, "heading_deg": 0},
        ],
    }  # fmt: skip
    return {
        "title": "Collision",
        "summary": "Two accounts.",
        "setting": {
            "kind": "road", "description": "Junction.", "time_of_day": "night",
            "roads": [{"name": "Ring Road", "runs": "east-west", "arms": ["east", "west"]},
                      {"name": "5th Avenue", "runs": "east-west", "arms": ["north", "south"]}],
            "junction": {"signals": True},
        },  # fmt: skip
        "entities": [car, lorry],
        "traces": [{"kind": "skid_marks", "label": "Skid", "position": {"east": -9.4, "north": 1.75},
                    "end": {"east": -1, "north": 1.75}, "sources": [{"evidence_id": 777, "passage": "x"}]}],  # fmt: skip
        "viewpoints": [],
        "scenarios": [
            {"title": "Van moved off early", "assumptions": ["Camera clock is right."], "stages": [stage("Approach", -25), stage("Impact", -1)]},
            {"title": "Car ran the red", "assumptions": ["Camera clock is 2 s slow."], "stages": [stage("Approach", -30)]},
            {"title": "Empty", "assumptions": [], "stages": []},
        ],
        "open_questions": ["Has the camera clock been checked?"],
    }  # fmt: skip


@pytest.fixture
def junction_case(db):
    make_investigator(db)
    case = make_case(db)
    make_evidence(db, case, extracted_text="Vehicle 1: white hatchback travelling east on Ring Road.")
    hatchback = make_object(db, case)
    van = make_object(db, case, label="Delivery van")
    return case, (hatchback.id, van.id)


def test_gemini_script_is_checked_and_saved_as_one_reconstruction_per_scenario(client, db, monkeypatch, junction_case):
    case, objects = junction_case
    fake = FakeGemini(two_scenario_script(objects))
    monkeypatch.setattr(ai_client, "get_client", lambda: fake)

    response = generate(client, case.id, instructions="Show both accounts.")

    assert response.status_code == 201
    body = response.json()
    assert body["generator"] == "gemini"
    assert [r["scenario"] for r in body["reconstructions"]] == ["Van moved off early", "Car ran the red"]
    assert body["warnings"] == [
        "5th Avenue was turned to run north-south, at right angles to Ring Road.",
        "\"Van\" used the model \"spaceship\", which doesn't fit a vehicle; drawn as sedan car.",
        "\"Van\" pointed at object 99, which isn't in this case; the link was dropped.",
        "Stage \"Approach\" named events not in this case (1, 404); they were dropped.",
        "Stage \"Approach\" placed \"ghost\", which isn't an entity; it was dropped.",
        "Stage \"Impact\" named events not in this case (1, 404); they were dropped.",
        "Stage \"Impact\" placed \"ghost\", which isn't an entity; it was dropped.",
        "Scenario \"Empty\" had no stages and was left out.",
        "Citations of evidence not in this case were dropped (777).",
    ]
    first = detail(client, body["reconstructions"][0]["id"])
    assert first["assumptions"] == "Camera clock is right."
    assert first["scene"]["scenario"]["title"] == "Van moved off early"
    assert first["scene"]["generated"]["open_questions"] == ["Has the camera clock been checked?"]
    assert first["scene"]["models"]["sedan"]["kind"] == "vehicle"
    assert [r["axis"] for r in first["scene"]["roads"]] == ["x", "z"]
    [car, van] = first["stages"][1]["scene_objects"]
    assert (car["model_id"], car["object_id"], car["position"]) == ("hatchback", objects[0], [-1.0, 0.0, -1.75])
    assert (van["model_id"], van["object_id"]) == ("sedan", None)
    assert first["scene"]["appearance"] == {"White hatchback": {"colour": "White"}}

    # The prompt is the case file plus the instructions, constrained to the script schema.
    [call] = fake.calls
    assert "Vehicle 1: white hatchback travelling east on Ring Road." in call.contents[0]
    assert call.contents[0].endswith("INVESTIGATOR'S INSTRUCTIONS\nShow both accounts.")
    assert call.config.response_json_schema == RESPONSE_SCHEMA
    assert "hatchback (vehicle, 3.85 x 1.74 x 1.53 m)" in call.config.system_instruction
    run = db.scalars(select(AiRun).where(AiRun.task == "scene_script")).one()
    assert run.output["title"] == "Collision"
    links = db.scalars(select(EvidenceLink).where(EvidenceLink.target_type == "scene_object")).all()
    assert {link.target_id for link in links} == {o.id for o in db.scalars(select(SceneObject)) if o.label == "White hatchback"}
    assert db.scalars(select(SceneAnnotation)).all()[0].data["length_m"] == 8.4


@pytest.mark.parametrize(
    ("answer", "error", "warning"),
    [
        ("not json", None, "Gemini's scene script couldn't be read, so this is a draft from the case records."),
        (None, RuntimeError("quota exceeded"), "Gemini couldn't write the scene script (quota exceeded), so this is a draft from the case records."),
        ({"title": "x", "summary": "", "setting": {"kind": "outdoor", "description": "x"}, "entities": [], "scenarios": []}, None,
         "Gemini's scene script was unusable (The scene script has no scenario with stages.), so this is a draft from the case records."),
    ],
)  # fmt: skip
def test_falls_back_to_the_rules_when_gemini_fails(client, db, monkeypatch, junction_case, answer, error, warning):
    case, _ = junction_case
    fake = FakeGemini(answer)
    fake.error = error
    monkeypatch.setattr(ai_client, "get_client", lambda: fake)

    body = generate(client, case.id, instructions="Anything").json()

    assert body["generator"] == "rules"
    assert body["warnings"][:2] == [warning, "The instructions were not used: only Gemini reads them."]
    [created] = body["reconstructions"]
    assert db.get(Reconstruction, created["id"]).scene["generated"]["by"] == "rules"


def test_out_of_range_values_are_clamped_rather_than_rejected(client, db, monkeypatch, junction_case):
    case, objects = junction_case
    script = two_scenario_script(objects)
    script["setting"]["roads"][0].update(lanes_each_way=9, lane_width_m=12)
    script["traces"][0]["radius_m"] = 500
    monkeypatch.setattr(ai_client, "get_client", lambda: FakeGemini(script))

    body = generate(client, case.id).json()

    assert body["generator"] == "gemini"
    road = detail(client, body["reconstructions"][0]["id"])["scene"]["roads"][0]
    assert (road["lanes_each_way"], road["lane_width"]) == (3, 4.5)
