"""Builds junction-camera-2.mp4, the seed case's CCTV clip (evidence "Junction
camera 2, 21:38 to 21:42").

The clip is a top-down schematic, like the generated scene photo, that follows
the camera log in app/seed.py second by second: the van stops at 21:39:48, creeps
over the line at 21:40:06, the hatchback enters at 21:40:10, the van moves off at
21:40:11 and strikes it at 21:40:12, and the cyclist rides away north at 21:40:20.

The MP4 is committed, so the seed doesn't need ffmpeg. To rebuild it, from
backend/ with ffmpeg on the PATH:

    python seed_data/make_cctv_clip.py
"""

import math
import subprocess
from itertools import pairwise
from pathlib import Path

import pymupdf

OUT = Path(__file__).with_name("junction-camera-2.mp4")
W, H = 400, 240
FPS = 10
# The recording runs from 21:38:00 to 21:42:00; t is seconds since 21:38:00.
DURATION = 240
# Metres to pixels, with the junction centre at (CX, CY); x east, y south.
SCALE = 5
CX, CY = 200, 120
ROAD_HALF = 3.5 * SCALE

ASPHALT = (0.24, 0.30, 0.35)
GROUND = (0.12, 0.16, 0.20)
MARKING = (0.89, 0.91, 0.92)
SKID = (0.08, 0.08, 0.08)
WHITE_CAR = (0.96, 0.97, 0.98)
BLUE_VAN = (0.13, 0.53, 0.92)
PERSON = (0.95, 0.75, 0.30)
TEXT = (0.96, 0.97, 0.98)
DIM = (0.60, 0.65, 0.69)


def px(x_m: float, z_m: float) -> tuple[float, float]:
    """World metres (x east, z south, from the junction centre) to pixels."""
    return CX + x_m * SCALE, CY + z_m * SCALE


