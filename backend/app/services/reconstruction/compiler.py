"""Turns a scene script into reconstructions: first checks it against the case, then
saves one reconstruction per scenario with its stages, scene objects, annotations
and evidence links, and the generated layout as its scene.

The checks never trust the planner. Evidence, records and events must belong to
the case, models must be in the catalogue, and positions must lie inside the
scene. What fails is dropped or replaced, and each change becomes a warning the
investigator sees.
"""

import copy
import math
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.records import record_audit
from app.models import (
    EvidenceChunk,
    EvidenceLink,
    Reconstruction,
    ReconstructionStage,
    SceneAnnotation,
    SceneObject,
)
from app.services.ai.passages import ChunkFinder
from app.services.reconstruction.catalogue import MODELS, default_model
from app.services.reconstruction.dossier import Dossier
from app.services.reconstruction.layout import LayoutBuilder, evidence_refs, heading, xz
from app.services.reconstruction.script import SCRIPT_VERSION, Point, Road, Room, SceneScript, Source

LIMIT_M = 150.0
MAX_SCENARIOS = 3
MAX_STAGES = 6
PERSON_MODELS = {"person", "bicycle", "motorcycle"}
TWO_WHEELERS = {"bicycle", "motorcycle"}
ITEM_KINDS = {"item", "furniture", "fixture"}


def check_script(d: Dossier, script: SceneScript) -> list[str]:
    """Fixes the script in place so everything in it refers to this case and fits the
    scene. Returns a warning for each change. Raises ValueError if no scenario is left."""
    return _Checker(d, script).run()


