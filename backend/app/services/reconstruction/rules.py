"""The rules planner: a scene script drafted from the case's records and the wording
of its evidence, without Gemini. It is used when GEMINI_API_KEY is unset or the
Gemini planner fails, so every case can still be reconstructed.

It reads what the records and texts state plainly: road names, which way each
vehicle travelled, who stood at which corner, measured skid marks, where a vehicle
came to rest, which door was forced, where a fire started. Anything it has to
estimate (approach distances, room sizes, furniture) is said in the scenario's
assumptions or marked as illustrative. It follows the recorded events in time
order and never takes a side where accounts conflict: the conflicts become open
questions.
"""

import re
from dataclasses import dataclass, field
from datetime import timedelta

from app.models import CaseObject, Event, Person
from app.services.reconstruction.dossier import Dossier
from app.services.reconstruction.geometry import (
    CARDINAL,
    OPPOSITE,
    Vec,
    add,
    bearing_of,
    corner_point,
    half_width,
    lane_offset,
    left_of,
    point,
    unit,
)
from app.services.reconstruction.script import (
    Entity,
    Junction,
    Landmark,
    Opening,
    Placement,
    Road,
    Room,
    Scenario,
    SceneScript,
    Setting,
    Source,
    Stage,
    Trace,
    Viewpoint,
)
from app.services.reconstruction.catalogue import MODELS

# Junction stop lines sit this far from the centre for 3.5 m lanes; see layout.py.
STOP_LINE = 8.0
APPROACH_DISTANCE = 25.0
LEAVE_DISTANCE = 45.0
# Events this long either side of the key event belong to the reconstruction.
EVENT_WINDOW = timedelta(minutes=10)
# Events this close before the key event are part of its stage.
IMPACT_WINDOW = timedelta(seconds=2)

VEHICLE_TYPES: list[tuple[str, list[str]]] = [
    ("bus", ["bus"]),
    ("truck", ["truck", "lorry", "tanker", "tipper", "trailer"]),
    ("delivery-van", ["van", "ace", "tempo", "pickup", "pick-up", "mini truck", "goods carrier"]),
    ("auto-rickshaw", ["auto-rickshaw", "autorickshaw", "rickshaw", "auto"]),
    ("motorcycle", ["motorcycle", "motorbike", "bike", "scooter", "scooty", "moped", "activa", "pulsar", "splendor"]),
    ("bicycle", ["bicycle", "cycle", "cyclist"]),
    ("hatchback", ["hatchback", "swift", "alto", "wagon r", "i10", "i20", "polo", "baleno", "tiago", "kwid", "santro"]),
    ("sedan", ["sedan", "saloon", "dzire", "verna", "ciaz", "corolla", "suv", "jeep", "scorpio", "innova", "car"]),
]
GENERIC_KEYWORDS = {"hatchback": ["car"], "sedan": ["car"], "delivery-van": ["van"]}

ROAD_NAME = re.compile(
    r"\b((?:[A-Z0-9][\w'.-]*\s+){1,3}(?:Road|Avenue|Street|Lane|Marg|Highway|Boulevard|Drive|Rd|St)\b)"
)
NOT_ROAD_WORDS = {"The", "A", "An", "On", "At", "Along", "Near", "Of", "From", "To", "In", "Junction", "And"}
DIRECTION = re.compile(
    r"\b(?:(?:travell?ing|heading|driving|going|moving|riding|coming)\s+(?P<dir>north|south|east|west)\b"
    r"|(?P<bound>north|south|east|west)bound\b"
    r"|from\s+the\s+(?P<from>north|south|east|west)\b)",
    re.I,
)
CORNER = re.compile(r"\b(north|south)[- ]?(east|west)\b(?:\s+(?:corner|kerb|curb|side))?", re.I)
SIDE = re.compile(r"\b(north|south|east|west)(?:ern)?\s+(?:side|kerb|curb|footpath|pavement)\b", re.I)
SKID = re.compile(r"skid\s*marks?\b[^.]*?(\d+(?:\.\d+)?)\s*(?:m\b|metres|meters)", re.I)
REST = re.compile(r"\b(?:came to rest|come to rest|stopped|ended up|was found|lay)\b", re.I)
LEFT_SCENE = re.compile(r"\b(?:did not stop|didn't stop|drove off|drove away|sped off|fled|drove towards|rode away|rides away|ran away|left the scene)\b", re.I)
CENTRE_LINE = re.compile(r"centre line of ((?:[A-Z0-9][\w'.-]*\s+){0,3}(?:Road|Avenue|Street|Lane|Marg|Highway))", re.I)
STOP_LINE_WORDS = re.compile(r"\b(?:stops? at|waited at|waiting at|stopped at)\b[^.]*\bstop line\b", re.I)
STRIKE = re.compile(r"\b(?:strikes?|struck|hits?|collided with|collides with|rammed|knocked)\b", re.I)
PASSIVE_STRIKE = re.compile(r"\b(?:was|were|is|got)\s+(?:struck|hit|knocked)\s+by\b", re.I)
JUNCTION_WORDS = re.compile(r"\b(?:junction|intersection|crossroads|cross-roads|crossing of)\b", re.I)
T_JUNCTION = re.compile(r"\bT[- ]junction\b", re.I)
SIGNAL_WORDS = re.compile(r"\b(?:signal|traffic light|light was|light turned|red light|green light|amber)\b", re.I)
CROSSING_WORDS = re.compile(r"\b(?:pedestrian crossing|zebra|waiting to cross|wait to cross)\b", re.I)
BUS_STOP = re.compile(r"\bbus stop(?:\s+(?:no\.?\s*)?(\d+))?", re.I)
ROUTE_BUS = re.compile(r"\b(?:route\s+(\d+)\s+bus|behind (?:my|the|a) bus|my bus)\b", re.I)
SHOP = re.compile(r"\b(corner store|corner shop|general store|shop|store|tea stall|petrol pump|pharmacy)\b", re.I)
FORCED = re.compile(r"\b(?:forced|broken|pried|prised|smashed|jemmied|tampered)\b", re.I)
OPENING_WORDS = re.compile(r"\b(door|window|grille|lock|shutter)\b", re.I)
FIRE_ORIGIN = re.compile(
    r"\b(?:fire|blaze)\s+(?:started|began|originated|broke out)\s+(?:near|at|in|from|beside|around)\s+(?:the\s+)?([a-z][a-z -]*?)(?=\s+(?:on|in|at|of)\b|[.,;])",
    re.I,
)
PRONOUN = re.compile(r"(?:It|The vehicle|The car|The driver)\b")
NIGHT_TIME = re.compile(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)\b")

