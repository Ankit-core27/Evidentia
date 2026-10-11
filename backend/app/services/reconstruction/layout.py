"""The scene layout the 3D viewer renders, built from a checked scene script: the
roads or rooms, the landmarks and traces, illustrative street dressing around them
and the opening camera.

It has the same shape as the authored files in assets/3d/crime-scenes/scenes/ (see
the README there), so the viewer reads both. Coordinates are the viewer's: metres,
x east, y up, z south, headings in radians with 0 facing east and pi/2 north.
"""

import math
import random

from app.services.reconstruction.catalogue import MODELS
from app.services.reconstruction.geometry import half_width
from app.services.reconstruction.script import Landmark, Point, Room, SceneScript, Source, Trace

KERB = 0.15
CORNER_RADIUS = 3.0
ARM_LENGTH = 60.0
STRAIGHT_LENGTH = 80.0
# Clear space kept around evidence when placing the illustrative dressing.
CLEARANCE = 2.5
BUILDING_COLOURS = [
    "#e8d9a8", "#c9c6bd", "#e6b996", "#c8d8b8", "#efe4cc", "#b9c6cf", "#e3a98f", "#ece9e2",
    "#ecc6a4", "#eedc8f", "#b8c9b4", "#d6d2c8", "#efe0c2", "#b7cad9", "#e9c9cc",
]  # fmt: skip


def heading(bearing: float) -> float:
    """Compass bearing in degrees to the viewer's heading in radians."""
    h = math.radians(90 - bearing)
    return round(math.atan2(math.sin(h), math.cos(h)), 4)


def xz(p: Point) -> tuple[float, float]:
    return round(p.east, 3), round(-p.north, 3)


def evidence_refs(sources: list[Source]) -> list[dict]:
    return [{"evidence_id": s.evidence_id, "passage": s.passage or None} for s in sources]


