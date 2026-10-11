"""The seed case: a port of frontend/src/mocks/seed.ts and files.ts, so the screens
look the same against the real backend as they do in mock mode.

    python -m app.seed          # loads into an empty database; refuses if any cases exist
    python -m app.seed --reset  # drops and recreates every table first

It loads the four investigators, four cases and the full road-accident case:
persons, vehicles and the phone, locations, events, relationships, observations,
the signal-colour conflicts, injuries, both reconstruction scenarios with their
stages and scene objects, the evidence links and the audit history.

Evidence files are real. PDFs are written with PyMuPDF, the call recording and the
scene photos are generated as in files.ts, and the CCTV clip is
seed_data/junction-camera-2.mp4. Each is stored with save_bytes, so hashes, previews
and POST /cases/{id}/verify are real. The extracted text is indexed with
index_evidence, so search works without Gemini, and every evidence link points at
the chunk that holds its passage.

The seed never calls Gemini: it runs with the API key blanked, so the chunks are
stored without embeddings and search embeds them on first use when a key is set.
"""

import argparse
import math
import shutil
import struct
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from xml.sax.saxutils import escape

import pymupdf
from alembic import command
from alembic.config import Config
from sqlalchemy import func, inspect, select, update
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR, get_settings
from app.core.db import SessionLocal, engine
from app.core.records import record_audit
from app.core.storage import absolute_path, save_bytes, storage_root
from app.models import (
    AuditLog,
    Base,
    Case,
    CaseObject,
    Conflict,
    Event,
    Evidence,
    EvidenceChunk,
    EvidenceLink,
    Injury,
    Investigator,
    Location,
    Observation,
    Person,
    Reconstruction,
    ReconstructionStage,
    Relationship,
    SceneAnnotation,
    SceneObject,
)
from app.services.search.indexing import index_evidence

SEED_DATA = BACKEND_DIR / "seed_data"

# How long after upload the seed evidence counts as processed.
PROCESSING_TIME = timedelta(minutes=2)


class SeedError(Exception):
    pass


def at(day: str, time: str) -> datetime:
    """Local time on a given day in IST."""
    return datetime.fromisoformat(f"2026-{day}T{time}+05:30")


def oct3(time: str) -> datetime:
    return at("10-03", time)


# ---------------------------------------------------------------------------
# Evidence texts for case 1
# ---------------------------------------------------------------------------

POLICE_REPORT = [
    """TRAFFIC POLICE - SECTOR 12 STATION
Accident report no. TPS12/2026/0412

Date and time of incident: 3 October 2026, about 21:40. Location: junction of Ring Road and 5th Avenue, Sector 12.

Vehicle 1: white Maruti Swift hatchback, KA-01-AB-1234, driven by Rohan Kapoor (34), travelling east on Ring Road.

Vehicle 2: blue Tata Ace delivery van, KA-05-CD-5678, driven by Suresh Nair (46), travelling north on 5th Avenue, registered to QuickCart Logistics.

The van struck the driver's side of the hatchback in the middle of the junction. The hatchback came to rest against the north-east kerb. The van stopped near the centre line of 5th Avenue.

Rohan Kapoor was taken to City General Hospital by ambulance at 21:52 with a shoulder injury and a cut to the forehead. Suresh Nair was not injured.""",
    """Statements at the scene:

Suresh Nair stated that he waited at the stop line and moved off when his light went green. His phone was in a dashboard mount and he says he was not using it.

Rohan Kapoor stated that his light was amber when he entered the junction.

Scene examination at 23:10: skid marks from the hatchback measured 8.4 m before the point of impact. The van left no skid marks. Signal heads on all four arms were working. The signal controller log has been requested from the traffic management centre.

Witnesses: Anita Desai (pedestrian, north-east corner) and Vikram Singh (shopkeeper, south-west corner). CCTV from junction camera 2 seized.""",
]

DESAI_STATEMENT = """Witness statement - Anita Desai
Recorded by SI Arjun Mehta, 3 October 2026, 22:30, at the scene.

I was waiting to cross 5th Avenue at the north-east corner of the junction. The pedestrian signal for my crossing was red.

The white car was coming along Ring Road from the west. Its light was still yellow when it went into the junction. I am sure of that because I was watching the lights to see when I could cross.

The blue delivery van on 5th Avenue started moving before its light turned green. It had been creeping forward over the line, and it went as soon as the car's light changed. It hit the side of the white car in the middle of the junction.

I called 112 straight away. A man on a bicycle was also waiting at the corner, but he rode off before the police came."""

SINGH_STATEMENT = """Witness statement - Vikram Singh
Recorded by SI Arjun Mehta, 3 October 2026, 22:45, at his shop.

I run the corner store on the south-west corner of the junction. I was standing at the shop door, facing the junction.

The white car came fast along Ring Road. The light for Ring Road was red before the car reached the junction, and it did not slow down.

The delivery van had a green light. It pulled away normally from the stop line and the car went straight across in front of it. The van could not stop in time.

I have seen many cars jump that light at night."""

CCTV_DESCRIPTION = """Junction camera 2, facing north along 5th Avenue. Recording from 21:38:00 to 21:42:00. The signal heads are outside the camera's view. The camera clock has not yet been checked against the signal controller clock.

21:39:48 The blue delivery van arrives at the 5th Avenue stop line and stops.

21:40:06 The van's front wheels move about one metre past the stop line.

21:40:10 The white hatchback enters the frame from the left on Ring Road, travelling east.

21:40:11 The van moves off into the junction.

21:40:12 The van strikes the driver's side of the hatchback near the centre of the junction.

21:40:20 A cyclist at the north-east corner rides away north along 5th Avenue.

21:40:35 A pedestrian at the north-east corner makes a phone call."""

CALL_TRANSCRIPT = """Emergency call to 112, 3 October 2026, 21:41:05. Duration 1 minute 12 seconds.

Caller (Anita Desai): There's been an accident at the Ring Road and 5th Avenue junction. A van has hit a car.

Operator: Is anyone hurt?

Caller: The driver of the car is hurt, he's holding his shoulder. There's blood on his face.

Operator: An ambulance is on its way. Is the road blocked?

Caller: Yes, both of them are in the middle of the junction."""