def track(t: float, keys: list[tuple[float, tuple[float, ...]]]) -> tuple[float, ...]:
    """Linear interpolation between (time, values) keyframes, held at both ends."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in pairwise(keys):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            return tuple(a + (b - a) * f for a, b in zip(v0, v1))
    return keys[-1][1]


# Keyframes: (t, (x px, y px, heading radians)); heading 0 points east, -pi/2 north.
NORTH = -math.pi / 2
VAN_LENGTH, VAN_WIDTH = 4.4 * SCALE, 1.8 * SCALE
CAR_LENGTH, CAR_WIDTH = 3.8 * SCALE, 1.7 * SCALE
STOP_LINE_Y = CY + 5 * SCALE
VAN_X = px(-1.75, 0)[0]
CAR_Y = px(0, -1.75)[1]
IMPACT_CAR_X = px(-1, 0)[0]
SKID_FROM_X = IMPACT_CAR_X - 8.4 * SCALE

VAN = [
    (100.0, (VAN_X, H + 20, NORTH)),
    (108.0, (VAN_X, STOP_LINE_Y + VAN_LENGTH / 2, NORTH)),  # 21:39:48 stops at the line
    (126.0, (VAN_X, STOP_LINE_Y + VAN_LENGTH / 2, NORTH)),
    (127.0, (VAN_X, STOP_LINE_Y + VAN_LENGTH / 2 - SCALE, NORTH)),  # 21:40:06 one metre over
    (131.0, (VAN_X, STOP_LINE_Y + VAN_LENGTH / 2 - SCALE, NORTH)),  # 21:40:11 moves off
    (132.0, (VAN_X, CAR_Y + CAR_WIDTH / 2 + VAN_LENGTH / 2, NORTH)),  # 21:40:12 impact
    (133.5, (*px(-1.5, -1), NORTH + 0.2)),  # rest near the 5th Avenue centre line
]
CAR = [
    (130.0, (-CAR_LENGTH, CAR_Y, 0.0)),  # 21:40:10 enters from the left
    (132.0, (IMPACT_CAR_X, CAR_Y, 0.0)),
    (134.0, (*px(6, -5), -0.4)),  # rest against the north-east kerb
]
CYCLIST = [(140.0, (px(4.5, -7)[0], px(4.5, -7)[1])), (146.0, (px(2.8, -26)[0], px(2.8, -26)[1]))]
PEDESTRIAN = px(8, -7.5)


def draw_vehicle(page: pymupdf.Page, x: float, y: float, heading: float, length: float, width: float, colour) -> None:
    dx, dy = math.cos(heading), math.sin(heading)
    nx, ny = -dy, dx
    corners = [
        pymupdf.Point(x + sx * dx * length / 2 + sy * nx * width / 2, y + sx * dy * length / 2 + sy * ny * width / 2)
        for sx, sy in ((1, 1), (1, -1), (-1, -1), (-1, 1))
    ]
    page.draw_polyline(corners, color=None, fill=colour, closePath=True)
    # Windscreen, so the direction of travel shows.
    front = pymupdf.Point(x + dx * length * 0.22, y + dy * length * 0.22)
    page.draw_line(front + (nx * width * 0.35, ny * width * 0.35), front - (nx * width * 0.35, ny * width * 0.35), color=GROUND, width=1.5)


def clock(t: float) -> str:
    seconds = 21 * 3600 + 38 * 60 + int(t)
    return f"2026-10-03 {seconds // 3600:02d}:{seconds // 60 % 60:02d}:{seconds % 60:02d}"


def frame(t: float) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.draw_rect(page.rect, color=None, fill=GROUND)
    page.draw_rect(pymupdf.Rect(0, CY - ROAD_HALF, W, CY + ROAD_HALF), color=None, fill=ASPHALT)
    page.draw_rect(pymupdf.Rect(CX - ROAD_HALF, 0, CX + ROAD_HALF, H), color=None, fill=ASPHALT)
    for start, end in (((0, CY), (CX - ROAD_HALF, CY)), ((CX + ROAD_HALF, CY), (W, CY)), ((CX, 0), (CX, CY - ROAD_HALF)), ((CX, CY + ROAD_HALF), (CX, H))):
        page.draw_line(start, end, color=MARKING, width=1, dashes="[6 5] 0")
    page.draw_line((CX - ROAD_HALF, STOP_LINE_Y), (CX, STOP_LINE_Y), color=MARKING, width=2)

    car_x, car_y, car_heading = track(t, CAR)
    if car_x > SKID_FROM_X and t >= CAR[0][0]:
        for offset in (-CAR_WIDTH * 0.35, CAR_WIDTH * 0.35):
            page.draw_line((SKID_FROM_X, CAR_Y + offset), (min(car_x, IMPACT_CAR_X), CAR_Y + offset), color=SKID, width=1.5)
    draw_vehicle(page, *track(t, VAN), VAN_LENGTH, VAN_WIDTH, BLUE_VAN)
    if t >= CAR[0][0]:
        draw_vehicle(page, car_x, car_y, car_heading, CAR_LENGTH, CAR_WIDTH, WHITE_CAR)
    page.draw_circle(track(t, CYCLIST), 2.5, color=None, fill=PERSON)
    page.draw_circle(PEDESTRIAN, 2.5, color=None, fill=PERSON)

    page.insert_text((8, 16), clock(t), fontsize=10, fontname="cour", color=TEXT)
    page.insert_text((W - 116, 16), "CAM 2  5TH AVE N", fontsize=10, fontname="cour", color=TEXT)
    page.insert_text((8, H - 8), "Schematic stand-in, generated for the seed case", fontsize=8, fontname="cour", color=DIM)
    data = page.get_pixmap(alpha=False).samples
    doc.close()
    return data


def main() -> None:
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "veryslow", "-crf", "30", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-map_metadata", "-1", "-fflags", "+bitexact", str(OUT),
    ]  # fmt: skip
    with subprocess.Popen(command, stdin=subprocess.PIPE) as ffmpeg:
        for index in range(DURATION * FPS):
            ffmpeg.stdin.write(frame(index / FPS))
        ffmpeg.stdin.close()
    if ffmpeg.returncode:
        raise SystemExit(f"ffmpeg failed with exit code {ffmpeg.returncode}")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