class _Checker:
    def __init__(self, d: Dossier, script: SceneScript):
        self.d = d
        self.s = script
        self.warnings: list[str] = []
        self.evidence = {e.id for e in d.evidence}
        self.objects = {o.id for o in d.objects}
        self.persons = {p.id for p in d.persons}
        self.events = {e.id for e in d.events}
        self.bad_evidence: set[int] = set()

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def run(self) -> list[str]:
        s = self.s
        self._setting()
        refs: set[str] = set()
        entities = []
        for e in s.entities:
            if e.ref in refs:
                self.warn(f"Dropped a second entity with ref {e.ref}.")
                continue
            refs.add(e.ref)
            self._entity(e)
            entities.append(e)
        s.entities = entities
        for t in s.traces:
            t.radius_m = _clamp(t.radius_m, 0, 30)
            t.sources = self._sources(t.sources)
            self._clamp(t.position, t.label)
            if t.end is not None:
                self._clamp(t.end, t.label)
        for lm in s.setting.landmarks:
            lm.sources = self._sources(lm.sources)
            self._clamp(lm.position, lm.label)
            if lm.kind in ("furniture", "parked_vehicle") and lm.model not in MODELS:
                replacement = "bus" if lm.kind == "parked_vehicle" else "table"
                self.warn(f'"{lm.label}" used an unknown model "{lm.model}"; drawn as {MODELS[replacement].name.lower()}.')
                lm.model = replacement
        for v in s.viewpoints:
            v.eye_height_m = _clamp(v.eye_height_m, 0.3, 40)
            if v.person_id is not None and v.person_id not in self.persons:
                v.person_id = None
            self._clamp(v.position, v.label)
            self._clamp(v.looks_at, v.label)
        if len(s.scenarios) > MAX_SCENARIOS:
            self.warn(f"Kept the first {MAX_SCENARIOS} of {len(s.scenarios)} scenarios.")
            s.scenarios = s.scenarios[:MAX_SCENARIOS]
        scenarios = []
        for sc in s.scenarios:
            sc.supported_by = self._sources(sc.supported_by)
            if len(sc.stages) > MAX_STAGES:
                self.warn(f'Kept the first {MAX_STAGES} stages of "{sc.title}".')
                sc.stages = sc.stages[:MAX_STAGES]
            for st in sc.stages:
                unknown = [i for i in st.event_ids if i not in self.events]
                if unknown:
                    self.warn(f'Stage "{st.label}" named events not in this case ({", ".join(map(str, unknown))}); they were dropped.')
                st.event_ids = [i for i in dict.fromkeys(st.event_ids) if i in self.events]
                placed: set[str] = set()
                placements = []
                for p in st.placements:
                    if p.ref not in refs:
                        self.warn(f'Stage "{st.label}" placed "{p.ref}", which isn\'t an entity; it was dropped.')
                        continue
                    if p.ref in placed:
                        continue
                    placed.add(p.ref)
                    self._clamp(p.position, p.ref)
                    p.heading_deg = p.heading_deg % 360
                    placements.append(p)
                st.placements = placements
            if sc.stages:
                scenarios.append(sc)
            else:
                self.warn(f'Scenario "{sc.title}" had no stages and was left out.')
        s.scenarios = scenarios
        if not scenarios:
            raise ValueError("The scene script has no scenario with stages.")
        if self.bad_evidence:
            ids = ", ".join(map(str, sorted(self.bad_evidence)))
            self.warn(f"Citations of evidence not in this case were dropped ({ids}).")
        return self.warnings

    def _setting(self) -> None:
        st = self.s.setting
        if st.kind == "road":
            if not st.roads:
                self.warn("The script described a road scene without roads; one road was drawn.")
                st.roads = [Road(name="Road", runs="east-west", arms=["east", "west"])]
            if len(st.roads) > 2:
                self.warn(f"Kept the first two of {len(st.roads)} roads.")
                st.roads = st.roads[:2]
            if len(st.roads) == 2 and st.roads[0].runs == st.roads[1].runs:
                other = "north-south" if st.roads[0].runs == "east-west" else "east-west"
                self.warn(f"{st.roads[1].name} was turned to run {other}, at right angles to {st.roads[0].name}.")
                st.roads[1].runs = other
            for road in st.roads:
                road.lanes_each_way = int(_clamp(road.lanes_each_way, 1, 3))
                road.lane_width_m = _clamp(road.lane_width_m, 2.5, 4.5)
                allowed = ("east", "west") if road.runs == "east-west" else ("north", "south")
                arms = [a for a in dict.fromkeys(road.arms) if a in allowed]
                if len(st.roads) == 1 or not arms:
                    arms = list(allowed)
                road.arms = arms
        if st.kind == "indoor" and not st.rooms:
            self.warn("The script described an indoor scene without rooms; one 8 m by 6 m room was drawn.")
            st.rooms = [Room(ref="r1", name="Room", centre=Point(east=0, north=0), width_m=8, depth_m=6)]
        for room in st.rooms:
            self._clamp(room.centre, room.name)
            room.width_m = _clamp(room.width_m, 1, 80)
            room.depth_m = _clamp(room.depth_m, 1, 80)
            room.height_m = _clamp(room.height_m, 2, 12)
            for opening in room.openings:
                opening.width_m = _clamp(opening.width_m, 0.3, 6)
        for lm in st.landmarks:
            lm.floors = int(_clamp(lm.floors, 0, 30))
            lm.width_m = _clamp(lm.width_m, 0, 120)
            lm.depth_m = _clamp(lm.depth_m, 0, 120)

    def _entity(self, e) -> None:
        e.sources = self._sources(e.sources)
        spec = MODELS.get(e.model)
        fits = spec is not None and (
            (e.kind == "vehicle" and spec.kind == "vehicle")
            or (e.kind == "person" and e.model in PERSON_MODELS)
            or (e.kind == "item" and spec.kind in ITEM_KINDS)
        )
        if not fits:
            replacement = default_model(e.kind)
            self.warn(f'"{e.label}" used the model "{e.model}", which doesn\'t fit a {e.kind}; drawn as {MODELS[replacement].name.lower()}.')
            e.model = replacement
        if e.object_id is not None and e.object_id not in self.objects:
            self.warn(f'"{e.label}" pointed at object {e.object_id}, which isn\'t in this case; the link was dropped.')
            e.object_id = None
        if e.person_id is not None and e.person_id not in self.persons:
            self.warn(f'"{e.label}" pointed at person {e.person_id}, who isn\'t in this case; the link was dropped.')
            e.person_id = None

    def _sources(self, sources: list[Source]) -> list[Source]:
        kept = []
        for src in sources:
            if src.evidence_id in self.evidence:
                kept.append(src)
            else:
                self.bad_evidence.add(src.evidence_id)
        return kept

    def _clamp(self, p: Point, what: str) -> None:
        if not (math.isfinite(p.east) and math.isfinite(p.north)):
            p.east = p.north = 0.0
            self.warn(f'"{what}" had no usable position; it was put at the origin.')
            return
        if abs(p.east) > LIMIT_M or abs(p.north) > LIMIT_M:
            p.east = max(-LIMIT_M, min(LIMIT_M, p.east))
            p.north = max(-LIMIT_M, min(LIMIT_M, p.north))
            self.warn(f'"{what}" was placed more than {LIMIT_M:g} m from the origin and was moved to the edge of the scene.')