MEDICAL_REPORT = [
    """CITY GENERAL HOSPITAL - EMERGENCY DEPARTMENT

Patient: Rohan Kapoor, male, 34. Arrived 3 October 2026, 22:05, by ambulance.

Finding 1: displaced fracture of the right clavicle, consistent with a side impact on the driver's side.

Finding 2: laceration of the forehead, 3 cm, sutured.

Finding 3: bruising to the right upper arm.

Blood alcohol: not detected. Condition: stable, admitted for observation.

Examining doctor: Dr. Kavya Iyer"""
]

SIGNAL_LOG = """Traffic management centre - signal controller log
Junction: Ring Road / 5th Avenue (controller J-12-04). Date: 3 October 2026.

21:39:20 Ring Road green, 5th Avenue red.

21:40:08 Ring Road amber, 5th Avenue red.

21:40:11 Ring Road red, 5th Avenue red (all-red phase).

21:40:13 Ring Road red, 5th Avenue green.

21:41:03 Ring Road red, 5th Avenue amber.

No faults were recorded between 21:00 and 22:00."""

BUS_DRIVER_STATEMENT = (
    "Witness statement - route 220 bus driver\n\n"
    "A dark hatchback hit a man crossing behind my bus at about 23:15. "
    "It did not stop and drove towards Lakeview Circle."
)

FIRE_REPORT = [
    (
        "FIRE SERVICE INCIDENT REPORT\n\n"
        "Fire reported at 03:20 in a textile warehouse. "
        "Fire started near the electrical panel on the ground floor. No injuries."
    )
]

COMPLAINANT_STATEMENT = (
    "Complainant statement\n\nWe returned at 17:30 to find the balcony door forced and jewellery missing."
)

# ---------------------------------------------------------------------------
# Files (files.ts)
# ---------------------------------------------------------------------------


def make_pdf(pages: list[str], title: str) -> bytes:
    """An A4 PDF with one Helvetica text block per page and a real text layer."""
    doc = pymupdf.open()
    for text in pages:
        page = doc.new_page(width=595, height=842)
        if page.insert_textbox(pymupdf.Rect(56, 56, 539, 786), text, fontsize=11, fontname="helv") < 0:
            raise SeedError(f"Seed text does not fit on a page of {title!r}")
    doc.set_metadata({"title": title, "producer": "Evidentia seed"})
    data = doc.tobytes(garbage=3, deflate=True)
    doc.close()
    return data


def make_wav(seconds: int = 4, sample_rate: int = 8000) -> bytes:
    """A short mono WAV: a two-tone ring followed by a quiet hum, standing in for a
    call recording."""
    samples = seconds * sample_rate
    header = (
        b"RIFF"
        + struct.pack("<I", 36 + samples * 2)
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
        + b"data"
        + struct.pack("<I", samples * 2)
    )
    values = []
    for i in range(samples):
        t = i / sample_rate
        ringing = t < 1.6 and t % 0.8 < 0.4
        value = (
            0.25 * (math.sin(2 * math.pi * 440 * t) + math.sin(2 * math.pi * 480 * t))
            if ringing
            else 0.04 * math.sin(2 * math.pi * 120 * t)
        )
        values.append(int(max(-1.0, min(1.0, value)) * 0x7FFF))
    return header + struct.pack(f"<{samples}h", *values)


def make_scene_photo(caption: str) -> bytes:
    """A schematic stand-in for a scene photograph."""
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <rect width="800" height="500" fill="#1f2933"/>
  <rect x="0" y="190" width="800" height="120" fill="#3e4c59"/>
  <rect x="330" y="0" width="140" height="500" fill="#3e4c59"/>
  <g stroke="#e4e7eb" stroke-width="4" stroke-dasharray="24 18">
    <line x1="0" y1="250" x2="330" y2="250"/><line x1="470" y1="250" x2="800" y2="250"/>
    <line x1="400" y1="0" x2="400" y2="190"/><line x1="400" y1="310" x2="400" y2="500"/>
  </g>
  <g transform="translate(520 150) rotate(22)">
    <rect x="-60" y="-28" width="120" height="56" rx="12" fill="#f5f7fa"/>
    <path d="M -10 28 l 18 -16 l 16 18" fill="none" stroke="#cf1124" stroke-width="5"/>
  </g>
  <g transform="translate(385 285)">
    <rect x="-30" y="-55" width="60" height="110" rx="8" fill="#2186eb"/>
  </g>
  <path d="M 110 232 L 470 232" stroke="#9aa5b1" stroke-width="3" stroke-dasharray="4 6"/>
  <text x="24" y="40" fill="#f5f7fa" font-family="monospace" font-size="20">{escape(caption)}</text>
  <text x="24" y="470" fill="#9aa5b1" font-family="monospace" font-size="14">Mock evidence photo, generated for the demo case</text>
