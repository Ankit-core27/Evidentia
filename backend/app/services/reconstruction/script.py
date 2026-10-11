"""The scene script: what a planner writes after reading a whole case, and what the
compiler turns into reconstructions for the 3D scene.

A script describes one place (roads, rooms or open ground, with landmarks and the
physical traces found there), the vehicles, people and items involved, and one to
three scenarios. Each scenario is a sequence of stages, and each stage places the
entities at one moment. Where the evidence disagrees, each account gets its own
scenario, so the investigator can compare them.

Positions are metres east and north of the scene's origin. Headings are compass
bearings in degrees: 0 north, 90 east, 180 south, 270 west.
"""

from typing import Literal

from pydantic import BaseModel, Field

SCRIPT_VERSION = 1

Side = Literal["north", "south", "east", "west"]
TimeOfDay = Literal["day", "night", "dawn", "dusk"]


class Point(BaseModel):
    east: float = Field(description="Metres east of the origin; negative is west.")
    north: float = Field(description="Metres north of the origin; negative is south.")


class Source(BaseModel):
    evidence_id: int = Field(description="The ID of the evidence item.")
    passage: str = Field(
        "", description="The shortest sentence or clause of that evidence's text that supports this, copied verbatim."
    )


class Road(BaseModel):
    name: str
    runs: Literal["east-west", "north-south"]
    arms: list[Side] = Field(
        description=(
            "The directions the road extends from the origin: both ends for a road that passes through, "
            "one end for the minor road of a T-junction."
        )
    )
    lanes_each_way: int = Field(1, description="1 to 3.")
    lane_width_m: float = Field(3.5, description="2.5 to 4.5 m.")


class Junction(BaseModel):
    signals: bool = Field(False, description="True if traffic signals control the junction.")
    zebra_crossings: bool = False


class Opening(BaseModel):
    kind: Literal["door", "window", "opening"]
    wall: Side
    offset_m: float = Field(
        0, description="From the middle of the wall: positive is east along north and south walls, north along east and west walls."
    )
    width_m: float = Field(0.9, description="0.3 to 6 m.")
    state: Literal["closed", "open", "forced", "broken"] = "closed"
    label: str = ""


class Room(BaseModel):
    ref: str = Field(description='A short id, such as "r1".')
    name: str = Field(description='Such as "Living room" or "Warehouse floor".')
    centre: Point
    width_m: float = Field(description="East-west size, 1 to 80 m.")
    depth_m: float = Field(description="North-south size, 1 to 80 m.")
    height_m: float = Field(2.8, description="2 to 12 m.")
    floor: Literal["wood", "tile", "marble", "concrete", "carpet"] = "tile"
    openings: list[Opening] = []


class Landmark(BaseModel):
    """Something fixed that helps place the incident: a shop, a bus stop, a parked bus,
    furniture in a room."""

    kind: Literal["building", "shop", "bus_stop", "tree", "streetlight", "signal", "wall", "parked_vehicle", "furniture"]
    label: str
    model: str = Field("", description="For furniture and parked vehicles: a model id from the catalogue.")
    position: Point
    heading_deg: float = Field(0, description="The bearing its front faces.")
    width_m: float = Field(0, description="For buildings and walls; 0 to use a typical size.")
    depth_m: float = 0
    floors: int = Field(0, description="0 to 30; 0 for a typical height.")
    sign: str = Field("", description="The text on a shop sign.")
    sources: list[Source] = []


class Entity(BaseModel):
    """A vehicle, person or item that takes part in the scenarios."""

    ref: str = Field(description='A short id, such as "v1", "p1" or "i1".')
    kind: Literal["vehicle", "person", "item"]
    model: str = Field(description="A model id from the catalogue.")
    label: str = Field(description='As an investigator would name it, such as "White hatchback" or "Anita Desai".')
    object_id: int | None = Field(None, description="The ID of the case's vehicle or item record this stands for.")
    person_id: int | None = Field(None, description="The ID of the case's person record this stands for.")
    colour: str = ""
    plate: str = ""
    sources: list[Source] = []