def _clamp(value: float, low: float, high: float) -> float:
    return low if not math.isfinite(value) else max(low, min(high, value))


# ---------------------------------------------------------------------------
# Saving
# ---------------------------------------------------------------------------


def save_script(
    db: Session,
    d: Dossier,
    script: SceneScript,
    *,
    generator: str,
    model: str,
    warnings: list[str],
    actor_id: int | None,
) -> list[Reconstruction]:
    """Adds one reconstruction per scenario; the caller commits."""
    case = d.case
    entities = {e.ref: e for e in script.entities}
    # Everything placed, so the dressing keeps clear of it and the camera frames it.
    placed = [xz(p.position) for sc in script.scenarios for st in sc.stages for p in st.placements]
    traced = [xz(t.position) for t in script.traces]
    behind = _behind(script)
    impact = next((t for t in script.traces if t.kind == "impact_point"), None)
    focus = xz(impact.position) if impact else _centroid(placed + traced)
    base = LayoutBuilder(script, seed=case.id).build(keep_clear=placed + traced, behind=behind, focus=focus)
    base.update(
        focus=list(focus),
        appearance={
            e.label: {k: v for k, v in (("colour", e.colour), ("plate", e.plate)) if v}
            for e in script.entities
            if e.colour or e.plate
        },
        generated={
            "by": generator,
            "model": model,
            "at": datetime.now(UTC).isoformat(timespec="seconds"),
            "script_version": SCRIPT_VERSION,
            "summary": script.summary,
            "open_questions": script.open_questions,
            "warnings": warnings,
        },
    )
    chunks = _chunk_finders(db, script)
    out = []
    for sc in script.scenarios:
        layout = copy.deepcopy(base)
        layout.update(
            id=f"generated/case-{case.id}",
            title=script.title,
            scenario={"title": sc.title, "assumptions": sc.assumptions, "supported_by": evidence_refs(sc.supported_by)},
            stages=[
                {"stage_order": i + 1, "label": st.label, "time": st.time, "description": st.description}
                for i, st in enumerate(sc.stages)
            ],
        )
        title = sc.title.strip()[:300] or "Generated scenario"
        version = 1 + (
            db.scalar(
                select(func.count()).select_from(Reconstruction).where(
                    Reconstruction.case_id == case.id, Reconstruction.scenario == title
                )
            )
            or 0
        )
        reconstruction = Reconstruction(
            case_id=case.id,
            scenario=title,
            version=version,
            assumptions=" ".join(a.strip() for a in sc.assumptions if a.strip()),
            scene_file=None,
            scene=layout,
            origin="ai",
        )
        db.add(reconstruction)
        db.flush()
        for order, st in enumerate(sc.stages, start=1):
            stage = ReconstructionStage(
                reconstruction_id=reconstruction.id,
                stage_order=order,
                label=st.label.strip()[:200] or f"Stage {order}",
                event_ids=st.event_ids,
            )
            db.add(stage)
            db.flush()
            for p in st.placements:
                e = entities[p.ref]
                if e.kind == "person" and p.pose == "driving":
                    continue
                model_id = e.model
                if e.model == "person" and p.pose != "standing":
                    model_id = f"person:{p.pose}"
                elif e.model in TWO_WHEELERS:
                    # Ridden unless parked, or down on its side with its rider.
                    if p.pose == "lying":
                        model_id = f"{e.model}:fallen"
                    elif "parked" not in p.note.lower():
                        model_id = f"{e.model}:ridden"
                x, z = xz(p.position)
                obj = SceneObject(
                    stage_id=stage.id,
                    model_id=model_id,
                    object_id=e.object_id,
                    label=e.label[:200],
                    position=[x, 0.0, z],
                    rotation=[0.0, heading(p.heading_deg), 0.0],
                    scale=[1.0, 1.0, 1.0],
                )
                db.add(obj)
                db.flush()
                for src in e.sources:
                    chunk = chunks.get(src.evidence_id)
                    found = chunk.find(src.passage) if chunk and src.passage else None
                    db.add(
                        EvidenceLink(
                            evidence_id=src.evidence_id,
                            chunk_id=found.id if found else None,
                            target_type="scene_object",
                            target_id=obj.id,
                            passage=src.passage or None,
                        )
                    )
        for v in script.viewpoints:
            px, pz = xz(v.position)
            tx, tz = xz(v.looks_at)
            db.add(
                SceneAnnotation(
                    reconstruction_id=reconstruction.id,
                    stage_id=None,
                    kind="viewpoint",
                    data={"label": v.label, "position": [px, round(v.eye_height_m, 2), pz], "target": [tx, 0.8, tz]},
                )
            )
        for t in script.traces:
            if t.kind == "skid_marks" and t.end is not None:
                fx, fz = xz(t.position)
                ex, ez = xz(t.end)
                db.add(
                    SceneAnnotation(
                        reconstruction_id=reconstruction.id,
                        stage_id=None,
                        kind="measurement",
                        # The trace itself carries the name; the measurement shows the length.
                        data={
                            "label": "",
                            "from": [fx, 0, fz],
                            "to": [ex, 0, ez],
                            "length_m": round(math.hypot(ex - fx, ez - fz), 2),
                        },
                    )
                )
        db.flush()
        record_audit(
            db,
            actor_id,
            "modified",
            "reconstruction",
            reconstruction.id,
            case_id=case.id,
            detail={"created": True, "generated_by": generator},
        )
        out.append(reconstruction)
    return out