</svg>"""
    return svg.encode()


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


@dataclass
class EvidenceSeed:
    id: int
    case_id: int
    type: str
    title: str
    description: str
    source: str
    collected_at: datetime
    file_name: str
    mime_type: str
    data: bytes
    text: str | None
    summary: str
    # Set for PDFs, so chunks keep their page numbers.
    pages: list[str] | None = None


def evidence_seeds() -> list[EvidenceSeed]:
    return [
        EvidenceSeed(
            id=1,
            case_id=1,
            type="document",
            title="Police accident report TPS12/2026/0412",
            description="Report by the first officers at the scene, with statements and scene examination.",
            source="Traffic Police, Sector 12 station",
            collected_at=oct3("23:40:00"),
            file_name="police-report-TPS12-2026-0412.pdf",
            mime_type="application/pdf",
            data=make_pdf(POLICE_REPORT, "Police accident report TPS12/2026/0412"),
            text="\n\n".join(POLICE_REPORT),
            pages=POLICE_REPORT,
            summary=(
                "Van struck the driver side of the hatchback in the junction at about 21:40. Hatchback driver "
                "injured. Hatchback skid marks 8.4 m. Van driver says he moved off on green; hatchback driver says "
                "his light was amber."
            ),
        ),
        EvidenceSeed(
            id=2,
            case_id=1,
            type="statement",
            title="Witness statement: Anita Desai",
            description="Pedestrian waiting at the north-east corner.",
            source="Recorded by SI Arjun Mehta",
            collected_at=oct3("22:30:00"),
            file_name="statement-anita-desai.txt",
            mime_type="text/plain",
            data=DESAI_STATEMENT.encode(),
            text=DESAI_STATEMENT,
            summary=(
                "Says the hatchback entered on yellow and the van moved off before its light turned green. "
                "Called 112. Mentions a cyclist who left before police arrived."
            ),
        ),
        EvidenceSeed(
            id=3,
            case_id=1,
            type="statement",
            title="Witness statement: Vikram Singh",
            description="Shopkeeper at the south-west corner.",
            source="Recorded by SI Arjun Mehta",
            collected_at=oct3("22:45:00"),
            file_name="statement-vikram-singh.txt",
            mime_type="text/plain",
            data=SINGH_STATEMENT.encode(),
            text=SINGH_STATEMENT,
            summary="Says the hatchback ran a red light at speed and the van pulled away on green.",
        ),
        EvidenceSeed(
            id=4,
            case_id=1,
            type="video",
            title="Junction camera 2, 21:38 to 21:42",
            description="CCTV facing north along 5th Avenue. Signal heads not in view.",
            source="Traffic management centre",
            collected_at=oct3("23:55:00"),
            file_name="junction-camera-2.mp4",
            mime_type="video/mp4",
            data=(SEED_DATA / "junction-camera-2.mp4").read_bytes(),
            text=CCTV_DESCRIPTION,
            summary=(
                "Van creeps past the stop line at 21:40:06, moves off at 21:40:11 and strikes the hatchback at "
                "21:40:12. A cyclist leaves the scene at 21:40:20. Camera clock not yet checked."
            ),
        ),
        EvidenceSeed(
            id=5,
            case_id=1,
            type="photo",
            title="Scene photo: hatchback at rest",
            description="Hatchback against the north-east kerb, driver-side damage.",
            source="Const. Rahul Verma",
            collected_at=oct3("23:10:00"),
            file_name="scene-photo-hatchback-at-rest.svg",
            mime_type="image/svg+xml",
            data=make_scene_photo("Scene photo 1: hatchback at rest, NE kerb"),
            text=None,
            summary="Hatchback at rest against the north-east kerb with damage to the driver door and B-pillar.",
        ),
        EvidenceSeed(
            id=6,
            case_id=1,
            type="audio",
            title="Emergency call recording (112)",
            description="Call made by Anita Desai at 21:41.",
            source="Emergency response centre",
            collected_at=at("10-04", "10:00:00"),
            file_name="emergency-call-112.wav",
            mime_type="audio/wav",
            data=make_wav(),
            text=CALL_TRANSCRIPT,
            summary="Anita Desai reports a van hitting a car at 21:41; the car driver is hurt and the junction is blocked.",
        ),
        EvidenceSeed(
            id=7,
            case_id=1,
            type="medical",
            title="Medical report: Rohan Kapoor",
            description="Emergency department findings, City General Hospital.",
            source="City General Hospital",
            collected_at=at("10-04", "09:00:00"),
            file_name="medical-report-rohan-kapoor.pdf",
            mime_type="application/pdf",
            data=make_pdf(MEDICAL_REPORT, "Medical report: Rohan Kapoor"),
            text="\n\n".join(MEDICAL_REPORT),
            pages=MEDICAL_REPORT,
            summary="Fractured right clavicle, 3 cm forehead laceration, bruised right upper arm. No alcohol detected.",
        ),
        EvidenceSeed(
            id=8,
            case_id=1,
            type="document",
            title="Signal controller log, junction J-12-04",
            description="Signal phase changes between 21:39 and 21:41.",
            source="Traffic management centre",
            collected_at=at("10-04", "16:30:00"),
            file_name="signal-controller-log-J-12-04.txt",
            mime_type="text/plain",
            data=SIGNAL_LOG.encode(),
            text=SIGNAL_LOG,
            summary="Ring Road amber 21:40:08, red 21:40:11; all-red until 5th Avenue turns green at 21:40:13. No faults.",
        ),
        EvidenceSeed(
            id=9,
            case_id=2,
            type="photo",
            title="Bus stop 14 camera still",
            description="Still frame from the bus shelter camera.",
            source="City transport authority",
            collected_at=at("10-08", "08:00:00"),
            file_name="bus-stop-14-camera-still.svg",
            mime_type="image/svg+xml",
            data=make_scene_photo("Bus stop 14 camera, 23:15"),
            text=None,
            summary="Dark hatchback with a damaged left headlight passing the bus stop at 23:15.",
        ),
        EvidenceSeed(
            id=10,
            case_id=2,
            type="statement",
            title="Witness statement: bus driver",
            description="Driver of route 220, parked at bus stop 14.",
            source="Recorded by SI Arjun Mehta",
            collected_at=at("10-08", "01:10:00"),
            file_name="statement-bus-driver.txt",
            mime_type="text/plain",
            data=BUS_DRIVER_STATEMENT.encode(),
            text=BUS_DRIVER_STATEMENT,
            summary="Dark hatchback hit a pedestrian at about 23:15 and drove towards Lakeview Circle.",
        ),
        EvidenceSeed(
            id=11,
            case_id=3,
            type="document",
            title="Fire service incident report",
            description="Report from the attending fire station.",
            source="Fire station 7",
            collected_at=at("09-22", "12:00:00"),
            file_name="fire-service-incident-report.pdf",
            mime_type="application/pdf",
            data=make_pdf(FIRE_REPORT, "Fire service incident report"),
            text="\n\n".join(FIRE_REPORT),
            pages=FIRE_REPORT,
            summary="Fire started near the ground-floor electrical panel at about 03:20. No injuries.",
        ),
        EvidenceSeed(
            id=12,
            case_id=4,
            type="statement",
            title="Complainant statement",
            description="Resident of flat 4B.",
            source="Recorded by Insp. Meera Rao",
            collected_at=at("08-30", "18:30:00"),
            file_name="complainant-statement.txt",
            mime_type="text/plain",
            data=COMPLAINANT_STATEMENT.encode(),
            text=COMPLAINANT_STATEMENT,
            summary="Balcony door forced; jewellery missing. Discovered at 17:30.",
        ),
    ]


# ---------------------------------------------------------------------------
# Records, as in seed.ts. Every `id` and reference holds the mock's ids; the loader
# turns them into the real ids of the rows it has added.
# ---------------------------------------------------------------------------

INVESTIGATOR = {"origin": "investigator", "review_status": "confirmed"}
AI_PENDING = {"origin": "ai", "review_status": "pending"}
AI_CONFIRMED = {"origin": "ai", "review_status": "confirmed"}

INVESTIGATORS = [
    dict(id=1, name="Insp. Meera Rao", badge_number="TPD-2187", role="Lead Investigator", clearance_level="Level 4"),
    dict(
        id=2,
        name="SI Arjun Mehta",
        badge_number="TPD-3044",
        role="Accident Reconstruction Specialist",
        clearance_level="Level 3",
    ),
    dict(id=3, name="Dr. Kavya Iyer", badge_number="FMO-0912", role="Forensic Medical Officer", clearance_level="Level 3"),
    dict(id=4, name="Const. Rahul Verma", badge_number="TPD-4410", role="Evidence Officer", clearance_level="Level 2"),
]

CASES = [
    dict(
        id=1,
        title="Collision at Ring Road and 5th Avenue junction",
        incident_type="road_accident",
        status="in_progress",
        priority="high",
        description=(
            "A delivery van and a hatchback collided in a signal-controlled junction at about 21:40. The hatchback "
            "driver was injured. Witnesses disagree on which vehicle had the right of way."
        ),
        incident_at=oct3("21:40:12"),
        lead_investigator_id=1,
        investigator_ids=[1, 2, 3, 4],
        created_at=oct3("22:10:00"),
        updated_at=at("10-05", "11:20:00"),
    ),
    dict(
        id=2,
        title="Hit-and-run on Lakeview Road",
        incident_type="road_accident",
        status="open",
        priority="critical",
        description="A pedestrian was struck near bus stop 14 by a vehicle that did not stop.",
        incident_at=at("10-07", "23:15:00"),
        lead_investigator_id=2,
        investigator_ids=[2, 4],
        created_at=at("10-08", "00:05:00"),
        updated_at=at("10-08", "09:40:00"),
    ),
    dict(
        id=3,
        title="Warehouse fire, Industrial Area Phase 2",
        incident_type="fire",
        status="under_review",
        priority="medium",
        description="Fire in a textile warehouse during the night shift. Cause under review.",
        incident_at=at("09-21", "03:20:00"),
        lead_investigator_id=3,
        investigator_ids=[3],
        created_at=at("09-21", "06:00:00"),
        updated_at=at("09-30", "15:00:00"),
    ),
    dict(
        id=4,
        title="Burglary at Greenpark Apartments, flat 4B",
        incident_type="burglary",
        status="closed",
        priority="low",
        description="Daytime burglary while the residents were away. Property recovered.",
        incident_at=at("08-30", "14:00:00"),
        lead_investigator_id=1,
        investigator_ids=[1, 4],
        created_at=at("08-30", "18:00:00"),
        updated_at=at("09-12", "10:00:00"),
    ),
]

PERSONS = [
    dict(
        id=1,
        case_id=1,
        role="victim",
        name="Rohan Kapoor",
        age=34,
        occupation="Software engineer",
        condition="injured",
        contact="+91 90000 00101",
        notes="Driver of the hatchback. Says his light was amber when he entered the junction.",
        details={},
        **INVESTIGATOR,
    ),
    dict(
        id=2,
        case_id=1,
        role="other",
        name="Suresh Nair",
        age=46,
        occupation="Delivery driver, QuickCart Logistics",
        condition="uninjured",
        contact="+91 90000 00102",
        notes="Driver of the van. Says he moved off when his light went green.",
        details={},
        **INVESTIGATOR,
    ),
    dict(
        id=3,
        case_id=1,
        role="witness",
        name="Anita Desai",
        age=29,
        occupation="Pedestrian at the north-east corner",
        condition="uninjured",
        contact="+91 90000 00103",
        notes="Watched the signals while waiting to cross. Called 112.",
        details={},
        **INVESTIGATOR,
    ),
    dict(
        id=4,
        case_id=1,
        role="witness",
        name="Vikram Singh",
        age=52,
        occupation="Shopkeeper, south-west corner",
        condition="uninjured",
        contact="+91 90000 00104",
        notes="Watched from his shop door.",
        details={},
        **INVESTIGATOR,
    ),
    dict(
        id=5,
        case_id=1,
        role="witness",
        name="Unidentified cyclist",
        age=None,
        occupation="",
        condition=None,
        contact="",
        notes="Waiting at the north-east corner; rode away north before the police arrived.",
        details={},
        **AI_PENDING,
    ),
    dict(
        id=6,
        case_id=2,
        role="victim",
        name="Unidentified pedestrian",
        age=60,
        occupation="",
        condition="injured",
        contact="",
        notes="Struck while crossing behind the route 220 bus.",
        details={},
        **INVESTIGATOR,
    ),
]

OBJECTS = [
    dict(
        id=1,
        case_id=1,
        kind="vehicle",
        label="White hatchback",
        details={"plate": "KA-01-AB-1234", "make": "Maruti Swift", "colour": "White"},
        **INVESTIGATOR,
    ),
    dict(
        id=2,
        case_id=1,
        kind="vehicle",
        label="Delivery van",
        details={"plate": "KA-05-CD-5678", "make": "Tata Ace", "colour": "Blue"},
        **INVESTIGATOR,
    ),
    dict(id=3, case_id=1, kind="phone", label="Van driver's phone", details={"number": "+91 90000 00102"}, **AI_PENDING),
    dict(id=4, case_id=2, kind="vehicle", label="Dark hatchback (unidentified)", details={"colour": "Dark grey"}, **INVESTIGATOR),
]

LOCATIONS = [
    dict(id=1, case_id=1, kind="incident_site", address="Ring Road and 5th Avenue junction, Sector 12", lat=12.9716, lng=77.5946),
    dict(id=2, case_id=1, kind="witness_position", address="North-east corner, pedestrian crossing", lat=12.97175, lng=77.59475),
    dict(id=3, case_id=1, kind="witness_position", address="Corner store, south-west corner", lat=12.97145, lng=77.59445),
    dict(id=4, case_id=1, kind="vehicle_position", address="Hatchback rest position, north-east kerb", lat=12.97168, lng=77.59472),
    dict(id=5, case_id=1, kind="vehicle_position", address="Van rest position, 5th Avenue centre line", lat=12.97158, lng=77.59458),
    dict(id=6, case_id=2, kind="incident_site", address="Lakeview Road near bus stop 14", lat=12.9352, lng=77.6245),
    dict(id=7, case_id=3, kind="incident_site", address="Plot 22, Industrial Area Phase 2", lat=13.0158, lng=77.5367),
    dict(id=8, case_id=4, kind="incident_site", address="Greenpark Apartments, flat 4B", lat=12.9279, lng=77.6271),
]
for _location in LOCATIONS:
    _location.update(geometry=None, building_id=None, **INVESTIGATOR)


def _event(id, case_id, location_id, category, time_start, precision, certainty, description, ai_note=None, *, review):
    return dict(
        id=id,
        case_id=case_id,
        location_id=location_id,
        category=category,
        time_start=time_start,
        time_end=None,
        time_precision=precision,
        certainty=certainty,
        description=description,
        ai_note=ai_note,
        **review,
    )


EVENTS = [
    {
        **_event(1, 1, None, "movement", oct3("21:39:00"), "approximate", "established",
                 "Hatchback travels east on Ring Road towards the junction", review=INVESTIGATOR),
        "time_end": oct3("21:40:10"),
    },
    _event(2, 1, 1, "movement", oct3("21:39:48"), "exact", "established",
           "Van stops at the 5th Avenue stop line", review=AI_CONFIRMED),
    _event(3, 1, 1, "movement", oct3("21:40:06"), "exact", "established",
           "Van creeps about one metre past the stop line", review=AI_CONFIRMED),
    _event(4, 1, 1, "other", oct3("21:40:08"), "exact", "established",
           "Ring Road signal turns amber", review=INVESTIGATOR),
    _event(5, 1, 1, "other", oct3("21:40:11"), "exact", "established",
           "Ring Road signal turns red; all-red phase begins", review=INVESTIGATOR),
    _event(6, 1, 1, "movement", oct3("21:40:11"), "exact", "disputed",
           "Van moves off into the junction",
           "Camera time is before 5th Avenue's green at 21:40:13, matching Anita Desai. Vikram Singh says the van "
           "had green. The camera clock has not been checked.", review=AI_PENDING),
    _event(7, 1, 1, "collision", oct3("21:40:12"), "exact", "established",
           "Van strikes the driver's side of the hatchback", review=INVESTIGATOR),
    _event(8, 1, 1, "other", oct3("21:40:13"), "exact", "established",
           "5th Avenue signal turns green", review=INVESTIGATOR),
    _event(9, 1, 2, "witness", oct3("21:40:20"), "exact", "hypothesis",
           "Unidentified cyclist leaves the scene northbound",
           "Seen on camera 2 and mentioned by Anita Desai. A possible third witness.", review=AI_PENDING),
    _event(10, 1, 2, "emergency", oct3("21:41:05"), "exact", "established",
           "Anita Desai calls 112", review=INVESTIGATOR),
    _event(11, 1, 1, "emergency", oct3("21:52:00"), "minute", "established",
           "Ambulance takes Rohan Kapoor to City General Hospital", review=INVESTIGATOR),
    _event(12, 1, None, "medical", oct3("22:05:00"), "minute", "established",
           "Rohan Kapoor examined at City General Hospital", review=INVESTIGATOR),
    _event(13, 1, 1, "investigation", oct3("23:10:00"), "minute", "established",
           "Scene examined; hatchback skid marks of 8.4 m measured", review=INVESTIGATOR),
    _event(14, 2, 6, "collision", at("10-07", "23:15:00"), "approximate", "established",
           "Pedestrian struck behind the route 220 bus", review=INVESTIGATOR),
]  # fmt: skip


def _relationship(id, case_id, from_type, from_id, to_type, to_id, kind, label, confidence, flagged, notes="", *, review):
    return dict(
        id=id,
        case_id=case_id,
        from_type=from_type,
        from_id=from_id,
        to_type=to_type,
        to_id=to_id,
        kind=kind,
        label=label,
        confidence=confidence,
        flagged=flagged,
        notes=notes,
        **review,
    )


RELATIONSHIPS = [
    _relationship(1, 1, "person", 1, "object", 1, "drove", "Driver", None, False, review=INVESTIGATOR),
    _relationship(2, 1, "person", 2, "object", 2, "drove", "Driver", None, False, review=INVESTIGATOR),
    _relationship(3, 1, "object", 1, "location", 1, "involved_in", "Struck in junction", None, False, review=INVESTIGATOR),
    _relationship(4, 1, "object", 2, "location", 1, "involved_in", "Struck the hatchback", None, False, review=INVESTIGATOR),
    _relationship(5, 1, "person", 3, "location", 1, "witnessed", "Watched from NE crossing", None, False, review=INVESTIGATOR),
    _relationship(6, 1, "person", 4, "location", 1, "witnessed", "Watched from shop door", None, False, review=INVESTIGATOR),
    _relationship(7, 1, "evidence", 2, "evidence", 3, "contradicts", "Disagree on signal colour", 0.92, True,
                  "Desai: hatchback on yellow, van early. Singh: hatchback on red, van on green.", review=AI_PENDING),
    _relationship(8, 1, "evidence", 4, "object", 2, "mentions", "Van moves off at 21:40:11", 0.88, False, review=AI_CONFIRMED),
    _relationship(9, 1, "person", 2, "object", 3, "owns", "Phone in dashboard mount", 0.75, False, review=AI_PENDING),
    _relationship(10, 1, "evidence", 8, "evidence", 2, "supports", "Signal log fits amber entry", 0.7, False, review=AI_PENDING),
    _relationship(11, 1, "person", 5, "location", 1, "witnessed", "Left before police arrived", 0.6, True, review=AI_PENDING),
    _relationship(12, 2, "object", 4, "person", 6, "involved_in", "Struck pedestrian", None, False, review=INVESTIGATOR),
]  # fmt: skip

OBSERVATIONS = [
    dict(id=1, case_id=1, subject_type="object", subject_id=1, observed_at=oct3("21:40:10"), **AI_PENDING,
         statement="The hatchback's signal was amber when it entered the junction."),
    dict(id=2, case_id=1, subject_type="object", subject_id=1, observed_at=oct3("21:40:10"), **AI_PENDING,
         statement="The hatchback's signal was red before it reached the junction."),
    dict(id=3, case_id=1, subject_type="object", subject_id=2, observed_at=oct3("21:40:11"), **AI_PENDING,
         statement="The van moved off before its signal turned green."),
    dict(id=4, case_id=1, subject_type="object", subject_id=2, observed_at=oct3("21:40:11"), **AI_PENDING,
         statement="The van had a green signal when it pulled away."),
    dict(id=5, case_id=1, subject_type="person", subject_id=2, observed_at=oct3("21:40:11"), **AI_PENDING,
         statement="The van driver says he moved off when his light went green."),
    dict(id=6, case_id=1, subject_type="location", subject_id=1, observed_at=oct3("21:40:08"), **AI_CONFIRMED,
         statement="Ring Road was amber from 21:40:08 and red from 21:40:11; 5th Avenue turned green at 21:40:13."),
    dict(id=7, case_id=1, subject_type="person", subject_id=1, observed_at=oct3("22:05:00"), **AI_CONFIRMED,
         statement="Rohan Kapoor has a fractured right clavicle and a 3 cm forehead laceration; no alcohol detected."),
    dict(id=8, case_id=1, subject_type="object", subject_id=2, observed_at=oct3("21:40:11"), **AI_PENDING,
         statement="By the camera clock, the van moved off at 21:40:11. The camera clock has not been checked "
                   "against the signal controller."),
]  # fmt: skip
for _observation in OBSERVATIONS:
    _observation["author_id"] = None

CONFLICTS = [
    dict(id=1, case_id=1, observation_ids=[1, 2], status="open",
         description="Witnesses disagree on the hatchback's signal when it entered the junction."),
    dict(id=2, case_id=1, observation_ids=[3, 4, 5], status="open",
         description="Accounts disagree on whether the van moved off before its signal turned green."),
]  # fmt: skip

INJURIES = [
    dict(id=1, case_id=1, person_id=1, body_region="chest", structure_id="clavicle_right", type="Fracture",
         severity="moderate", depth=None, estimated_time=oct3("21:40:12"), **AI_CONFIRMED,
         description="Displaced fracture of the right clavicle, consistent with a driver-side impact."),
    dict(id=2, case_id=1, person_id=1, body_region="head", structure_id=None, type="Laceration", severity="minor",
         depth="3 cm long", estimated_time=oct3("21:40:12"), description="Forehead laceration, sutured.", **AI_CONFIRMED),
    dict(id=3, case_id=1, person_id=1, body_region="right_arm", structure_id=None, type="Bruising", severity="minor",
         depth=None, estimated_time=oct3("21:40:12"), description="Bruising to the right upper arm.", **AI_PENDING),
]  # fmt: skip

# Evidence links: the source passage behind each record, as (evidence, target type,
# target, passage). Each passage must appear in one chunk of its evidence.
LINKS = [
    (4, "event", 1, "The white hatchback enters the frame from the left on Ring Road, travelling east."),
    (4, "event", 2, "The blue delivery van arrives at the 5th Avenue stop line and stops."),
    (4, "event", 3, "The van's front wheels move about one metre past the stop line."),
    (8, "event", 4, "Ring Road amber, 5th Avenue red."),
    (8, "event", 5, "Ring Road red, 5th Avenue red (all-red phase)."),
    (4, "event", 6, "The van moves off into the junction."),
    (2, "event", 6, "The blue delivery van on 5th Avenue started moving before its light turned green."),
    (4, "event", 7, "The van strikes the driver's side of the hatchback near the centre of the junction."),
    (1, "event", 7, "The van struck the driver's side of the hatchback in the middle of the junction."),
    (8, "event", 8, "Ring Road red, 5th Avenue green."),
    (4, "event", 9, "A cyclist at the north-east corner rides away north along 5th Avenue."),
    (6, "event", 10, "There's been an accident at the Ring Road and 5th Avenue junction. A van has hit a car."),
    (1, "event", 11, "Rohan Kapoor was taken to City General Hospital by ambulance at 21:52"),
    (7, "event", 12, "Arrived 3 October 2026, 22:05, by ambulance."),
    (1, "event", 13, "skid marks from the hatchback measured 8.4 m before the point of impact."),
    (2, "observation", 1, "Its light was still yellow when it went into the junction."),
    (3, "observation", 2, "The light for Ring Road was red before the car reached the junction, and it did not slow down."),
    (2, "observation", 3, "The blue delivery van on 5th Avenue started moving before its light turned green."),
    (3, "observation", 4, "The delivery van had a green light."),
    (1, "observation", 5, "Suresh Nair stated that he waited at the stop line and moved off when his light went green."),
    (8, "observation", 6, "Ring Road amber, 5th Avenue red."),
    (7, "observation", 7, "displaced fracture of the right clavicle, consistent with a side impact on the driver's side."),
    (4, "observation", 8, "The van moves off into the junction."),
    (2, "person", 5, "A man on a bicycle was also waiting at the corner, but he rode off before the police came."),
    (1, "object", 3, "His phone was in a dashboard mount and he says he was not using it."),
    (1, "object", 1, "Vehicle 1: white Maruti Swift hatchback, KA-01-AB-1234, driven by Rohan Kapoor (34), travelling east on Ring Road."),
    (4, "object", 1, "The white hatchback enters the frame from the left on Ring Road, travelling east."),
    (1, "object", 2, "Vehicle 2: blue Tata Ace delivery van, KA-05-CD-5678, driven by Suresh Nair (46), travelling north on 5th Avenue, registered to QuickCart Logistics."),
    (4, "object", 2, "The blue delivery van arrives at the 5th Avenue stop line and stops."),
    (2, "relationship", 7, "Its light was still yellow when it went into the junction."),
    (3, "relationship", 7, "The delivery van had a green light."),
    (1, "person", 1, "Rohan Kapoor stated that his light was amber when he entered the junction."),
    (10, "event", 14, "A dark hatchback hit a man crossing behind my bus at about 23:15."),
    (7, "injury", 1, "displaced fracture of the right clavicle, consistent with a side impact on the driver's side."),
    (7, "injury", 2, "laceration of the forehead, 3 cm, sutured."),
    (7, "injury", 3, "bruising to the right upper arm."),
]

RECONSTRUCTIONS = [
    dict(
        id=1,
        case_id=1,
        scenario="Van moved off before its green",
        version=1,
        assumptions=(
            "The hatchback entered on amber at about 21:40:09. The van moved off during the all-red phase at "
            "21:40:11. Assumes the camera clock matches the signal controller. Supported by Anita Desai and the "
            "signal log."
        ),
        scene_file="road-accident/junction.json",
    ),
    dict(
        id=2,
        case_id=1,
        scenario="Hatchback entered on red",
        version=1,
        assumptions=(
            "The hatchback entered after 21:40:11 on red. The van moved off on green at 21:40:13. Assumes the camera "
            "clock runs about 2 seconds behind the signal controller. Supported by Vikram Singh."
        ),
        scene_file="road-accident/junction.json",
    ),
]

STAGES = [
    dict(id=1, reconstruction_id=1, stage_order=1, label="Approach", event_ids=[1, 2, 3, 4]),
    dict(id=2, reconstruction_id=1, stage_order=2, label="Impact", event_ids=[5, 6, 7]),
    dict(id=3, reconstruction_id=1, stage_order=3, label="Rest positions", event_ids=[8, 10, 11]),
    dict(id=4, reconstruction_id=2, stage_order=1, label="Approach", event_ids=[1, 2, 5]),
    dict(id=5, reconstruction_id=2, stage_order=2, label="Impact", event_ids=[7, 8]),
]

HALF_PI = math.pi / 2
# stage, object, position (metres from the junction centre; x east, z south), heading (radians)
PLACEMENTS = [
    (1, 1, [-25, 0, -1.75], 0), (1, 2, [-1.75, 0, 9], HALF_PI),
    (2, 1, [-1, 0, -1.75], 0), (2, 2, [-1.75, 0, 0.5], HALF_PI),
    (3, 1, [6, 0, -5], 0.4), (3, 2, [-1.5, 0, -1], HALF_PI + 0.2),
    (4, 1, [-30, 0, -1.75], 0), (4, 2, [-1.75, 0, 8], HALF_PI),
    (5, 1, [-1, 0, -1.75], 0), (5, 2, [-1.75, 0, 0.5], HALF_PI),
]  # fmt: skip
SCENE_OBJECTS = [
    dict(
        id=index,
        stage_id=stage_id,
        model_id="hatchback" if object_id == 1 else "delivery-van",
        object_id=object_id,
        label="White hatchback" if object_id == 1 else "Delivery van",
        position=[float(v) for v in position],
        rotation=[0.0, float(heading), 0.0],
        scale=[1.0, 1.0, 1.0],
    )
    for index, (stage_id, object_id, position, heading) in enumerate(PLACEMENTS, start=1)
]

ANNOTATIONS = [
    dict(id=1, reconstruction_id=1, stage_id=2, kind="measurement",
         data={"label": "Hatchback skid marks", "from": [-9.4, 0, -1.75], "to": [-1, 0, -1.75], "length_m": 8.4}),
    dict(id=2, reconstruction_id=1, stage_id=None, kind="viewpoint",
         data={"label": "Anita Desai's view", "position": [8, 1.6, -8], "target": [0, 0, 0]}),
    dict(id=3, reconstruction_id=1, stage_id=None, kind="note",
         data={"text": "Camera clock offset not yet checked against the signal controller."}),
]  # fmt: skip

# Audit history besides the uploads: (actor, action, record type, record, detail, at).
AUDIT = [
    (2, "viewed", "evidence", 4, None, at("10-04", "11:00:00")),
    (1, "reviewed", "event", 2, {"review_status": {"before": "pending", "after": "confirmed"}}, at("10-05", "10:15:00")),
    (1, "reviewed", "event", 3, {"review_status": {"before": "pending", "after": "confirmed"}}, at("10-05", "10:16:00")),
    (1, "modified", "case", 1, {"status": {"before": "open", "after": "in_progress"}}, at("10-05", "11:20:00")),
]

# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

# Rows added so far, by record type and the mock's id.
Rows = dict[str, dict[int, Any]]


def _insert(db: Session, rows: Rows, kind: str, model: type[Base], specs: list[dict], **refs: str) -> None:
    """Adds one row per spec. `refs` maps each column that holds a mock id (or a list
    of them) to the record type it points at; those become real ids."""
    added = rows.setdefault(kind, {})
    for spec in specs:
        values = dict(spec)
        key = values.pop("id")
        for column, target in refs.items():
            value = values[column]
            if isinstance(value, list):
                values[column] = [rows[target][v].id for v in value]
            elif value is not None:
                values[column] = rows[target][value].id
        added[key] = model(**values)
        db.add(added[key])
    db.flush()


def _point(rows: Rows, spec: dict, type_field: str, id_field: str) -> dict:
    """Resolves a polymorphic reference, such as a relationship's from_type and from_id."""
    return {**spec, id_field: rows[spec[type_field]][spec[id_field]].id}