class LayoutBuilder:
    def __init__(self, script: SceneScript, seed: int):
        self.script = script
        self.setting = script.setting
        self.rnd = random.Random(seed)
        self.static: list[dict] = []
        # Footprints (x0, z0, x1, z1) and points the dressing must keep clear of.
        self.blocked: list[tuple[float, float, float, float]] = []
        self.points: list[tuple[float, float]] = []
        self.sight = ((0.0, 0.0), (0.0, 0.0))

    # -- whole layout ----------------------------------------------------------

    def build(
        self,
        keep_clear: list[tuple[float, float]],
        behind: tuple[float, float] | None = None,
        focus: tuple[float, float] | None = None,
    ) -> dict:
        s = self.setting
        layout: dict = {
            "units": "m",
            "axes": "x east, y up, z south; headings in radians, 0 facing east, pi/2 facing north",
            "setting": {
                "kind": s.kind,
                "description": s.description,
                "address": s.address,
                "time_of_day": s.time_of_day,
                "drive_side": s.drive_side,
            },
            "roads": [],
            "rooms": [],
            "static": self.static,
        }
        self.points += keep_clear
        if s.kind == "road":
            layout["roads"] = self._roads()
            layout["junction"] = self._junction(layout["roads"])
            layout["ground"] = {"kind": "earth"}
        elif s.kind == "indoor":
            layout["rooms"] = [self._room(r) for r in s.rooms]
            # A concrete yard round industrial floors, a garden round homes.
            layout["ground"] = {"kind": "concrete" if any(r.floor == "concrete" for r in s.rooms) else "grass"}
            for r in layout["rooms"]:
                self.blocked.append((r["x"] - r["width"] / 2, r["z"] - r["depth"] / 2, r["x"] + r["width"] / 2, r["z"] + r["depth"] / 2))
        else:
            layout["ground"] = {"kind": "grass"}
        self.layout = layout
        for lm in s.landmarks:
            self._landmark(lm)
        for t in self.script.traces:
            self._trace(t)
        # The opening view, worked out first so the dressing can keep its sight line clear.
        layout["camera"] = camera(layout, keep_clear, behind, focus)
        self.sight = (
            (layout["camera"]["position"][0], layout["camera"]["position"][2]),
            (layout["camera"]["target"][0], layout["camera"]["target"][2]),
        )
        if s.kind == "road":
            self._dress_roads(layout)
        elif s.kind == "outdoor":
            self._dress_open()
        layout["models"] = self._models()
        return layout

    def _models(self) -> dict:
        used = {e.model for e in self.script.entities} | {
            item["model"] for item in self.static if item["kind"] == "model"
        }
        return {m: MODELS[m].layout_entry() for m in sorted(used) if m in MODELS}

    # -- roads -----------------------------------------------------------------

    def _roads(self) -> list[dict]:
        roads = self.setting.roads
        ew = next((r for r in roads if r.runs == "east-west"), None)
        ns = next((r for r in roads if r.runs == "north-south"), None)
        out = []
        length = ARM_LENGTH if len(roads) > 1 else STRAIGHT_LENGTH
        for r in roads:
            if r.runs == "east-west":
                start = -length if "west" in r.arms else 0.0
                end = length if "east" in r.arms else 0.0
                axis = "x"
            else:
                # z points south: the north arm is at negative z.
                start = -length if "north" in r.arms else 0.0
                end = length if "south" in r.arms else 0.0
                axis = "z"
            out.append(
                {"name": r.name, "axis": axis, "from": start, "to": end,
                 "lanes_each_way": r.lanes_each_way, "lane_width": r.lane_width_m}
            )  # fmt: skip
        self.hw = {"x": half_width(ew) if ew else 0.0, "z": half_width(ns) if ns else 0.0}
        return out

    def _junction(self, roads: list[dict]) -> dict:
        junction: dict = {"kerb_height": KERB, "corner_radius": CORNER_RADIUS}
        if len(roads) > 1:
            widest = max(self.hw.values())
            junction["stop_line"] = round(widest + 4.5, 2)
            junction["signals"] = self.setting.junction.signals
            if self.setting.junction.zebra_crossings:
                junction["crossing"] = [round(widest + 0.9, 2), round(widest + 3.9, 2)]
        return junction

    def arms(self) -> list[tuple[str, tuple[int, int], float]]:
        """Each road arm: its road axis, outward direction (x, z) and length."""
        out = []
        for road in self.layout["roads"]:
            for sign, end in ((-1, road["from"]), (1, road["to"])):
                if abs(end) < 1:
                    continue
                d = (sign, 0) if road["axis"] == "x" else (0, sign)
                out.append((road["axis"], d, abs(end)))
        return out

    def surface_y(self, x: float, z: float) -> float:
        """Carriageway at 0, footpaths at kerb height, as the viewer's groundHeight."""
        if self.setting.kind != "road":
            return 0.0
        for road in self.layout["roads"]:
            half = road["lanes_each_way"] * road["lane_width"]
            along, across = (x, z) if road["axis"] == "x" else (z, x)
            if road["from"] - 0.01 <= along <= road["to"] + 0.01 and abs(across) <= half:
                return 0.0
        return KERB

    # -- landmarks and traces --------------------------------------------------

    def _pos(self, p: Point) -> list[float]:
        x, z = xz(p)
        return [x, self.surface_y(x, z), z]

    def _landmark(self, lm: Landmark) -> None:
        x, z = xz(lm.position)
        h = heading(lm.heading_deg)
        base = {"label": lm.label, "evidence": evidence_refs(lm.sources)} if lm.sources else {"label": lm.label}
        if lm.kind in ("building", "shop"):
            floors = lm.floors or (1 if lm.kind == "shop" else 3)
            width, depth = lm.width_m or 10.0, lm.depth_m or 10.0
            # Buildings are axis-aligned; the frontage runs across the heading.
            facing_x = abs(math.cos(h)) > abs(math.sin(h))
            sx, sz = (depth, width) if facing_x else (width, depth)
            self.static.append(
                {"kind": "building", "position": [x, KERB if self.setting.kind == "road" else 0.0, z],
                 "size": [sx, round(floors * 3.2 + 0.4, 2), sz], "heading": h, "floors": floors,
                 "colour": self.rnd.choice(BUILDING_COLOURS), **({"sign": lm.sign} if lm.sign else {}), **base}
            )  # fmt: skip
            self.blocked.append((x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2))
        elif lm.kind == "bus_stop":
            self.static.append({"kind": "bus-stop", "position": self._pos(lm.position), "heading": h, **base})
            self.blocked.append((x - 2.5, z - 2.5, x + 2.5, z + 2.5))
        elif lm.kind in ("tree", "streetlight", "signal"):
            item = {"kind": lm.kind, "position": self._pos(lm.position), "heading": h, **base}
            self.static.append(item)
            self.points.append((x, z))
        elif lm.kind == "wall":
            length = lm.width_m or 4.0
            tx, tz = -math.sin(h), -math.cos(h)
            self.static.append(
                {"kind": "wall", "from": [x - tx * length / 2, 0, z - tz * length / 2],
                 "to": [x + tx * length / 2, 0, z + tz * length / 2], "height": 2.0, **base}
            )  # fmt: skip
        else:
            model = lm.model if lm.model in MODELS else ("bus" if lm.kind == "parked_vehicle" else "table")
            item = {
                "kind": "model", "model": model, "position": self._pos(lm.position),
                "rotation": [0, h, 0], **base,
            }  # fmt: skip
            if "illustrative" in lm.label.lower():
                item["illustrative"] = True
            if lm.width_m and MODELS[model].fill:
                # A run of shelving or a wider stack: the width across the heading.
                spec = MODELS[model].size
                item["size"] = [spec[0], lm.width_m, spec[2]]
            self.static.append(item)
            length, width = item.get("size", MODELS[model].size)[:2]
            r = max(length, width) / 2
            self.blocked.append((x - r, z - r, x + r, z + r))

    def _trace(self, t: Trace) -> None:
        x, z = xz(t.position)
        base = {"label": t.label, "evidence": evidence_refs(t.sources)}
        if t.kind == "skid_marks" and t.end is not None:
            ex, ez = xz(t.end)
            self.static.append({"kind": "skid-marks", "from": [x, 0, z], "to": [ex, 0, ez], "track": 1.5, **base})
            self.points += [(x, z), (ex, ez)]
            return
        item = {"kind": "trace", "trace": t.kind, "position": [x, self.surface_y(x, z), z], **base}
        if t.end is not None:
            ex, ez = xz(t.end)
            item["to"] = [ex, self.surface_y(ex, ez), ez]
        if t.radius_m:
            item["radius"] = t.radius_m
        self.static.append(item)
        self.points.append((x, z))

    # -- rooms -----------------------------------------------------------------

    def _room(self, r: Room) -> dict:
        x, z = xz(r.centre)
        openings = []
        for o in r.openings:
            along = o.offset_m if o.wall in ("north", "south") else -o.offset_m
            span = r.width_m if o.wall in ("north", "south") else r.depth_m
            width = min(o.width_m, span - 0.2)
            along = max(-span / 2 + width / 2 + 0.05, min(span / 2 - width / 2 - 0.05, along))
            if o.kind == "door":
                height, sill = 2.1, 0.0
            elif o.kind == "window":
                height, sill = 1.2, 0.9
            else:
                height, sill = r.height_m - 1.0, 1.0
            openings.append(
                {"kind": o.kind, "wall": o.wall, "offset": round(along, 3), "width": width, "height": height,
                 "sill": sill, "state": o.state, "label": o.label}
            )  # fmt: skip
        return {
            "id": r.ref, "name": r.name, "x": x, "z": z, "width": r.width_m, "depth": r.depth_m,
            "height": r.height_m, "floor": r.floor, "openings": openings,
        }  # fmt: skip

    # -- dressing --------------------------------------------------------------

    def _clear(self, x0: float, z0: float, x1: float, z1: float, margin: float = 0.5) -> bool:
        for bx0, bz0, bx1, bz1 in self.blocked:
            if x0 < bx1 + margin and x1 > bx0 - margin and z0 < bz1 + margin and z1 > bz0 - margin:
                return False
        for px, pz in self.points:
            if x0 - CLEARANCE < px < x1 + CLEARANCE and z0 - CLEARANCE < pz < z1 + CLEARANCE:
                return False
        return True

    def _in_sight(self, x: float, z: float, width: float) -> bool:
        """Whether a point lies within `width` of the line from the camera to its target."""
        (ax, az), (bx, bz) = self.sight
        dx, dz = bx - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / max(dx * dx + dz * dz, 1e-9)))
        return math.hypot(x - (ax + dx * t), z - (az + dz * t)) < width

    def _on_road(self, x: float, z: float, margin: float) -> bool:
        for road in self.layout["roads"]:
            half = road["lanes_each_way"] * road["lane_width"] + margin
            along, across = (x, z) if road["axis"] == "x" else (z, x)
            if road["from"] - margin <= along <= road["to"] + margin and abs(across) <= half:
                return True
        return False

    def _dress_roads(self, layout: dict) -> None:
        """Signals, street lights, trees and buildings along the roads. They give the
        scene its scale and sight lines, but they are illustrative and marked so."""
        junction = len(layout["roads"]) > 1
        left = self.setting.drive_side == "left"
        stop = layout["junction"].get("stop_line", 0.0)
        if junction and layout["junction"].get("signals"):
            for axis, (dx, dz), _ in self.arms():
                hw = self.hw[axis]
                # Traffic on this arm travels towards the centre: (-dx, -dz). Its signal
                # stands on the kerb on the side traffic keeps to.
                tx, tz = -dx, -dz
                side = (tz, -tx) if left else (-tz, tx)
                x = dx * (stop + 0.4) + side[0] * (hw + 0.5)
                z = dz * (stop + 0.4) + side[1] * (hw + 0.5)
                name = {(1, 0): "westbound", (-1, 0): "eastbound", (0, 1): "northbound", (0, -1): "southbound"}[(dx, dz)]
                road = next(r["name"] for r in layout["roads"] if r["axis"] == axis)
                self.static.append(
                    {"kind": "signal", "position": [round(x, 2), KERB, round(z, 2)], "heading": round(math.atan2(-dz, dx), 4),
                     "label": f"Signal, {road} {name}"}
                )  # fmt: skip
                self.points.append((x, z))
        lights: list[tuple[float, float]] = []
        for axis, (dx, dz), length in self.arms():
            hw = self.hw[axis]
            other = self.hw["z" if axis == "x" else "x"]
            start = (other + 8.0) if junction else 4.0
            for i, along in enumerate(_frange(start, length - 4, 22.0)):
                side = 1 if i % 2 == 0 else -1
                across = side * (hw + 0.7)
                x, z = (dx * along, across) if axis == "x" else (across, dz * along)
                if not self._clear(x - 0.3, z - 0.3, x + 0.3, z + 0.3, margin=0):
                    continue
                to_road = (0, -side) if axis == "x" else (-side, 0)
                self.static.append(
                    {"kind": "streetlight", "position": [round(x, 2), KERB, round(z, 2)],
                     "heading": round(math.atan2(-to_road[1], to_road[0]), 4), "illustrative": True}
                )  # fmt: skip
                lights.append((x, z))
        if junction:
            for sx in (-1, 1):
                for sz in (-1, 1):
                    x, z = sx * (self.hw["z"] + 2.7), sz * (self.hw["x"] + 2.7)
                    if self._clear(x - 0.3, z - 0.3, x + 0.3, z + 0.3, margin=0) and not self._on_road(x, z, 0.5):
                        self.static.append(
                            {"kind": "streetlight", "position": [x, KERB, z], "heading": round(math.atan2(sz, -sx), 4), "illustrative": True}
                        )  # fmt: skip
                        lights.append((x, z))
        self.points += lights
        # Trees in the footpath, with gaps.
        for axis, (dx, dz), length in self.arms():
            hw = self.hw[axis]
            other = self.hw["z" if axis == "x" else "x"]
            along = (other + 9.0) if junction else 3.0
            while along < length - 3:
                if self.rnd.random() > 0.3:
                    side = self.rnd.choice((-1, 1))
                    across = side * (hw + 3.7)
                    x, z = (dx * along, across) if axis == "x" else (across, dz * along)
                    if self._clear(x - 0.6, z - 0.6, x + 0.6, z + 0.6, margin=0) and not self._on_road(x, z, 1.0) and not self._in_sight(x, z, 8.0):
                        self.static.append(
                            {"kind": "tree", "position": [round(x, 2), KERB, round(z, 2)], "scale": round(self.rnd.uniform(0.85, 1.15), 2)}
                        )  # fmt: skip
                        self.points.append((x, z))
                along += self.rnd.uniform(6.0, 12.0)
        # Rows of buildings set back from the kerb, first along x, then along z.
        for axis, (dx, dz), length in sorted(self.arms(), key=lambda a: a[0]):
            hw = self.hw[axis]
            other_axis = "z" if axis == "x" else "x"
            for side in (-1, 1):
                # Where no road arm leaves this side of the junction, the row runs on through it.
                open_side = junction and not any(
                    a == other_axis and (d[0] if other_axis == "x" else d[1]) == side for a, d, _ in self.arms()
                )
                along = 0.6 if (not junction or open_side) else self.hw[other_axis] + CORNER_RADIUS + 3.0
                while True:
                    width = self.rnd.uniform(9.0, 17.0)
                    depth = self.rnd.uniform(9.0, 18.0)
                    if along + width > length - 2:
                        break
                    mid = along + width / 2
                    front = hw + 6.2
                    centre_across = side * (front + depth / 2)
                    if axis == "x":
                        cx, cz, sx, sz = dx * mid, centre_across, width, depth
                    else:
                        cx, cz, sx, sz = centre_across, dz * mid, depth, width
                    x0, z0, x1, z1 = cx - sx / 2, cz - sz / 2, cx + sx / 2, cz + sz / 2
                    if self._clear(x0, z0, x1, z1) and not self._box_on_road(x0, z0, x1, z1):
                        floors = self.rnd.choice((1, 2, 2, 3, 3, 3, 4))
                        facing = (0, -side) if axis == "x" else (-side, 0)
                        self.static.append(
                            {"kind": "building", "position": [round(cx, 2), KERB, round(cz, 2)],
                             "size": [round(sx, 2), round(floors * 3.2 + 0.4, 2), round(sz, 2)],
                             "heading": round(math.atan2(-facing[1], facing[0]), 4), "floors": floors,
                             "colour": self.rnd.choice(BUILDING_COLOURS), "illustrative": True}
                        )  # fmt: skip
                        self.blocked.append((x0, z0, x1, z1))
                    along += width + self.rnd.uniform(0.5, 2.5)

    def _box_on_road(self, x0: float, z0: float, x1: float, z1: float) -> bool:
        for road in self.layout["roads"]:
            half = road["lanes_each_way"] * road["lane_width"] + 5.5
            if road["axis"] == "x":
                if x0 < road["to"] and x1 > road["from"] and z0 < half and z1 > -half:
                    return True
            elif z0 < road["to"] and z1 > road["from"] and x0 < half and x1 > -half:
                return True
        return False

    def _dress_open(self) -> None:
        for _ in range(28):
            angle = self.rnd.uniform(0, math.tau)
            r = self.rnd.uniform(16, 45)
            x, z = math.cos(angle) * r, math.sin(angle) * r
            if self._clear(x - 1, z - 1, x + 1, z + 1):
                self.static.append({"kind": "tree", "position": [round(x, 2), 0, round(z, 2)], "scale": round(self.rnd.uniform(0.8, 1.2), 2)})
                self.points.append((x, z))