def _chunk_finders(db: Session, script: SceneScript) -> dict[int, ChunkFinder]:
    ids = {s.evidence_id for e in script.entities for s in e.sources}
    if not ids:
        return {}
    chunks = db.scalars(select(EvidenceChunk).where(EvidenceChunk.evidence_id.in_(ids)).order_by(EvidenceChunk.ordinal))
    grouped: dict[int, list[EvidenceChunk]] = {}
    for chunk in chunks:
        grouped.setdefault(chunk.evidence_id, []).append(chunk)
    return {evidence_id: ChunkFinder(rows) for evidence_id, rows in grouped.items()}


def _behind(script: SceneScript) -> tuple[float, float] | None:
    """The direction (x, z) back along the first vehicle's approach, for the camera."""
    vehicle = next((e for e in script.entities if e.kind == "vehicle"), None)
    if vehicle is None or not script.scenarios:
        return None
    for st in script.scenarios[0].stages:
        p = next((p for p in st.placements if p.ref == vehicle.ref), None)
        if p is not None:
            b = math.radians(p.heading_deg)
            return -math.sin(b), math.cos(b)
    return None


def _centroid(points: list[tuple[float, float]]) -> tuple[float, float]:
    if not points:
        return 0.0, 0.0
    return (
        round(sum(p[0] for p in points) / len(points), 2),
        round(sum(p[1] for p in points) / len(points), 2),
    )