INDOOR_WORDS = re.compile(
    r"\b(?:flat|apartment|house|home|room|bedroom|kitchen|hall|warehouse|godown|office|factory|building|floor|balcony|basement|residence)\b",
    re.I,
)
ROAD_WORDS = re.compile(r"\b(?:road|junction|street|avenue|highway|lane|bus stop|carriageway|traffic|vehicle|driver)\b", re.I)
WAREHOUSE = re.compile(r"\b(?:warehouse|godown|factory|storage hall|workshop|mill)\b", re.I)
RESIDENCE = re.compile(r"\b(?:flat|apartment|house|home|residence|bungalow)\b", re.I)
ROOMS: list[tuple[str, re.Pattern]] = [
    ("Bedroom", re.compile(r"\bbed\s?room\b", re.I)),
    ("Kitchen", re.compile(r"\bkitchen\b", re.I)),
    ("Bathroom", re.compile(r"\b(?:bathroom|toilet|washroom)\b", re.I)),
    ("Office", re.compile(r"\b(?:office|study)\b", re.I)),
]


@dataclass
class Sentence:
    text: str
    evidence_id: int | None

    def source(self) -> list[Source]:
        return [Source(evidence_id=self.evidence_id, passage=self.text)] if self.evidence_id else []


@dataclass
class Actor:
    """A vehicle or person the planner places, with what it learned about it."""

    entity: Entity
    keywords: list[str] = field(default_factory=list)
    road: Road | None = None
    bearing: float | None = None
    record: CaseObject | Person | None = None
    spot: Vec | None = None  # where a person stood
    leaves: str | None = None  # direction a person left in


def _split(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if len(s.strip()) > 3]


def _has(pattern: str, text: str) -> int:
    m = re.search(rf"\b{re.escape(pattern)}\b", text, re.I)
    return m.start() if m else -1


def plan_with_rules(d: Dossier) -> SceneScript:
    return RulesPlanner(d).plan()