def _chunk_for(db: Session, evidence_id: int, passage: str) -> EvidenceChunk:
    """The chunk of an evidence item that contains a passage. Matching ignores
    differences in whitespace, so it doesn't depend on how the indexer splits text."""
    chunks = db.scalars(
        select(EvidenceChunk).where(EvidenceChunk.evidence_id == evidence_id).order_by(EvidenceChunk.ordinal)
    ).all()
    normalised = " ".join(passage.split())
    for chunk in chunks:
        if passage in chunk.text or normalised in " ".join(chunk.text.split()):
            return chunk
    raise SeedError(f"Seed passage not found in evidence {evidence_id}: {passage}")


@contextmanager
def _without_gemini() -> Iterator[None]:
    """Blanks the Gemini key while seeding, so nothing the seed calls reaches Gemini."""
    settings = get_settings()
    key = settings.gemini_api_key
    settings.gemini_api_key = ""
    try:
        yield
    finally:
        settings.gemini_api_key = key


def seed(db: Session) -> None:
    """Loads the seed case and commits. Refuses if the database has any cases. If
    anything fails, rolls back and removes the files it stored."""
    if db.scalar(select(func.count()).select_from(Case)):
        raise SeedError("The database already has cases. Run `python -m app.seed --reset` to replace everything.")
    stored: list[str] = []
    try:
        with _without_gemini():
            _load(db, stored)
        db.commit()
    except BaseException:
        db.rollback()
        for file_path in stored:
            absolute_path(file_path).unlink(missing_ok=True)
        raise


