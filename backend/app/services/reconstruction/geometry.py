"""Plane geometry in scene-script coordinates: metres east and north of the origin,
headings as compass bearings in degrees."""

import math

from app.services.reconstruction.script import Point, Road

CARDINAL = {"north": 0.0, "east": 90.0, "south": 180.0, "west": 270.0}
OPPOSITE = {"north": "south", "south": "north", "east": "west", "west": "east"}

Vec = tuple[float, float]


def unit(bearing: float) -> Vec:
    """The (east, north) direction a bearing points."""
    r = math.radians(bearing)
    return math.sin(r), math.cos(r)


def bearing_of(east: float, north: float) -> float:
    return round(math.degrees(math.atan2(east, north)), 6) % 360


def left_of(v: Vec) -> Vec:
    return -v[1], v[0]


def add(a: Vec, b: Vec, k: float = 1.0) -> Vec:
    return a[0] + b[0] * k, a[1] + b[1] * k


def point(v: Vec) -> Point:
    return Point(east=round(v[0], 2), north=round(v[1], 2))


def vec(p: Point) -> Vec:
    return p.east, p.north


def half_width(road: Road) -> float:
    return road.lanes_each_way * road.lane_width_m


def lane_offset(road: Road, bearing: float, drive_side: str) -> Vec:
    """Offset from the road's centre line to the middle of the lane nearest the centre,
    for traffic travelling on `bearing`."""
    side = left_of(unit(bearing))
    k = road.lane_width_m / 2 * (1 if drive_side == "left" else -1)
    return side[0] * k, side[1] * k


def road_bearings(road: Road) -> tuple[float, float]:
    return (90.0, 270.0) if road.runs == "east-west" else (0.0, 180.0)


def snap_bearing(road: Road, bearing: float) -> float:
    """The road's direction of travel nearest a bearing."""
    a, b = road_bearings(road)
    return a if abs(_diff(a, bearing)) <= abs(_diff(b, bearing)) else b


def _diff(a: float, b: float) -> float:
    return (a - b + 180) % 360 - 180


def corner_point(roads: list[Road], east_sign: int, north_sign: int, inset: float = 2.2) -> Vec:
    """A spot on the footpath at a junction corner, or beside a single road."""
    ew = next((r for r in roads if r.runs == "east-west"), None)
    ns = next((r for r in roads if r.runs == "north-south"), None)
    e = east_sign * ((half_width(ns) if ns else 0) + inset) if east_sign else 0
    n = north_sign * ((half_width(ew) if ew else 0) + inset) if north_sign else 0
    if ns and not ew and not east_sign:
        e = half_width(ns) + inset
    if ew and not ns and not north_sign:
        n = half_width(ew) + inset
    return e, n