class RulesPlanner:
    def __init__(self, d: Dossier):
        self.d = d
        self.sentences: list[Sentence] = []
        for evidence, text in d.texts():
            self.sentences += [Sentence(s, evidence.id) for s in _split(text)]
        records = [d.case.title, d.case.description] + [p.notes for p in d.persons] + [p.occupation for p in d.persons]
        records += [loc.address for loc in d.locations] + [e.description for e in d.events]
        for text in records:
            self.sentences += [Sentence(s, None) for s in _split(text or "")]
        self.corpus = d.corpus()
        self.assumptions: list[str] = []
        self.drive_side = "left"
        self.impact: dict = {}
        self.striker_bearing: float | None = None

    # -- the whole script -------------------------------------------------------

    def plan(self) -> SceneScript:
        kind = self._setting_kind()
        if kind == "road":
            setting = self._road_setting()
        elif kind == "indoor":
            setting = self._indoor_setting()
        else:
            setting = Setting(kind="outdoor", description="Open ground around the incident site.", address=self._address())
        self.setting = setting
        vehicles = self._vehicles(setting)
        people = self._people(setting, vehicles)
        items = self._items(setting)
        actors = vehicles + people + items
        key, before, during, after = self._events()
        traces: list[Trace] = []
        if kind == "road":
            stages, focus = self._road_stages(setting, vehicles, people, key, before, during, after)
            traces = self._road_traces(vehicles, focus)
            setting.landmarks += self._road_landmarks(setting, focus)
        else:
            stages, focus = self._place_stages(setting, actors, key, before, during, after)
            traces = self._indoor_traces(setting)
        viewpoints = [
            Viewpoint(
                label=f"{a.entity.label}'s view",
                person_id=a.entity.person_id,
                position=point(a.spot),
                looks_at=point(focus),
            )
            for a in people
            if a.spot is not None and isinstance(a.record, Person) and a.record.role == "witness"
        ]
        open_questions = [c.description for c in self.d.conflicts]
        if self.d.conflicts:
            self.assumptions.append(
                "Where accounts conflict, this draft follows the recorded events in time order and takes no side; "
                "generate with Gemini for one scenario per account."
            )
        self.assumptions.append(
            "Positions not measured in the evidence, such as approach distances, rest positions and room sizes, are estimates."
        )
        used = [a for a in actors if any(p.ref == a.entity.ref for s in stages for p in s.placements)]
        sources = {s.evidence_id for a in used for s in a.entity.sources} | {
            s.evidence_id for t in traces for s in t.sources
        }
        scenario = Scenario(
            title="Sequence from the case records",
            assumptions=self.assumptions,
            supported_by=[Source(evidence_id=i) for i in sorted(sources)],
            stages=stages,
        )
        labels = ", ".join(s.label.lower() for s in stages)
        return SceneScript(
            title=self.d.case.title,
            summary=(
                f"Draft reconstruction of {self.d.case.title.rstrip('.')}, built from the case's records and the wording "
                f"of its evidence without AI. Stages: {labels}."
            ),
            setting=setting,
            entities=[a.entity for a in used],
            traces=traces,
            viewpoints=viewpoints,
            scenarios=[scenario],
            open_questions=open_questions,
        )

    # -- setting ----------------------------------------------------------------

    def _setting_kind(self) -> str:
        incident = self.d.case.incident_type
        if incident == "road_accident":
            return "road"
        indoor = len(INDOOR_WORDS.findall(self.corpus)) + (2 if incident in ("fire", "burglary") else 0)
        road = len(ROAD_WORDS.findall(self.corpus))
        if indoor == 0 and road == 0:
            return "outdoor"
        return "indoor" if indoor >= road else "road"

    def _address(self) -> str:
        site = next((loc for loc in self.d.locations if loc.kind == "incident_site"), None)
        return site.address if site else ""

    def _time_of_day(self) -> str:
        for text in [self.d.case.description, self.corpus]:
            m = NIGHT_TIME.search(text or "")
            if m:
                hour = int(m.group(1))
                break
        else:
            hour = self.d.case.incident_at.hour if self.d.case.incident_at else 12
        if hour >= 20 or hour < 5:
            return "night"
        if hour < 7:
            return "dawn"
        if hour >= 18:
            return "dusk"
        return "day"

    def _road_names(self) -> list[str]:
        counts: dict[str, int] = {}
        for m in ROAD_NAME.finditer(self.corpus):
            words = m.group(1).split()
            while words and words[0] in NOT_ROAD_WORDS:
                words = words[1:]
            if len(words) < 2:
                continue
            name = " ".join(words)
            counts[name] = counts.get(name, 0) + 1
        return sorted(counts, key=lambda n: (-counts[n], self.corpus.find(n)))

    def _road_setting(self) -> Setting:
        names = self._road_names()
        junction = bool(JUNCTION_WORDS.search(self.corpus)) and len(names) >= 2
        names = names[:2] if junction else names[:1] or ["Road"]
        votes: dict[str, list[str]] = {n: [] for n in names}
        for s in self.sentences:
            for m in DIRECTION.finditer(s.text):
                direction = self._direction(m)
                road = self._nearest_road(s.text, m.start(), names)
                if road:
                    votes[road].append("east-west" if direction in ("east", "west") else "north-south")
        roads: list[Road] = []
        for i, name in enumerate(names):
            runs = max(set(votes[name]), key=votes[name].count) if votes[name] else ("east-west" if i == 0 else "north-south")
            if roads and roads[0].runs == runs:
                runs = "north-south" if runs == "east-west" else "east-west"
            arms = ["east", "west"] if runs == "east-west" else ["north", "south"]
            roads.append(Road(name=name, runs=runs, arms=arms))
        if junction and T_JUNCTION.search(self.corpus):
            minor = roads[1]
            minor.arms = ["south"] if minor.runs == "north-south" else ["west"]
        signals = junction and bool(SIGNAL_WORDS.search(self.corpus))
        if not junction:
            self.assumptions.append(f"The road is drawn straight, with one {roads[0].lane_width_m:g} m lane each way.")
        else:
            self.assumptions.append(
                f"{roads[0].name} and {roads[1].name} are drawn crossing at right angles, with one lane each way."
            )
        return Setting(
            kind="road",
            description=f"{' and '.join(r.name for r in roads)}{' junction' if junction else ''}.",
            address=self._address(),
            time_of_day=self._time_of_day(),
            drive_side=self.drive_side,
            roads=roads,
            junction=Junction(signals=signals, zebra_crossings=junction and bool(CROSSING_WORDS.search(self.corpus))),
        )

    @staticmethod
    def _direction(m: re.Match) -> str:
        if m.group("from"):
            return OPPOSITE[m.group("from").lower()]
        return (m.group("dir") or m.group("bound")).lower()

    @staticmethod
    def _nearest_road(text: str, pos: int, names: list[str]) -> str | None:
        best, gap = None, 10**9
        for name in names:
            for m in re.finditer(re.escape(name), text):
                distance = m.start() - pos if m.start() >= pos else (pos - m.end()) * 2
                if distance < gap:
                    best, gap = name, distance
        return best

    def _indoor_setting(self) -> Setting:
        rooms: list[Room] = []
        landmarks: list[Landmark] = []
        address = self._address()
        if WAREHOUSE.search(self.corpus):
            name = "Warehouse floor"
            rooms.append(
                Room(
                    ref="r1", name=name, centre=point((0, 0)), width_m=30, depth_m=20, height_m=6, floor="concrete",
                    openings=[Opening(kind="door", wall="south", offset_m=-9, width_m=4, label="Loading shutter"),
                              Opening(kind="door", wall="west", offset_m=5, width_m=1.0, label="Side door")],
                )
            )  # fmt: skip
            # Racking along the north wall and rows of stacked stock, as a warehouse
            # would have; illustrative.
            for east in (-9.5, 0.5):
                landmarks.append(
                    Landmark(kind="furniture", model="shelf", label="Racking (illustrative)", position=point((east, 9.6)),
                             heading_deg=180, width_m=9.6)
                )  # fmt: skip
            for north in (3.5, -2.5):
                for east in (-11, -8.5, -6, -3.5, -1, 1.5, 4, 6.5, 9):
                    landmarks.append(
                        Landmark(kind="furniture", model="pallet-stack", label="Stacked stock (illustrative)",
                                 position=point((east, north)), heading_deg=0)
                    )  # fmt: skip
            self.assumptions.append("The warehouse is drawn as one 30 m by 20 m floor; its size and stock layout are illustrative.")
        else:
            rooms.append(
                Room(ref="r1", name="Living room", centre=point((0, 0)), width_m=5.5, depth_m=4.5, floor="marble",
                     openings=[Opening(kind="door", wall="north", offset_m=-1.6, width_m=1.0, label="Main door")])
            )  # fmt: skip
            landmarks += [
                Landmark(kind="furniture", model="sofa", label="Sofa (illustrative)", position=point((1.2, 1.75)), heading_deg=180),
                Landmark(kind="furniture", model="television", label="Television (illustrative)", position=point((1.3, -2.0)), heading_deg=0),
                Landmark(kind="furniture", model="table", label="Dining table (illustrative)", position=point((-1.1, -0.6)), heading_deg=90),
                Landmark(kind="furniture", model="chair", label="Chair (illustrative)", position=point((-1.1, 0.2)), heading_deg=180),
                Landmark(kind="furniture", model="chair", label="Chair (illustrative)", position=point((-1.1, -1.4)), heading_deg=0),
            ]  # fmt: skip
            residence = bool(RESIDENCE.search(self.corpus))
            wanted = [name for name, pattern in ROOMS if pattern.search(self.corpus)]
            if residence:
                wanted = list(dict.fromkeys(["Bedroom", *wanted, "Kitchen"]))
            slots = [("east", (4.75, 0.25), 4.0, 4.0), ("west", (-4.25, 0.75), 3.0, 3.0), ("west2", (-4.25, -1.5), 3.0, 1.5)]
            for (wall, centre, width, depth), name in zip(slots, wanted[:3], strict=False):
                ref = f"r{len(rooms) + 1}"
                floor = "wood" if name in ("Bedroom", "Office") else "tile"
                rooms.append(Room(ref=ref, name=name, centre=point(centre), width_m=width, depth_m=depth, floor=floor))
                side = "east" if wall == "east" else "west"
                rooms[0].openings.append(
                    Opening(kind="door", wall=side, offset_m=centre[1] - 0.0, width_m=0.85, label=f"{name} door")
                )
                if name == "Bedroom":
                    landmarks += [
                        Landmark(kind="furniture", model="bed", label="Bed (illustrative)", position=point(add(centre, (0, 0.95))), heading_deg=180),
                        Landmark(kind="furniture", model="nightstand", label="Bedside table (illustrative)", position=point(add(centre, (0.85, 1.7))), heading_deg=180),
                        Landmark(kind="furniture", model="cupboard", label="Cupboard (illustrative)", position=point(add(centre, (1.75, -1.0))), heading_deg=270),
                    ]  # fmt: skip
                if name == "Kitchen":
                    landmarks.append(
                        Landmark(kind="furniture", model="cupboard", label="Kitchen cabinet (illustrative)", position=point(add(centre, (-1.25, 0.4))), heading_deg=90)
                    )  # fmt: skip
            if re.search(r"\bbalcony\b", self.corpus, re.I):
                rooms.append(Room(ref=f"r{len(rooms) + 1}", name="Balcony", centre=point((0, -3.05)), width_m=4.5, depth_m=1.6, height_m=2.8, floor="tile"))
                rooms[0].openings.append(Opening(kind="door", wall="south", offset_m=-1.2, width_m=1.4, label="Balcony door"))
                rooms[-1].openings.append(Opening(kind="opening", wall="south", offset_m=0, width_m=4.2, label="Balcony railing"))
            self.assumptions.append("Room sizes and furniture are illustrative; the evidence names the rooms but not their layout.")
        for s in self.sentences:
            if FORCED.search(s.text) and OPENING_WORDS.search(s.text):
                for room in rooms:
                    for opening in room.openings:
                        words = opening.label.lower().split()
                        if words and all(_has(w, s.text) >= 0 for w in words[:1]) and _has(OPENING_WORDS.search(s.text).group(1), opening.label) >= 0:
                            opening.state = "forced"
        return Setting(
            kind="indoor",
            description=rooms[0].name if len(rooms) == 1 else f"{', '.join(r.name for r in rooms)}.",
            address=address,
            time_of_day=self._time_of_day(),
            rooms=rooms,
            landmarks=landmarks,
        )

    # -- entities ---------------------------------------------------------------

    def _vehicles(self, setting: Setting) -> list[Actor]:
        actors: list[Actor] = []
        for obj in self.d.objects:
            if obj.kind != "vehicle":
                continue
            details = obj.details or {}
            text = " ".join(str(v) for v in (obj.label, details.get("make", ""), details.get("model", "")))
            model = next((m for m, words in VEHICLE_TYPES if any(_has(w, text) >= 0 for w in words)), "sedan")
            keywords = [w for m, words in VEHICLE_TYPES if m == model for w in words if _has(w, text) >= 0]
            keywords += GENERIC_KEYWORDS.get(model, [])
            keywords += [w.lower() for w in re.findall(r"[A-Za-z0-9]{3,}", f"{details.get('make', '')} {details.get('model', '')}")]
            if details.get("plate"):
                keywords.append(details["plate"])
            ref = f"v{len(actors) + 1}"
            entity = Entity(
                ref=ref, kind="vehicle", model=model, label=obj.label, object_id=obj.id,
                colour=str(details.get("colour", "")), plate=str(details.get("plate", "")),
            )  # fmt: skip
            actors.append(Actor(entity=entity, keywords=list(dict.fromkeys(keywords)), record=obj))
        # The first sentence naming each vehicle is its source.
        for actor in actors:
            for s in self.sentences:
                if s.evidence_id and self._mentioned(actor, s.text, actors) >= 0:
                    actor.entity.sources = s.source()
                    break
        if setting.kind == "road":
            self._travel(setting, actors)
        return actors

    def _mentioned(self, actor: Actor, text: str, others: list[Actor]) -> int:
        """Where a sentence first names this actor, or -1. A generic word ("car")
        counts only when no other actor matches the sentence more specifically."""
        hits = [(p, w) for w in actor.keywords if (p := _has(w, text)) >= 0]
        if not hits:
            return -1
        score = len(hits)
        for other in others:
            if other is not actor and sum(_has(w, text) >= 0 for w in other.keywords) > score:
                return -1
        return min(p for p, _ in hits)

    def _travel(self, setting: Setting, vehicles: list[Actor]) -> None:
        names = [r.name for r in setting.roads]
        for s in self.sentences:
            for m in DIRECTION.finditer(s.text):
                mentioned = [(p, a) for a in vehicles if (p := self._mentioned(a, s.text, vehicles)) >= 0]
                if not mentioned:
                    continue
                before = [x for x in mentioned if x[0] <= m.start()]
                actor = max(before, key=lambda x: x[0])[1] if before else min(mentioned, key=lambda x: x[0])[1]
                if actor.bearing is not None:
                    continue
                direction = self._direction(m)
                road_name = self._nearest_road(s.text, m.start(), names)
                road = next((r for r in setting.roads if r.name == road_name), None)
                axis = "east-west" if direction in ("east", "west") else "north-south"
                if road is None or road.runs != axis:
                    road = next((r for r in setting.roads if r.runs == axis), setting.roads[0])
                actor.road, actor.bearing = road, CARDINAL[direction]
                if s.evidence_id:
                    actor.entity.sources = s.source()
                self.assumptions.append(f"The {actor.entity.label.lower()} travelled {direction} on {road.name}.")
        # Vehicles with no stated direction: the first free road, eastbound or northbound.
        for i, actor in enumerate(a for a in vehicles if a.bearing is None):
            road = setting.roads[min(i, len(setting.roads) - 1)]
            actor.road, actor.bearing = road, (90.0 if road.runs == "east-west" else 0.0)
            direction = "east" if road.runs == "east-west" else "north"
            self.assumptions.append(f"The evidence doesn't say which way the {actor.entity.label.lower()} travelled; it is drawn heading {direction} on {road.name}.")

    def _people(self, setting: Setting, vehicles: list[Actor]) -> list[Actor]:
        drivers = {r.from_id for r in self.d.relationships if r.from_type == "person" and r.kind == "drove"}
        actors: list[Actor] = []
        for person in self.d.persons:
            text = f"{person.name}. {person.occupation}. {person.notes}"
            if person.id in drivers or re.search(r"\bdriver of\b", text, re.I):
                continue
            cyclist = re.search(r"\b(?:cyclist|bicycle|cycling)\b", text, re.I)
            ref = f"p{len(actors) + 1}"
            entity = Entity(ref=ref, kind="person", model="bicycle" if cyclist else "person", label=person.name, person_id=person.id)
            actor = Actor(entity=entity, record=person)
            corner = CORNER.search(text)
            side = SIDE.search(text)
            if setting.kind == "road" and (corner or side):
                if corner:
                    actor.spot = corner_point(setting.roads, 1 if corner.group(2).lower() == "east" else -1, 1 if corner.group(1).lower() == "north" else -1)
                else:
                    e, n = {"north": (0, 1), "south": (0, -1), "east": (1, 0), "west": (-1, 0)}[side.group(1).lower()]
                    actor.spot = corner_point(setting.roads, e, n)
                for s in self.sentences:
                    if s.evidence_id and _has(person.name.split()[-1], s.text) >= 0:
                        entity.sources = s.source()
                        break
            while actor.spot is not None and any(o.spot == actor.spot for o in actors):
                actor.spot = (actor.spot[0], actor.spot[1] + (1.3 if actor.spot[1] >= 0 else -1.3))
            leaving = re.search(r"\b(?:rode|ran|walked|drove) (?:away|off)\s+(north|south|east|west)", text, re.I)
            if leaving:
                actor.leaves = leaving.group(1).lower()
            actors.append(actor)
        return actors

    def _items(self, setting: Setting) -> list[Actor]:
        actors: list[Actor] = []
        for obj in self.d.objects:
            if obj.kind != "weapon":
                continue
            text = f"{obj.label} {(obj.details or {}).get('make', '')}".lower()
            model = (
                "knife" if re.search(r"knife|blade|dagger", text)
                else "firearm" if re.search(r"gun|pistol|revolver|rifle|firearm", text)
                else "blunt-object"
            )  # fmt: skip
            ref = f"i{len(actors) + 1}"
            actors.append(Actor(entity=Entity(ref=ref, kind="item", model=model, label=obj.label, object_id=obj.id), record=obj))
        return actors

    # -- events -----------------------------------------------------------------

    def _events(self) -> tuple[Event | None, list[Event], list[Event], list[Event]]:
        timed = [e for e in self.d.events if e.time_start is not None]
        key = next((e for e in timed if e.category == "collision"), None)
        if key is None:
            key = next((e for e in timed if STRIKE.search(e.description)), None)
        if key is None:
            return None, [], [], []
        t = key.time_start
        before = [e for e in timed if t - EVENT_WINDOW <= e.time_start < t - IMPACT_WINDOW]
        during = [e for e in timed if t - IMPACT_WINDOW <= e.time_start <= t and e is not key] + [key]
        after = [e for e in timed if t < e.time_start <= t + EVENT_WINDOW]
        return key, before, during, after

    # -- road stages ------------------------------------------------------------

    def _road_stages(self, setting, vehicles, people, key, before, during, after) -> tuple[list[Stage], Vec]:
        moving = [a for a in vehicles if a.bearing is not None]
        pedestrians = [a for a in people if a.spot is None and isinstance(a.record, Person) and a.record.role == "victim"]
        striker, struck = self._collision(key, moving)
        impact = self._impact_positions(setting, striker, struck, pedestrians, moving)
        focus = impact["_point"]
        self.impact = impact
        self.striker_bearing = striker.bearing if striker else None
        stages: list[Stage] = []
        # Approach: each vehicle back along its lane, or at its stop line.
        approach: list[Placement] = []
        for a in moving:
            centre, bearing = impact[a.entity.ref]
            d = unit(bearing)
            waits = any(STOP_LINE_WORDS.search(e.description) and self._mentioned(a, e.description, moving) >= 0 for e in before)
            waits = waits or any(
                STOP_LINE_WORDS.search(s.text) and self._mentioned(a, s.text, moving) >= 0 for s in self.sentences
            )
            if waits and len(setting.roads) > 1:
                length = MODELS[a.entity.model].size[0]
                lane = add(lane_offset(a.road, bearing, setting.drive_side), d, -(STOP_LINE + 0.4 + length / 2))
                approach.append(Placement(ref=a.entity.ref, position=point(lane), heading_deg=bearing, note="Waiting at the stop line."))
            else:
                approach.append(Placement(ref=a.entity.ref, position=point(add(centre, d, -APPROACH_DISTANCE)), heading_deg=bearing))
        for a in pedestrians:
            centre, bearing = impact[a.entity.ref]
            # From the footpath on the side they crossed from.
            d = unit(bearing)
            hw = half_width(a_road) if (a_road := striker.road if striker else None) else 3.5
            if abs(d[1]) > abs(d[0]):
                kerb = (centre[0], -(hw + 1.0) if d[1] > 0 else hw + 1.0)
            else:
                kerb = (-(hw + 1.0) if d[0] > 0 else hw + 1.0, centre[1])
            approach.append(Placement(ref=a.entity.ref, position=point(kerb), heading_deg=bearing_of(*add(centre, kerb, -1)), pose="walking"))
        approach += self._bystanders(people, focus, final=False)
        if moving or before:
            stages.append(Stage(label="Approach", description=self._describe(before) or "The vehicles approach.", event_ids=[e.id for e in before], placements=approach))
        # Impact.
        contact = [Placement(ref=ref, position=point(c), heading_deg=b) for ref, (c, b) in impact.items() if not ref.startswith("_")]
        for p in contact:
            if any(p.ref == a.entity.ref for a in pedestrians):
                p.pose = "walking"
        contact += self._bystanders(people, focus, final=False)
        stages.append(
            Stage(label="Impact" if key else "Scene", description=self._describe(during) or "The collision.", event_ids=[e.id for e in during], placements=contact)
        )  # fmt: skip
        # Rest positions.
        if key:
            rest = [self._rest(setting, a, impact[a.entity.ref], moving) for a in moving]
            for a in pedestrians:
                centre, bearing = impact[a.entity.ref]
                # Carried forward by the vehicle that struck them.
                forward = unit(striker.bearing)
                lying = add(add(centre, forward, 4), unit(bearing), 0.6)
                rest.append(Placement(ref=a.entity.ref, position=point(lying), heading_deg=(striker.bearing + 160) % 360, pose="lying"))
            rest += self._bystanders(people, focus, final=True)
            label = "Rest positions" if any(not LEFT_SCENE.search(p.note) for p in rest if p.ref.startswith("v")) else "Aftermath"
            stages.append(Stage(label=label, description=self._describe(after) or "Where the vehicles and people ended up.", event_ids=[e.id for e in after], placements=rest))
        return stages, focus

    def _collision(self, key: Event | None, moving: list[Actor]) -> tuple[Actor | None, Actor | None]:
        if not moving:
            return None, None
        if len(moving) == 1:
            return moving[0], None
        texts = ([key.description] if key else []) + [s.text for s in self.sentences if STRIKE.search(s.text)]
        for text in texts:
            mentioned = sorted((p, a) for a in moving if (p := self._mentioned(a, text, moving)) >= 0 for _ in [0])
            if len(mentioned) >= 2:
                first, second = mentioned[0][1], mentioned[1][1]
                return (second, first) if PASSIVE_STRIKE.search(text) else (first, second)
        return (moving[1], moving[0]) if key else (moving[0], None)

    def _impact_positions(self, setting, striker, struck, pedestrians, moving) -> dict:
        """Each actor's centre and bearing at the moment of impact, and the contact point."""
        out: dict = {}
        if striker is None:
            out["_point"] = (0.0, 0.0)
            return out
        s_dir = unit(striker.bearing)
        s_len = MODELS[striker.entity.model].size[0]
        s_line = lane_offset(striker.road, striker.bearing, setting.drive_side)
        if struck is not None:
            t_dir = unit(struck.bearing)
            t_len, t_width = MODELS[struck.entity.model].size[:2]
            t_line = lane_offset(struck.road, struck.bearing, setting.drive_side)
            if striker.road is not struck.road:
                # Crossing paths: the striker's front meets the struck vehicle's side.
                contact = (s_line[0] if striker.road.runs == "north-south" else t_line[0],
                           s_line[1] if striker.road.runs == "east-west" else t_line[1])  # fmt: skip
                out[struck.entity.ref] = (add(contact, t_dir, 0.6), struck.bearing)
                out[striker.entity.ref] = (add(contact, s_dir, -(t_width / 2 + s_len / 2)), striker.bearing)
            elif abs(striker.bearing - struck.bearing) % 360 == 180:
                contact = (0.0, 0.0)
                out[striker.entity.ref] = (add(s_line, s_dir, -s_len / 2), striker.bearing)
                out[struck.entity.ref] = (add(t_line, t_dir, -t_len / 2), struck.bearing)
            else:
                contact = s_line
                out[struck.entity.ref] = (add(contact, t_dir, t_len / 2), struck.bearing)
                out[striker.entity.ref] = (add(contact, s_dir, -s_len / 2), striker.bearing)
        else:
            # Origin on a straight road: a single vehicle at the incident spot.
            contact = add(s_line, s_dir, 0)
            if pedestrians:
                out[striker.entity.ref] = (add(contact, s_dir, -(s_len / 2 + 0.3)), striker.bearing)
            else:
                out[striker.entity.ref] = (contact, striker.bearing)
        # Pedestrians cross towards the striker's near side, or from behind a bus at the far kerb.
        crossing = -90 if (self.d.case and ROUTE_BUS.search(self.corpus)) else 90
        for p in pedestrians:
            out[p.entity.ref] = (contact, (striker.bearing + crossing) % 360)
        # Vehicles not in the collision wait back along their own lanes.
        for i, a in enumerate(a for a in moving if a.entity.ref not in out):
            lane = lane_offset(a.road, a.bearing, setting.drive_side)
            out[a.entity.ref] = (add(lane, unit(a.bearing), -(12 + 7 * i)), a.bearing)
        out["_point"] = contact
        return out

    def _about(self, a: Actor, others: list[Actor]) -> list[Sentence]:
        """Sentences that name an actor, and the ones after them that refer back with "It"."""
        out, previous = [], False
        for s in self.sentences:
            named = self._mentioned(a, s.text, others) >= 0
            if named or (previous and PRONOUN.match(s.text)):
                out.append(s)
            previous = named or (previous and bool(PRONOUN.match(s.text)))
        return out

    def _rest(self, setting: Setting, a: Actor, at_impact: tuple[Vec, float], moving: list[Actor]) -> Placement:
        centre, bearing = at_impact
        d = unit(bearing)
        for s in self._about(a, moving):
            if LEFT_SCENE.search(s.text):
                return Placement(ref=a.entity.ref, position=point(add(centre, d, LEAVE_DISTANCE)), heading_deg=bearing, note="Left the scene.")
            if not REST.search(s.text):
                continue
            line = CENTRE_LINE.search(s.text)
            if line:
                road = next((r for r in setting.roads if r.name.lower() in line.group(1).lower()), a.road)
                on_line = (0.0, centre[1] + 0.8) if road.runs == "north-south" else (centre[0] + 0.8, 0.0)
                return Placement(ref=a.entity.ref, position=point(on_line), heading_deg=(bearing + 12) % 360, note=s.text)
            corner = CORNER.search(s.text)
            if corner:
                se = 1 if corner.group(2).lower() == "east" else -1
                sn = 1 if corner.group(1).lower() == "north" else -1
                length, width = MODELS[a.entity.model].size[:2]
                ew = next((r for r in setting.roads if r.runs == "east-west"), None)
                ns = next((r for r in setting.roads if r.runs == "north-south"), None)
                if a.road.runs == "east-west":
                    spot = (se * ((half_width(ns) if ns else 0) + 3.5 + length / 2), sn * ((half_width(ew) if ew else 3.5) - width / 2 - 0.1))
                else:
                    spot = (se * ((half_width(ns) if ns else 3.5) - width / 2 - 0.1), sn * ((half_width(ew) if ew else 0) + 3.5 + length / 2))
                heading = bearing_of(spot[0] - centre[0], spot[1] - centre[1])
                return Placement(ref=a.entity.ref, position=point(spot), heading_deg=round(heading, 1), note=s.text)
        turn = 25 if a is not moving[0] else 10
        return Placement(ref=a.entity.ref, position=point(add(centre, d, 3)), heading_deg=(bearing + turn) % 360, note="Estimated.")

    def _bystanders(self, people: list[Actor], focus: Vec, final: bool) -> list[Placement]:
        out = []
        for a in people:
            if a.spot is None:
                continue
            spot = a.spot
            if final and a.leaves:
                spot = add(spot, unit(CARDINAL[a.leaves]), 18)
            heading = CARDINAL[a.leaves] if final and a.leaves else bearing_of(focus[0] - spot[0], focus[1] - spot[1])
            pose = "walking" if final and a.leaves else "standing"
            out.append(Placement(ref=a.entity.ref, position=point(spot), heading_deg=round(heading, 1), pose=pose))
        return out

    def _road_traces(self, vehicles: list[Actor], focus: Vec) -> list[Trace]:
        traces: list[Trace] = []
        for s in self.sentences:
            m = SKID.search(s.text)
            if not m or re.search(r"\bno skid", s.text, re.I):
                continue
            length = float(m.group(1))
            owner = next((a for a in vehicles if self._mentioned(a, s.text, vehicles) >= 0 and a.bearing is not None), None)
            if owner is None or any(t.kind == "skid_marks" for t in traces):
                continue
            end = self.impact[owner.entity.ref][0] if owner.entity.ref in self.impact else focus
            start = add(end, unit(owner.bearing), -length)
            traces.append(Trace(kind="skid_marks", label=f"{owner.entity.label} skid marks, {length:g} m", position=point(start), end=point(end), sources=s.source()))
        impact_sources = [s for s in self.sentences if s.evidence_id and STRIKE.search(s.text)][:1]
        if vehicles:
            traces.append(Trace(kind="impact_point", label="Point of impact", position=point(focus), sources=impact_sources[0].source() if impact_sources else []))
        for s in self.sentences:
            if s.evidence_id and re.search(r"\b(?:debris|broken glass|glass fragments|shattered)\b", s.text, re.I):
                traces.append(Trace(kind="debris", label="Debris", position=point(add(focus, (1.5, 0.5))), radius_m=2.0, sources=s.source()))
                break
        return traces

    def _road_landmarks(self, setting: Setting, focus: Vec) -> list[Landmark]:
        landmarks: list[Landmark] = []
        for s in self.sentences:
            m = SHOP.search(s.text)
            corner = CORNER.search(s.text)
            if m and corner and not any(lm.kind == "shop" for lm in landmarks):
                se = 1 if corner.group(2).lower() == "east" else -1
                sn = 1 if corner.group(1).lower() == "north" else -1
                spot = corner_point(setting.roads, se, sn, inset=7.5)
                name = m.group(1).lower()
                facing = (0 if sn < 0 else 180) if any(r.runs == "east-west" for r in setting.roads) else (90 if se < 0 else 270)
                landmarks.append(
                    Landmark(kind="shop", label=f"{name[0].upper()}{name[1:]}, {corner.group(0).lower()}", position=point(spot),
                             heading_deg=facing, width_m=9, depth_m=9, floors=1,
                             sign=name.upper(), sources=s.source())
                )  # fmt: skip
        stops = [m for s in self.sentences if (m := BUS_STOP.search(s.text))]
        stop = next((m for m in stops if m.group(1)), stops[0] if stops else None)
        bus = next((s for s in self.sentences if ROUTE_BUS.search(s.text)), None)
        road = setting.roads[0]
        if stop or bus:
            # A bus stopped at the far kerb, facing the other way, with its rear beside
            # the incident spot: someone crossing behind it steps out into the next lane.
            bearing = self.striker_bearing if self.striker_bearing is not None else (90.0 if road.runs == "east-west" else 0.0)
            d = unit(bearing)
            near = left_of(d) if setting.drive_side == "left" else (-left_of(d)[0], -left_of(d)[1])
            far = (-near[0], -near[1])
            hw = half_width(road)
            along = focus[0] if road.runs == "east-west" else focus[1]
            base = (along, 0.0) if road.runs == "east-west" else (0.0, along)
            length = MODELS["bus"].size[0]
            if bus:
                route = ROUTE_BUS.search(bus.text).group(1) or next((m.group(1) for s in self.sentences if (m := re.search(r"route (\d+)", s.text, re.I))), None)
                bus_spot = add(add(base, d, -(1.0 + length / 2)), far, hw - 1.45)
                landmarks.append(
                    Landmark(kind="parked_vehicle", model="bus", label=f"Route {route} bus" if route else "Bus",
                             position=point(bus_spot), heading_deg=(bearing + 180) % 360, sources=bus.source())
                )  # fmt: skip
                self.assumptions.append(
                    "The bus is drawn stopped at the far kerb, facing the other way, with its rear beside where the pedestrian was struck."
                )
            if stop:
                label = f"Bus stop {stop.group(1)}" if stop.group(1) else "Bus stop"
                stop_spot = add(add(base, d, -(1.0 + length * 0.75)), far, hw + 1.3)
                landmarks.append(Landmark(kind="bus_stop", label=label, position=point(stop_spot), heading_deg=bearing_of(*near)))
        return landmarks

    # -- other settings ---------------------------------------------------------

    def _place_stages(self, setting, actors, key, before, during, after) -> tuple[list[Stage], Vec]:
        main = setting.rooms[0] if setting.rooms else None
        focus = (main.centre.east, main.centre.north) if main else (0.0, 0.0)
        placements = []
        for i, a in enumerate(actors):
            spot = add(focus, (1.2 * (i % 3) - 1.2, -0.8 * (i // 3)))
            pose = "standing"
            if isinstance(a.record, Person) and a.record.condition == "deceased":
                pose = "lying"
            placements.append(Placement(ref=a.entity.ref, position=point(spot), heading_deg=0, pose=pose))
        if actors:
            self.assumptions.append("People and items are placed in the main room because the evidence gives no positions.")
        if key is None:
            return [Stage(label="Scene as found", description=self._found(), placements=placements)], focus
        stages = []
        if before:
            stages.append(Stage(label="Before", description=self._describe(before), event_ids=[e.id for e in before], placements=placements))
        stages.append(Stage(label="Incident", description=self._describe(during), event_ids=[e.id for e in during], placements=placements))
        if after:
            stages.append(Stage(label="After", description=self._describe(after), event_ids=[e.id for e in after], placements=placements))
        return stages, focus

    def _found(self) -> str:
        summaries = [e.summary for e in self.d.evidence if e.summary]
        return summaries[0] if summaries else "The scene as the evidence describes it."

    def _indoor_traces(self, setting: Setting) -> list[Trace]:
        traces: list[Trace] = []
        for room in setting.rooms:
            for opening in room.openings:
                if opening.state != "forced":
                    continue
                spot = _opening_point(room, opening)
                source = next((s for s in self.sentences if s.evidence_id and FORCED.search(s.text) and OPENING_WORDS.search(s.text)), None)
                traces.append(Trace(kind="forced_entry", label=f"{opening.label} forced", position=point(spot), sources=source.source() if source else []))
        for s in self.sentences:
            m = FIRE_ORIGIN.search(s.text)
            if not m or any(t.kind == "fire_origin" for t in traces):
                continue
            what = m.group(1).strip()
            model = "electrical-panel" if re.search(r"panel|board|meter|switch|wiring", what) else "machine" if re.search(r"machine|generator|motor", what) else "pallet-stack"
            room = setting.rooms[0]
            spot = (room.centre.east + room.width_m * 0.15, room.centre.north + room.depth_m / 2 - 0.35)
            setting.landmarks.append(Landmark(kind="furniture", model=model, label=what[0].upper() + what[1:], position=point(spot), heading_deg=180, sources=s.source()))
            # Clear stock away from the origin so the burn area reads.
            setting.landmarks = [lm for lm in setting.landmarks if lm.model == model or abs(lm.position.east - spot[0]) + abs(lm.position.north - spot[1]) > 6]
            front = add(spot, (0, -0.8))
            traces.append(Trace(kind="fire_origin", label=f"Fire origin: {what}", position=point(front), sources=s.source()))
            traces.append(Trace(kind="burn_area", label="Burn area (extent illustrative)", position=point(front), radius_m=6, sources=s.source()))
        for s in self.sentences:
            if s.evidence_id and re.search(r"\bblood\b", s.text, re.I) and setting.rooms:
                c = setting.rooms[0].centre
                traces.append(Trace(kind="blood", label="Blood", position=point((c.east, c.north)), radius_m=0.6, sources=s.source()))
                break
        return traces

    # -- text -------------------------------------------------------------------

    @staticmethod
    def _describe(events: list[Event]) -> str:
        return " ".join(e.description.rstrip(".") + "." for e in events[:4])


def _opening_point(room: Room, opening: Opening) -> Vec:
    c = (room.centre.east, room.centre.north)
    if opening.wall in ("north", "south"):
        n = c[1] + (room.depth_m / 2 if opening.wall == "north" else -room.depth_m / 2)
        return c[0] + opening.offset_m, n
    e = c[0] + (room.width_m / 2 if opening.wall == "east" else -room.width_m / 2)
    return e, c[1] + opening.offset_m