def _load(db: Session, stored: list[str]) -> None:
    rows: Rows = {}

    def ref(kind: str, key: int) -> int:
        return rows[kind][key].id

    _insert(db, rows, "investigator", Investigator, INVESTIGATORS)

    # Case numbers are FX-<year>-<id padded to 4>, set after the insert as the API
    # does. An UPDATE that names updated_at keeps the seeded value instead of now.
    _insert(
        db,
        rows,
        "case",
        Case,
        [{**spec, "case_number": f"FX-PENDING-{spec['id']}"} for spec in CASES],
        lead_investigator_id="investigator",
        investigator_ids="investigator",
    )
    for case in rows["case"].values():
        db.execute(
            update(Case)
            .where(Case.id == case.id)
            .values(case_number=f"FX-{case.created_at.year}-{case.id:04d}", updated_at=case.updated_at)
        )

    # (actor, action, record type, row, case id, detail, at), written oldest first.
    audit: list[tuple[int, str, str, Any, int, dict | None, datetime]] = []

    rows["evidence"] = {}
    for spec in evidence_seeds():
        case_id = ref("case", spec.case_id)
        file = save_bytes(case_id, spec.file_name, spec.data)
        stored.append(file.file_path)
        evidence = Evidence(
            case_id=case_id,
            type=spec.type,
            title=spec.title,
            description=spec.description,
            notes="",
            file_path=file.file_path,
            mime_type=spec.mime_type,
            size_bytes=file.size_bytes,
            sha256=file.sha256,
            collected_at=spec.collected_at,
            source=spec.source,
            processing_status="done",
            summary=spec.summary,
            extracted_text=spec.text,
            created_at=spec.collected_at,
            processed_at=spec.collected_at + PROCESSING_TIME,
        )
        db.add(evidence)
        db.flush()
        rows["evidence"][spec.id] = evidence
        if spec.text:
            index_evidence(db, evidence.id, spec.pages or [spec.text], paged=spec.pages is not None)
        detail = {"title": spec.title, "file_name": spec.file_name, "sha256": file.sha256}
        audit.append((4, "uploaded", "evidence", evidence, case_id, detail, spec.collected_at))

    _insert(db, rows, "person", Person, PERSONS, case_id="case")
    _insert(db, rows, "object", CaseObject, OBJECTS, case_id="case")
    _insert(db, rows, "location", Location, LOCATIONS, case_id="case")
    _insert(db, rows, "event", Event, EVENTS, case_id="case", location_id="location")
    _insert(
        db,
        rows,
        "relationship",
        Relationship,
        [_point(rows, _point(rows, spec, "from_type", "from_id"), "to_type", "to_id") for spec in RELATIONSHIPS],
        case_id="case",
    )
    _insert(
        db,
        rows,
        "observation",
        Observation,
        [_point(rows, spec, "subject_type", "subject_id") for spec in OBSERVATIONS],
        case_id="case",
    )
    _insert(db, rows, "conflict", Conflict, CONFLICTS, case_id="case", observation_ids="observation")
    _insert(db, rows, "injury", Injury, INJURIES, case_id="case", person_id="person")

    for evidence_key, target_type, target_key, passage in LINKS:
        evidence_id = ref("evidence", evidence_key)
        db.add(
            EvidenceLink(
                evidence_id=evidence_id,
                chunk_id=_chunk_for(db, evidence_id, passage).id,
                target_type=target_type,
                target_id=ref(target_type, target_key),
                passage=passage,
            )
        )
    db.flush()

    _insert(db, rows, "reconstruction", Reconstruction, RECONSTRUCTIONS, case_id="case")
    _insert(db, rows, "stage", ReconstructionStage, STAGES, reconstruction_id="reconstruction", event_ids="event")
    _insert(db, rows, "scene_object", SceneObject, SCENE_OBJECTS, stage_id="stage", object_id="object")
    _insert(db, rows, "annotation", SceneAnnotation, ANNOTATIONS, reconstruction_id="reconstruction", stage_id="stage")

    for actor, action, record_type, record_key, detail, when in AUDIT:
        record = rows[record_type][record_key]
        case_id = record.id if record_type == "case" else record.case_id
        audit.append((actor, action, record_type, record, case_id, detail, when))
    audit.sort(key=lambda entry: entry[-1])
    for actor, action, record_type, record, case_id, detail, when in audit:
        entry = record_audit(db, ref("investigator", actor), action, record_type, record.id, case_id=case_id, detail=detail)
        entry.at = when
    db.flush()


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------