def _frange(start: float, stop: float, step: float):
    v = start
    while v <= stop:
        yield v
        v += step


def camera(
    layout: dict, points: list[tuple[float, float]], behind: tuple[float, float] | None, focus: tuple[float, float] | None = None
) -> dict:
    """The opening view: on roads, looking down the first vehicle's approach at the
    focus (the point of impact); for rooms, from high up to the south."""
    if layout["setting"]["kind"] == "indoor" and layout["rooms"]:
        x0 = min(r["x"] - r["width"] / 2 for r in layout["rooms"])
        x1 = max(r["x"] + r["width"] / 2 for r in layout["rooms"])
        z0 = min(r["z"] - r["depth"] / 2 for r in layout["rooms"])
        z1 = max(r["z"] + r["depth"] / 2 for r in layout["rooms"])
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        span = max(x1 - x0, z1 - z0)
        distance = span * 1.15 + 5
        elevation, azimuth = math.radians(56), math.radians(200)
    else:
        pts = points or [(0.0, 0.0)]
        xs, zs = [p[0] for p in pts], [p[1] for p in pts]
        mx, mz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
        # Centred near the focus, where the stages' action is, rather than on the whole route.
        fx, fz = focus if focus is not None else (mx, mz)
        cx, cz = fx * 0.75 + mx * 0.25, fz * 0.75 + mz * 0.25
        span = max(max(xs) - min(xs), max(zs) - min(zs), 16)
        distance = min(max(span * 0.85, 26), 70)
        elevation = math.radians(40)
        if behind is not None:
            # Straight back down the vehicle's approach, so the view runs along the
            # carriageway rather than over the buildings beside it.
            azimuth = math.atan2(behind[0], -behind[1])
        else:
            azimuth = math.radians(215)
    # Azimuth is a compass bearing from the target to the camera.
    horizontal = distance * math.cos(elevation)
    position = [
        round(cx + math.sin(azimuth) * horizontal, 2),
        round(distance * math.sin(elevation), 2),
        round(cz - math.cos(azimuth) * horizontal, 2),
    ]
    return {"position": position, "target": [round(cx, 2), 0, round(cz, 2)]}