class Trace(BaseModel):
    """Physical evidence recorded at the scene, such as skid marks or blood."""

    kind: Literal[
        "skid_marks", "debris", "glass", "blood", "impact_point", "fire_origin", "burn_area", "forced_entry", "footprints", "evidence_marker"
    ]
    label: str
    position: Point = Field(description="Where it is, or where it starts for skid marks and footprints.")
    end: Point | None = Field(None, description="Where skid marks or footprints end.")
    radius_m: float = Field(0, description="For areas such as debris fields, blood pools and burn areas, up to 30 m.")
    sources: list[Source] = []


class Placement(BaseModel):
    ref: str = Field(description="The ref of an entity.")
    position: Point
    heading_deg: float = Field(description="The bearing the entity faces.")
    pose: Literal["standing", "walking", "running", "lying", "seated", "crouching", "driving"] = Field(
        "standing", description='For people. Use "driving" for a person inside a vehicle; they are then not drawn.'
    )
    note: str = ""


class Stage(BaseModel):
    label: str = Field(description='Two or three words, such as "Approach", "Impact" or "Rest positions".')
    time: str = Field("", description="Local time, such as 21:40:12, or empty if unknown.")
    description: str = Field(description="One or two sentences on what happens at this moment.")
    event_ids: list[int] = Field([], description="IDs of the case's events at this moment.")
    placements: list[Placement]


class Scenario(BaseModel):
    title: str = Field(description='A short claim, such as "Van moved off before its green".')
    assumptions: list[str] = Field(description="What this scenario takes as true where the evidence is unsettled.")
    supported_by: list[Source] = []
    stages: list[Stage] = Field(description="Two to five stages in time order.")


class Viewpoint(BaseModel):
    label: str = Field(description='Such as "Anita Desai\'s view".')
    person_id: int | None = None
    position: Point
    eye_height_m: float = Field(1.6, description="0.3 to 40 m.")
    looks_at: Point


class Setting(BaseModel):
    kind: Literal["road", "indoor", "outdoor"]
    description: str = Field(description="One sentence on the place.")
    address: str = ""
    time_of_day: TimeOfDay = "day"
    drive_side: Literal["left", "right"] = Field("left", description="The side of the road traffic keeps to.")
    roads: list[Road] = Field([], description="For road scenes: one road, or two at right angles meeting at the origin.")
    junction: Junction = Junction()
    rooms: list[Room] = Field([], description="For indoor scenes.")
    landmarks: list[Landmark] = []


class SceneScript(BaseModel):
    title: str
    summary: str = Field(description="Two to four neutral sentences on what the reconstruction shows.")
    setting: Setting
    entities: list[Entity]
    traces: list[Trace] = []
    viewpoints: list[Viewpoint] = []
    scenarios: list[Scenario] = Field(description="One scenario, or one per competing account (at most three).")
    open_questions: list[str] = Field(
        [], description="What the evidence doesn't settle and an investigator should find out."
    )


# JSON Schema keywords Gemini's structured output accepts; others are dropped, and an
# exclusive bound becomes an inclusive one.
SCHEMA_KEYWORDS = {
    "$defs", "$ref", "type", "title", "description", "properties", "required", "items", "enum", "anyOf",
    "minimum", "maximum", "minItems", "maxItems", "additionalProperties", "format",
}  # fmt: skip


def _for_gemini(node):
    if isinstance(node, list):
        return [_for_gemini(n) for n in node]
    if not isinstance(node, dict):
        return node
    out = {}
    for key, value in node.items():
        if key in ("properties", "$defs"):
            out[key] = {name: _for_gemini(v) for name, v in value.items()}
        elif key == "exclusiveMinimum":
            out["minimum"] = value
        elif key == "exclusiveMaximum":
            out["maximum"] = value
        elif key in SCHEMA_KEYWORDS:
            out[key] = _for_gemini(value)
    return out


RESPONSE_SCHEMA = _for_gemini(SceneScript.model_json_schema())