def reset_database() -> None:
    """Drops and recreates every table, stamps the schema as the current Alembic
    head, and removes the stored evidence files (the storage/<case_id>/ folders)."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    command.stamp(Config(str(BACKEND_DIR / "alembic.ini")), "head")
    for folder in storage_root().iterdir():
        if folder.is_dir() and folder.name.isdigit():
            shutil.rmtree(folder)


def table_counts(db: Session) -> dict[str, int]:
    tables = {
        "investigators": Investigator,
        "cases": Case,
        "evidence files": Evidence,
        "text chunks": EvidenceChunk,
        "evidence links": EvidenceLink,
        "persons": Person,
        "objects": CaseObject,
        "locations": Location,
        "events": Event,
        "relationships": Relationship,
        "observations": Observation,
        "conflicts": Conflict,
        "injuries": Injury,
        "reconstructions": Reconstruction,
        "stages": ReconstructionStage,
        "scene objects": SceneObject,
        "annotations": SceneAnnotation,
        "audit entries": AuditLog,
    }
    return {name: db.scalar(select(func.count()).select_from(model)) or 0 for name, model in tables.items()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.seed", description="Load the Evidentia seed case.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="drop and recreate every table, and delete stored evidence files, before seeding",
    )
    args = parser.parse_args(argv)

    if args.reset:
        reset_database()
    elif not inspect(engine).has_table(Case.__tablename__):
        print("The database has no tables. Run `alembic upgrade head` first, or use --reset.", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        try:
            seed(db)
        except SeedError as error:
            print(error, file=sys.stderr)
            return 1
        counts = table_counts(db)
    print("Seeded " + ", ".join(f"{count} {name}" for name, count in counts.items()) + ".")
    return 0


if __name__ == "__main__":
    sys.exit(main())
