"""The Sahyadri Chowk case: the complete road-accident case the seed loads, built
from the files in docs/demo-case/evidence (see docs/demo-case/README.md).

It holds the records the pipeline and an investigator would have produced from those
13 files: persons, vehicles, phones, locations, the timeline from 21:47 to 23:25,
relationships, the statements behind every disagreement and the conflicts between
them, the injuries for the anatomy view, and the source passage of each record.
app/seed.py loads it with the rest of the seed and then runs the real reconstruction
generator and report builder on it, so its scenarios, scene and report come from
these records the same way they would for an uploaded case.

Every passage in LINKS is quoted from the cleaned text of its file, as stored.
Record ids here are the seed's own keys (101 and up), which the loader maps to
real ids.
"""

import re
from datetime import datetime

from app.core.config import REPO_ROOT

EVIDENCE_DIR = REPO_ROOT / "docs" / "demo-case" / "evidence"

# One PDF page holds at most this much text, so each page indexes as one chunk.
PAGE_CHARS = 1900

INVESTIGATOR = {"origin": "investigator", "review_status": "confirmed"}
AI_PENDING = {"origin": "ai", "review_status": "pending"}
AI_CONFIRMED = {"origin": "ai", "review_status": "confirmed"}

CASE_KEY = 5
LEAD = 5


def aug(day: int, time: str) -> datetime:
    """A local time in IST in August 2026."""
    return datetime.fromisoformat(f"2026-08-{day:02d}T{time}+05:30")


def plain_text(markdown: str) -> str:
    """The file's text as a reader sees it: headings, bold and code marks removed,
    table rows as cells joined by " | ", table rules dropped."""
    lines = []
    for raw in markdown.splitlines():
        line = raw.strip()
        if re.fullmatch(r"\|?\s*:?-{3,}.*", line):
            continue
        if line.startswith("|"):
            line = " | ".join(cell.strip() for cell in line.strip("|").split("|"))
        line = re.sub(r"^#+\s*", "", line)
        line = line.replace("**", "").replace("`", "")
        if line == "---":
            line = ""
        lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def paginate(text: str, limit: int = PAGE_CHARS) -> list[str]:
    """Packs paragraphs onto pages of at most `limit` characters."""
    pages: list[str] = []
    current = ""
    for paragraph in text.split("\n\n"):
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if current and len(candidate) > limit:
            pages.append(current)
            current = paragraph
        else:
            current = candidate
    if current:
        pages.append(current)
    return pages


# (key, file, type, title, description, source, collected_at, summary)
EVIDENCE = [
    (101, "01_fir_and_scene_report.md", "document", "FIR 0287/2026 and spot panchanama",
     "First information report with the total-station scene survey, skid marks and rest positions.",
     "PSI Anil Pawar, Kothrud Police Station", aug(14, "23:50:00"),
     "Sedan MH12 KE 4417 eastbound on Karve Road and auto-rickshaw MH12 QR 2208 southbound on Lane 7 collided at "
     "Sahyadri Chowk. Sedan skid marks 13.4 m ending at the point of impact (+1.6 E, +1.7 N). The auto came to rest "
     "on its left side. Passenger thrown out. FIR time 'about 22:15' is the reporting time."),
    (102, "02_statement_rajesh_menon.md", "statement", "Statement: Rajesh Menon (sedan driver)",
     "Driver of the Honda City, recorded at Kothrud Police Station.", "Recorded by PSI Anil Pawar",
     aug(15, "11:20:00"),
     "Says the signal was amber, he drove at about 40 km/h, was alone, and his phone was on Bluetooth. Describes "
     "the car as silver-grey and says he left the office at about 21:55."),
    (103, "03_statement_santosh_jadhav.md", "statement", "Statement: Santosh Jadhav (auto-rickshaw driver)",
     "Owner-driver of the auto-rickshaw, recorded at his hospital bedside.", "Recorded by PSI Anil Pawar",
     aug(15, "09:40:00"),
     "Says he moved off when his light turned green, at low speed, and a white Honda City came fast from his right. "
     "Says the car driver was alone."),
    (104, "04_statement_pradeep_shinde.md", "statement", "Statement: Pradeep Shinde (eyewitness, informant)",
     "Tea stall owner at the north-west corner.", "Recorded by PSI Anil Pawar", aug(14, "23:05:00"),
     "Karve Road was red some seconds before; the white Honda City came very fast (60 or 70). A young woman in a "
     "blue kurta got out of the front passenger seat and left. Called 112."),
    (105, "05_statement_neha_bhosale.md", "statement", "Statement: Neha Bhosale (scooter rider)",
     "Rode behind the sedan on Karve Road.", "Recorded by PSI Anil Pawar", aug(15, "14:00:00"),
     "The sedan overtook her across the double line about 150 m before the junction at 60 km/h or more, with the "
     "Karve Road signal red. Saw the driver's face lit by a screen."),
    (106, "06_signal_controller_log.md", "document", "Signal controller log, junction J-17-09",
     "GPS-synchronised controller log, 22:12 to 22:15.", "PMC Traffic Signal Cell", aug(16, "12:00:00"),
     "Karve Road amber 22:13:41, red 22:13:44; Lane 7 green 22:13:47. At the 22:13:49 collision Karve Road had been "
     "red for 5 s and Lane 7 green for 2 s. No faults."),
    (107, "07_cctv_analysis_report.md", "video", "CCTV analysis, cameras KR-CAM-07 and KR-CAM-09",
     "Key frames, timings and speed estimates from two synchronised junction cameras.",
     "Traffic Branch Video Analysis Cell", aug(17, "16:00:00"),
     "Sedan at about 65 km/h crosses the stop line 4.7 s into its red; auto crosses on green at 17 km/h; impact "
     "22:13:49.4. Two people leave the sedan; the person in blue leaves the scene at 22:16:35."),
    (108, "08_vehicle_event_data_recorder.md", "document", "Event data recorder, Honda City MH12 KE 4417",
     "Airbag control module download with pre-crash data and seat sensors.", "FSL Pune, Dr Anjali Phadke",
     aug(18, "15:00:00"),
     "66 km/h until 1.0 s before impact, brake 0.9 s before, no evasive steering. Front passenger seat occupied and "
     "belted. Call on the phone's own speaker, not the car's hands-free."),
    (109, "09_emergency_call_112_transcript.md", "audio", "Emergency call 112 (transcript)",
     "Call from Pradeep Shinde at 22:14:21, 2 min 08 s.", "Pune 112 control room", aug(15, "10:00:00"),
     "Caller reports a white Honda City came through the red light, an injured woman on the road and the auto "
     "driver trapped; a girl got out of the car and is leaving."),
    (110, "10_medical_report_meera_kulkarni.md", "medical", "Medico-legal report: Meera Kulkarni",
     "Emergency examination of the auto-rickshaw passenger.", "Sahyadri Hospital, Dr Kavita Rao",
     aug(15, "10:30:00"),
     "Frontal bone fracture with forehead laceration, displaced left clavicle fracture, right 4th to 6th rib "
     "fractures with right lung contusion, abrasions. Grievous."),
    (111, "11_medical_report_santosh_jadhav_and_rajesh_menon.md", "medical",
     "Medico-legal reports: Santosh Jadhav and Rajesh Menon", "Two patients in one report.",
     "Sahyadri Hospital, Dr Kavita Rao", aug(15, "11:00:00"),
     "Jadhav: displaced fracture of the left tibia and fibula, no alcohol. Menon: seat-belt bruise, breath alcohol "
     "18 mg per 100 ml (limit 30), discharged."),
    (112, "12_motor_vehicle_inspection_report.md", "document", "Motor vehicle inspection, both vehicles",
     "RTO inspection at the police station yard.", "MVI S. R. Deshpande, RTO Pune", aug(16, "17:00:00"),
     "Both vehicles mechanically sound. Sedan is white (Arctic White), damage at the front right corner; auto "
     "crushed on its right side. Phone holder on the sedan's dashboard."),
    (113, "13_call_detail_records_rajesh_menon.md", "document", "Call detail records: Rajesh Menon",
     "Calls and messages, 21:30 to 22:30.", "Jio nodal officer, Pune circle", aug(19, "18:00:00"),
     "Call home at 21:47 ('left office'). Incoming call from Priya Nair answered at 22:12:58 and in progress at "
     "impact; ended 22:14:39."),
]  # fmt: skip


def evidence_texts() -> dict[int, list[str]]:
    """Each file's cleaned text, as PDF pages."""
    return {key: paginate(plain_text((EVIDENCE_DIR / name).read_text("utf-8"))) for key, name, *_ in EVIDENCE}


INVESTIGATORS = [
    dict(id=5, name="PSI Anil Pawar", badge_number="PNE-1187", role="Investigating Officer", clearance_level="Level 3"),
]

CASE = dict(
    id=CASE_KEY,
    title="Red-light collision at Sahyadri Chowk, Karve Road, Kothrud",
    incident_type="road_accident",
    status="in_progress",
    priority="high",
    description=(
        "Sedan and auto-rickshaw collide at a signalised junction. Two drivers give opposite accounts of the signal. "
        "FIR 0287/2026, Kothrud Police Station."
    ),
    incident_at=aug(14, "22:13:49"),
    lead_investigator_id=LEAD,
    investigator_ids=[LEAD, 2, 3, 4],
    created_at=aug(14, "22:40:00"),
    updated_at=datetime.fromisoformat("2026-10-10T18:30:00+05:30"),
)

PERSONS = [
    dict(id=101, role="victim", name="Meera Kulkarni", age=34, occupation="School teacher", condition="injured",
         contact="", notes="Passenger in the auto-rickshaw, thrown onto the road. Grievous injuries.", **INVESTIGATOR),
    dict(id=102, role="victim", name="Santosh Jadhav", age=52, occupation="Auto-rickshaw owner-driver",
         condition="injured", contact="",
         notes="Driver of the auto-rickshaw. Says he moved off on green. Trapped under the auto; fractured left leg.",
         **INVESTIGATOR),
    dict(id=103, role="other", name="Rajesh Menon", age=41, occupation="Senior manager, Menon Analytics Pvt. Ltd.",
         condition="injured", contact="",
         notes="Driver of the Honda City. Says the signal was amber, he drove at about 40 km/h and was alone.",
         **INVESTIGATOR),
    dict(id=104, role="witness", name="Pradeep Shinde", age=47, occupation="Owner, Shinde Tea Stall",
         condition="uninjured", contact="", notes="Informant. Watched from the north-west corner and called 112.",
         **INVESTIGATOR),
    dict(id=105, role="witness", name="Neha Bhosale", age=29, occupation="Physiotherapist", condition="uninjured",
         contact="", notes="Rode a scooter behind the sedan; was overtaken across the double line.", **INVESTIGATOR),
    dict(id=106, role="witness", name="Unidentified woman in a blue kurta", age=None, occupation="",
         condition=None, contact="",
         notes="Seen leaving the sedan's front passenger door and the scene before the police arrived.",
         **AI_PENDING),
    dict(id=107, role="other", name="Priya Nair", age=29, occupation="Office colleague of Rajesh Menon",
         condition=None, contact="",
         notes="Was on a call with Rajesh Menon at the moment of impact. Statement not yet recorded.", **AI_PENDING),
]  # fmt: skip
for _p in PERSONS:
    _p.update(case_id=CASE_KEY, details={})

OBJECTS = [
    dict(id=101, kind="vehicle", label="White Honda City",
         details={"plate": "MH12 KE 4417", "make": "Honda City sedan", "colour": "White"}, **INVESTIGATOR),
    dict(id=102, kind="vehicle", label="Auto-rickshaw",
         details={"plate": "MH12 QR 2208", "make": "CNG auto-rickshaw", "colour": "Black and yellow"}, **INVESTIGATOR),
    dict(id=103, kind="vehicle", label="Honda Activa scooter",
         details={"plate": "MH12 ZB 9031", "make": "Honda Activa", "colour": "Grey"}, **INVESTIGATOR),
    dict(id=104, kind="phone", label="Rajesh Menon's phone",
         details={"number": "ending 4471", "make": "iPhone (paired as \"Rajesh iPhone\")"}, **AI_CONFIRMED),
    dict(id=105, kind="item", label="Passenger's handbag and phone", details={}, **AI_PENDING),
]  # fmt: skip
for _o in OBJECTS:
    _o["case_id"] = CASE_KEY

# Survey offsets (metres east, north of the junction centre) as latitude and longitude.
LAT0, LNG0 = 18.5058, 73.8083


def _ll(east: float, north: float) -> tuple[float, float]:
    return round(LAT0 + north / 111_320, 6), round(LNG0 + east / 105_570, 6)


LOCATIONS = [
    dict(id=101, kind="incident_site", address="Sahyadri Chowk, Karve Road and Lane 7, Kothrud, Pune", ll=(0, 0)),
    dict(id=102, kind="witness_position", address="Shinde Tea Stall, north-west corner", ll=(-6.0, 7.0)),
    dict(id=103, kind="vehicle_position", address="Honda City rest position, north-east of the impact", ll=(4.2, 2.5)),
    dict(id=104, kind="vehicle_position", address="Auto-rickshaw rest position, on its left side", ll=(5.8, -0.9)),
    dict(id=105, kind="witness_position", address="Neha Bhosale's scooter, 30 m short of the west stop line",
         ll=(-38.0, 1.75)),
]  # fmt: skip
for _l in LOCATIONS:
    _l["lat"], _l["lng"] = _ll(*_l.pop("ll"))
    _l.update(case_id=CASE_KEY, geometry=None, building_id=None, **INVESTIGATOR)


def _event(id, time, category, description, *, precision="exact", certainty="established", note=None,
           location=101, review=INVESTIGATOR, end=None, day=14):
    return dict(id=id, case_id=CASE_KEY, location_id=location, category=category, time_start=aug(day, time),
                time_end=aug(day, end) if end else None, time_precision=precision, certainty=certainty,
                description=description, ai_note=note, **review)  # fmt: skip


EVENTS = [
    _event(101, "21:47:12", "other", "Rajesh Menon calls home from the office area (call record notes \"left office\")",
           location=None, review=AI_CONFIRMED,
           note="His statement says he left at about 21:55; the call record puts him leaving by 21:47."),
    _event(102, "22:10:00", "movement", "Auto-rickshaw picks up Meera Kulkarni near the Mayur Colony bus stop",
           precision="approximate", location=None),
    _event(103, "22:12:58", "other", "Rajesh Menon answers a call from Priya Nair on the phone's own speaker",
           review=AI_CONFIRMED, location=None, end="22:14:39"),
    _event(104, "22:13:03", "other", "Karve Road (east-west) signal turns green"),
    _event(105, "22:13:41", "other", "Karve Road signal turns amber"),
    _event(106, "22:13:44", "other", "Karve Road signal turns red; all-red clearance begins"),
    _event(107, "22:13:45", "movement", "Honda City crosses the double white line to overtake Neha Bhosale's scooter",
           review=AI_CONFIRMED),
    _event(108, "22:13:47", "other", "Lane 7 (north-south) signal turns green; the auto-rickshaw starts moving"),
    _event(109, "22:13:48.100", "movement", "Auto-rickshaw crosses the Lane 7 north stop line at about 17 km/h",
           review=AI_CONFIRMED),
    _event(110, "22:13:48.500", "movement", "Honda City brakes about 11 m before the stop line, at 66 km/h",
           review=AI_CONFIRMED),
    _event(111, "22:13:48.700", "movement",
           "Honda City crosses the Karve Road west stop line, 4.7 s after its signal turned red", certainty="disputed",
           review=AI_CONFIRMED,
           note="Rajesh Menon says his light was amber. The signal log, both synchronised cameras, Pradeep Shinde and "
                "Neha Bhosale put it at red."),
    _event(112, "22:13:49.400", "collision",
           "Honda City's front right corner strikes the right side of the auto-rickshaw"),
    _event(113, "22:13:51", "movement",
           "Auto-rickshaw rolls onto its left side; Meera Kulkarni is thrown onto the road"),
    _event(114, "22:13:58", "witness", "Rajesh Menon gets out of the sedan holding something to his ear",
           review=AI_CONFIRMED),
    _event(115, "22:14:02", "witness", "A person in a blue garment gets out of the sedan's front passenger door",
           certainty="disputed", review=AI_PENDING,
           note="Rajesh Menon and Santosh Jadhav say he was alone. The event data recorder sensed a belted adult in "
                "the front passenger seat."),
    _event(116, "22:14:21", "emergency", "Pradeep Shinde calls 112", location=102),
    _event(117, "22:16:35", "witness", "The person in blue boards a passing auto-rickshaw and leaves the scene",
           certainty="hypothesis", review=AI_PENDING),
    _event(118, "22:21:00", "emergency", "PCR Van Kothrud-3 arrives"),
    _event(119, "22:26:00", "emergency", "Ambulance 108 arrives", precision="minute"),
    _event(120, "22:34:00", "investigation",
           "PSI Anil Pawar takes over the scene; the survey records 13.4 m of sedan skid marks", precision="minute"),
    _event(121, "22:41:00", "medical", "Meera Kulkarni and Santosh Jadhav arrive at Sahyadri Hospital",
           precision="minute", location=None),
    _event(122, "23:25:00", "medical",
           "Breath test on Rajesh Menon: 18 mg per 100 ml, under the 30 mg limit", precision="minute",
           location=None),
]  # fmt: skip


def _rel(id, from_type, from_id, to_type, to_id, kind, label, *, confidence=None, flagged=False, notes="",
         review=INVESTIGATOR):
    return dict(id=id, case_id=CASE_KEY, from_type=from_type, from_id=from_id, to_type=to_type, to_id=to_id,
                kind=kind, label=label, confidence=confidence, flagged=flagged, notes=notes, **review)  # fmt: skip


RELATIONSHIPS = [
    _rel(101, "person", 103, "object", 101, "drove", "Driver"),
    _rel(102, "person", 102, "object", 102, "drove", "Driver"),
    _rel(103, "person", 105, "object", 103, "drove", "Rider"),
    _rel(104, "person", 101, "object", 102, "involved_in", "Passenger"),
    _rel(105, "object", 101, "location", 101, "involved_in", "Struck the auto in the junction"),
    _rel(106, "object", 102, "location", 101, "involved_in", "Struck on its right side; rolled"),
    _rel(107, "person", 104, "location", 101, "witnessed", "From the tea stall"),
    _rel(108, "person", 105, "location", 101, "witnessed", "From the west approach"),
    _rel(109, "person", 103, "object", 104, "owns", "His phone"),
    _rel(110, "person", 107, "person", 103, "other", "On a call at the moment of impact", confidence=0.9,
         review=AI_PENDING),
    _rel(111, "person", 106, "object", 101, "other", "Front passenger?", confidence=0.7, flagged=True,
         notes="EDR and CCTV say an adult was in the front passenger seat; the driver says he was alone.",
         review=AI_PENDING),
    _rel(112, "evidence", 102, "evidence", 106, "contradicts", "Amber vs red", confidence=0.95, flagged=True,
         review=AI_PENDING),
    _rel(113, "evidence", 102, "evidence", 108, "contradicts", "40 km/h vs 66 km/h", confidence=0.95, flagged=True,
         review=AI_PENDING),
    _rel(114, "evidence", 107, "evidence", 106, "supports", "Same clock; red for 4.7 s", confidence=0.9,
         review=AI_CONFIRMED),
    _rel(115, "evidence", 113, "person", 107, "mentions", "Caller at 22:12:58", confidence=0.9, review=AI_CONFIRMED),
    _rel(116, "person", 102, "person", 103, "contradicts", "Opposite accounts of the signal", confidence=0.9,
         flagged=True, review=AI_PENDING),
]  # fmt: skip


def _obs(id, subject_type, subject_id, statement, time, review=AI_PENDING, day=14):
    return dict(id=id, case_id=CASE_KEY, subject_type=subject_type, subject_id=subject_id, statement=statement,
                observed_at=aug(day, time), author_id=None, **review)  # fmt: skip


OBSERVATIONS = [
    _obs(101, "object", 101, "The sedan's signal was amber when it crossed the stop line.", "22:13:48"),
    _obs(102, "object", 101, "Karve Road had been red for 4.7 seconds when the sedan crossed the stop line.",
         "22:13:48", AI_CONFIRMED),
    _obs(103, "object", 101, "The Karve Road signal had turned red some seconds before the crash.", "22:13:48"),
    _obs(104, "object", 101, "The sedan was travelling at about 40 km/h.", "22:13:47"),
    _obs(105, "object", 101, "The sedan was recorded at 66 km/h until 1.0 s before impact.", "22:13:47",
         AI_CONFIRMED),
    _obs(106, "object", 101, "The sedan was going sixty or seventy.", "22:13:47"),
    _obs(107, "person", 103, "Rajesh Menon says he was not using his phone and it was connected to Bluetooth.",
         "22:13:49"),
    _obs(108, "person", 103, "The call was routed to the phone's own speaker, not the car's hands-free system.",
         "22:13:49", AI_CONFIRMED),
    _obs(109, "person", 103, "Rajesh Menon says he was alone in the car.", "22:14:00"),
    _obs(110, "object", 101, "The front passenger seat was occupied by a belted adult at the time of the event.",
         "22:14:00", AI_CONFIRMED),
    _obs(111, "person", 106, "A young woman in a blue kurta got out of the sedan's front passenger seat.",
         "22:14:02"),
    _obs(112, "object", 101, "The sedan is silver-grey.", "22:13:49"),
    _obs(113, "object", 101, "The sedan is white (Arctic White), as on its registration certificate.", "22:13:49",
         AI_CONFIRMED),
    _obs(114, "location", 101, "The FIR records the time of the incident as about 22:15.", "22:15:00"),
    _obs(115, "location", 101, "The collision happened at 22:13:49 by the GPS-synchronised controller and cameras.",
         "22:13:49", AI_CONFIRMED),
    _obs(116, "person", 103, "Rajesh Menon says he left the office at about 21:55.", "21:55:00"),
    _obs(117, "person", 103, "Rajesh Menon called home at 21:47:12, noted as \"left office\".", "21:47:12",
         AI_CONFIRMED),
]  # fmt: skip

CONFLICTS = [
    dict(id=101, observation_ids=[101, 102, 103], status="open",
         description="Rajesh Menon says the sedan's signal was amber; the signal log, CCTV and Pradeep Shinde put it "
                     "at red."),
    dict(id=102, observation_ids=[104, 105, 106], status="open",
         description="Rajesh Menon says about 40 km/h; the event data recorder, CCTV and witnesses say 60 to 66 km/h."),
    dict(id=103, observation_ids=[107, 108], status="open",
         description="Rajesh Menon says the call was on Bluetooth; the head unit log says it was on the phone's own "
                     "speaker."),
    dict(id=104, observation_ids=[109, 110, 111], status="open",
         description="Rajesh Menon says he was alone; the seat sensor, CCTV and Pradeep Shinde indicate a front "
                     "passenger, whose identity is unknown."),
    dict(id=105, observation_ids=[112, 113], status="open",
         description="Rajesh Menon describes the sedan as silver-grey; the inspection and three witnesses say white."),
    dict(id=106, observation_ids=[114, 115], status="resolved",
         description="The FIR gives about 22:15; the instruments give 22:13:49. The FIR time is when it was reported."),
    dict(id=107, observation_ids=[116, 117], status="open",
         description="Rajesh Menon says he left the office at about 21:55; his call record suggests he had left by "
                     "21:47."),
]  # fmt: skip
for _c in CONFLICTS:
    _c["case_id"] = CASE_KEY


def _injury(id, person, region, structure, type, severity, description, depth=None, review=AI_CONFIRMED):
    return dict(id=id, case_id=CASE_KEY, person_id=person, body_region=region, structure_id=structure, type=type,
                severity=severity, depth=depth, estimated_time=aug(14, "22:13:49"), description=description,
                **review)  # fmt: skip


INJURIES = [
    _injury(101, 101, "head", "frontal_bone", "Fracture", "severe",
            "Linear, undisplaced fracture of the frontal bone on the right side, under a 5 cm forehead laceration."),
    _injury(102, 101, "left_shoulder", "clavicle_left", "Fracture", "severe",
            "Displaced fracture of the middle third of the left clavicle."),
    _injury(103, 101, "chest", "lung_right", "Contusion", "moderate",
            "Small right-sided pulmonary contusion; no pneumothorax."),
    _injury(104, 101, "chest", None, "Fracture", "severe",
            "Fractures of the right 4th, 5th and 6th ribs (posterolateral). Ribs aren't modelled, so this is regional."),
    _injury(105, 101, "left_arm", None, "Abrasion", "minor", "Abrasion on the outer left forearm.", depth="6 cm by 2 cm",
            review=AI_PENDING),
    _injury(106, 101, "right_leg", None, "Abrasion", "minor", "Abrasion of the right knee.", depth="3 cm by 3 cm",
            review=AI_PENDING),
    _injury(107, 102, "left_leg", None, "Fracture", "severe",
            "Closed, displaced fracture of the left tibia and fibula in the middle third. The tibia isn't modelled."),
    _injury(108, 102, "left_arm", None, "Abrasion", "minor", "Crush abrasion over the back of the left hand.",
            depth="4 cm"),
    _injury(109, 103, "chest", None, "Bruising", "minor",
            "Diagonal seat-belt bruise across the left chest and right shoulder, about 18 cm."),
]  # fmt: skip

# (evidence, target type, target, passage). Each passage is quoted from the cleaned text.
LINKS = [
    # Persons and objects
    (101, "person", 101, "It was travelling southbound on Lane 7 with one passenger, Meera Kulkarni, 34, a school teacher of Mayur Colony."),
    (101, "person", 102, "registration MH12 QR 2208, black and yellow, owner-driver Santosh Jadhav, 52, of Bhusari Colony, Kothrud."),
    (101, "person", 103, "Driven by Rajesh Menon, 41, of Flat 402, Sai Heights, Kothrud."),
    (104, "person", 104, "I run Shinde Tea Stall at the north-west corner of Sahyadri Chowk."),
    (105, "person", 105, "I am Neha Bhosale, 29 years old, working as a physiotherapist at a clinic on Karve Road."),
    (104, "person", 106, "I also saw a young woman get out of the front passenger seat of the white car. She was wearing a blue kurta."),
    (113, "person", 107, "Number ending 3382 (subscriber: Priya Nair, 29, Baner, Pune)"),
    (101, "object", 101, "Vehicle A: White Honda City sedan, registration MH12 KE 4417"),
    (112, "object", 101, "White (Arctic White). The registration certificate says \"White\"."),
    (101, "object", 102, "Vehicle B: CNG auto-rickshaw (three-wheeler), registration MH12 QR 2208"),
    (101, "object", 103, "Vehicle C (not involved in the collision): Honda Activa scooter, registration MH12 ZB 9031"),
    (108, "object", 104, "a phone paired by Bluetooth named \"Rajesh iPhone\""),
    (101, "object", 105, "Passenger's handbag and phone | +3.4, -0.2 | Thrown clear of the auto"),
    # Locations
    (101, "location", 101, "Sahyadri Chowk, the four-way junction of Karve Road (east-west) and Lane 7 (north-south), Kothrud, Pune."),
    (101, "location", 102, "Shinde Tea Stall (witness position) | -6.0, +7.0 | North-west corner, about 9 m from the point of impact"),
    (101, "location", 103, "Honda City MH12 KE 4417, final rest, centre of vehicle | +4.2, +2.5"),
    (101, "location", 104, "Auto-rickshaw MH12 QR 2208, final rest, centre of vehicle | +5.8, -0.9 | Lying on its left side"),
    (105, "location", 105, "I stopped my scooter about 30 metres short of the line."),
    # Events
    (113, "event", 101, "21:47:12 | Outgoing call | Number ending 9026 (saved as \"Home\") | 00:01:02 | Left office"),
    (103, "event", 102, "I picked up one lady passenger, Meera madam, near the Mayur Colony bus stop."),
    (113, "event", 103, "22:12:58 | Incoming call, answered"),
    (108, "event", 103, "The log shows the call was routed to the phone's own speaker, not through the car's hands-free system, from 22:12:58 onward."),
    (106, "event", 104, "22:13:03 | Phase 1 green | East-west green begins"),
    (106, "event", 105, "22:13:41 | Phase 1 amber | East-west amber begins (38 s of green completed)"),
    (106, "event", 106, "22:13:44 | Phase 1 red | East-west red begins. North-south still red"),
    (107, "event", 107, "The sedan has crossed the double white line to overtake the scooter immediately before this frame"),
    (105, "event", 107, "a car came up behind me and overtook me on the right, crossing the double line in the middle of the road."),
    (106, "event", 108, "22:13:47 | Phase 2 green | North-south green begins"),
    (107, "event", 108, "Lane 7 signal turns green. Waiting vehicles on the north approach start moving."),
    (107, "event", 109, "Auto-rickshaw MH12 QR 2208 front axle crosses the north stop line, travelling south at an estimated 17 km/h"),
    (107, "event", 110, "Sedan brake lights come on (frame 3 of the second 48). The sedan is about 11 m before the stop line"),
    (108, "event", 110, "Brake first applied about 0.9 seconds before impact."),
    (107, "event", 111, "Sedan front crosses the west stop line. The signal for its direction has been red for 4.7 seconds"),
    (107, "event", 112, "Impact. The sedan's front right corner strikes the auto's right side as the auto is entering the junction"),
    (101, "event", 112, "Point of impact (debris cluster centre, glass and plastic fragments) | +1.6, +1.7"),
    (107, "event", 113, "The auto-rickshaw is pushed east-south-east and rolls onto its left side. A person is thrown out of the auto."),
    (107, "event", 114, "The sedan driver's door opens and a man steps out holding something to his ear"),
    (107, "event", 115, "The sedan's front passenger door opens and a person in a blue garment steps out and moves to the driver"),
    (109, "event", 116, "22:14:21 | Operator | 112, Pune. What is your emergency?"),
    (107, "event", 117, "The person in the blue garment boards a passing auto-rickshaw further down Karve Road and leaves the scene"),
    (107, "event", 118, "PCR Van Kothrud-3 arrives"),
    (109, "event", 119, "Ambulance 108 arrival logged at scene at 22:26."),
    (101, "event", 120, "Marks end at the point of impact. Total measured length 13.4 m"),
    (110, "event", 121, "Date and time of arrival | 14 August 2026, 22:41 hrs"),
    (111, "event", 122, "Breath alcohol (evidential breath analyser), 23:25 hrs: 18 mg per 100 ml of blood"),
    # Observations
    (102, "observation", 101, "I am sure the light was amber and had not turned red when I went over the line."),
    (107, "observation", 102, "The sedan entered the junction 4.7 seconds after its signal turned red"),
    (104, "observation", 103, "The signal for Karve Road, the east-west road, had turned red some seconds before."),
    (102, "observation", 104, "I was driving at about 40 kilometres per hour, which is the limit on that road."),
    (108, "observation", 105, "The vehicle was recorded at 66 km/h, which is 26 km/h over the limit, up to 1.0 s before impact."),
    (104, "observation", 106, "I think it was going sixty or seventy, I cannot say exactly."),
    (102, "observation", 107, "I may have received a call just before, but my phone was connected to the car's Bluetooth and I was not holding it."),
    (108, "observation", 108, "The head unit's \"call routed to car\" state was not set at any time in the log period."),
    (102, "observation", 109, "I was alone in the car."),
    (108, "observation", 110, "The occupant classification sensor and the seat belt buckle switch both indicate that an adult occupied the front passenger seat at the time of the event."),
    (104, "observation", 111, "I also saw a young woman get out of the front passenger seat of the white car. She was wearing a blue kurta."),
    (102, "observation", 112, "a silver-grey Honda City, registration MH12 KE 4417"),
    (112, "observation", 113, "White (Arctic White). The registration certificate says \"White\"."),
    (101, "observation", 114, "Reported as about 22:15 hrs (see note 1)"),
    (106, "observation", 115, "At the time of collision, recorded by the junction CCTV as 22:13:49, the Karve Road (east-west) signal had been red for 5 seconds"),
    (102, "observation", 116, "I left the office at about 21:55 and took Karve Road towards Kothrud."),
    (113, "observation", 117, "21:47:12 | Outgoing call | Number ending 9026 (saved as \"Home\") | 00:01:02 | Left office"),
    # Relationships
    (102, "relationship", 112, "I am sure the light was amber and had not turned red when I went over the line."),
    (106, "relationship", 112, "the Karve Road (east-west) signal had been red for 5 seconds"),
    (108, "relationship", 113, "The vehicle was recorded at 66 km/h"),
    (108, "relationship", 111, "Front passenger seat occupant classification | Occupied (adult-class occupant sensed)"),
    (113, "relationship", 110, "The incoming call from Priya Nair was in progress at the moment of impact (22:13:49)."),
    # Injuries
    (110, "injury", 101, "CT head shows a linear, undisplaced fracture of the frontal bone on the right side."),
    (110, "injury", 102, "X-ray shows a displaced fracture of the middle third (midshaft) of the left clavicle."),
    (110, "injury", 103, "with a small right-sided pulmonary contusion in the right lung."),
    (110, "injury", 104, "X-ray shows fractures of the right 4th, 5th and 6th ribs (posterolateral)"),
    (110, "injury", 105, "An abrasion of 6 cm by 2 cm on the outer side of the left forearm."),
    (110, "injury", 106, "Right knee: Abrasion of 3 cm by 3 cm."),
    (111, "injury", 107, "X-ray shows a closed, displaced fracture of the left tibia and fibula in the middle third."),
    (111, "injury", 108, "Crush abrasion over the back of the left hand, 4 cm."),
    (111, "injury", 109, "A diagonal linear bruise (seat-belt mark) across the left side of the chest and the right shoulder, about 18 cm long."),
]  # fmt: skip

# Audit history besides the uploads: (actor, action, record type, record, detail, at).
AUDIT = [
    (5, "viewed", "evidence", 108, None, aug(18, "16:10:00")),
    (5, "reviewed", "event", 111, {"review_status": {"before": "pending", "after": "confirmed"}}, aug(19, "10:05:00")),
    (5, "reviewed", "observation", 102, {"review_status": {"before": "pending", "after": "confirmed"}}, aug(19, "10:08:00")),
    (2, "reviewed", "relationship", 114, {"review_status": {"before": "pending", "after": "confirmed"}}, aug(19, "10:20:00")),
    (5, "modified", "conflict", 106, {"status": {"before": "open", "after": "resolved"}}, aug(19, "11:00:00")),
    (3, "reviewed", "injury", 101, {"review_status": {"before": "pending", "after": "confirmed"}}, aug(19, "12:30:00")),
    (5, "modified", "case", CASE_KEY, {"status": {"before": "open", "after": "in_progress"}}, aug(15, "09:00:00")),
]  # fmt: skip

# When the scenarios were generated from the records above. Nothing in the case
# changes after it, so they start in step with the case.
GENERATED_AT = aug(20, "10:00:00")
REPORT_AT = aug(20, "10:30:00")


# ---------------------------------------------------------------------------
# Scene script: what Gemini's planner would write for this case, in the same format,
# so the real checker and compiler build the scenarios and the 3D scene from it.
# Positions are the survey's metres east and north of the junction centre; times
# and speeds come from the signal log, CCTV and event data recorder.
# ---------------------------------------------------------------------------


def scene_script(ref) -> dict:
    """The scene script, with the case's real record ids. `ref(kind, key)` maps a
    seed key to the id of the row the loader added."""

    def p(east, north):
        return {"east": east, "north": north}

    def src(evidence, passage):
        return {"evidence_id": ref("evidence", evidence), "passage": passage}

    def events(*keys):
        return [ref("event", k) for k in keys]

    def place(entity, east, north, heading, pose="standing", note=""):
        return {"ref": entity, "position": p(east, north), "heading_deg": heading, "pose": pose, "note": note}

    inside = "driving"  # people inside a vehicle are not drawn
    occupants = [place("p1", -60, 1.75, 90, inside), place("p2", 1.75, 9.5, 180, inside),
                 place("p3", 1.75, 9.5, 180, inside)]  # fmt: skip
    # The physical evidence fixes the impact and rest positions in both accounts.
    impact = [
        place("v1", -0.7, 1.75, 90, note="Front right corner at the debris centre, +1.6 E, +1.7 N"),
        place("v2", 2.4, 1.9, 180, note="Struck on its right (west) side as it entered the junction"),
        place("p4", -6.0, 7.0, 135),
    ]
    rest = [
        place("v1", 4.2, 2.5, 95, note="Surveyed rest position, facing 95 degrees"),
        place("v2", 5.8, -0.9, 245, note="Surveyed rest position; lying on its left side"),
        place("p3", 3.4, -0.2, 200, "lying", note="Thrown out; came to rest by her handbag"),
        place("p2", 5.5, -0.2, 250, "lying", note="Left leg trapped under the auto"),
        place("p1", 3.0, 3.9, 160, note="Steps out at 22:13:58 holding something to his ear"),
        place("i1", 3.4, -0.2, 0),
        place("v3", -38.0, 1.75, 90, note="Neha Bhosale stops about 30 m short of the line"),
        place("p4", -6.0, 7.0, 135),
    ]
    return {
        "title": "Collision at Sahyadri Chowk, 22:13:49",
        "summary": (
            "An eastbound Honda City on Karve Road and a southbound auto-rickshaw on Lane 7 collide in the north-east "
            "quarter of Sahyadri Chowk at night. The signal log, two synchronised cameras and the car's event data "
            "recorder fix the timing and speed; the car's driver gives a different account of the signal, his speed "
            "and who was in the car."
        ),
        "setting": {
            "kind": "road",
            "description": "A signalised four-way junction of two single-lane-each-way roads, lit by sodium lamps.",
            "address": "Sahyadri Chowk, Karve Road and Lane 7, Kothrud, Pune",
            "time_of_day": "night",
            "drive_side": "left",
            "roads": [
                {"name": "Karve Road", "runs": "east-west", "arms": ["east", "west"], "lanes_each_way": 1,
                 "lane_width_m": 3.5},
                {"name": "Lane 7", "runs": "north-south", "arms": ["north", "south"], "lanes_each_way": 1,
                 "lane_width_m": 3.5},
            ],
            "junction": {"signals": True, "zebra_crossings": True},
            "landmarks": [
                {"kind": "shop", "label": "Shinde Tea Stall", "position": p(-9.5, 9.5), "heading_deg": 135,
                 "width_m": 4.0, "depth_m": 3.0, "floors": 1,
                 "sign": "SHINDE TEA STALL", "sources": [src(101, "Shinde Tea Stall stands beside it.")]},
                {"kind": "bus_stop", "label": "Bus shelter, north-west corner", "position": p(-17.0, 7.8),
                 "heading_deg": 180},
                {"kind": "shop", "label": "Pharmacy, south-east corner", "position": p(10.5, -10.5),
                 "heading_deg": 315, "sign": "PHARMACY", "width_m": 8.0, "depth_m": 6.0, "floors": 2,
                 "sources": [src(101, "A pharmacy occupies the south-east corner.")]},
                {"kind": "furniture", "label": "Signal controller cabinet J-17-09", "model": "utility-box",
                 "position": p(-5.0, -5.0), "heading_deg": 45},
                {"kind": "streetlight", "label": "CCTV KR-CAM-09", "position": p(6.0, 6.0), "heading_deg": 225},
            ],
        },
        "entities": [
            {"ref": "v1", "kind": "vehicle", "model": "sedan", "label": "White Honda City",
             "object_id": ref("object", 101), "colour": "White", "plate": "MH12 KE 4417",
             "sources": [src(101, "Vehicle A: White Honda City sedan, registration MH12 KE 4417")]},
            {"ref": "v2", "kind": "vehicle", "model": "auto-rickshaw", "label": "Auto-rickshaw",
             "object_id": ref("object", 102), "colour": "Yellow", "plate": "MH12 QR 2208",
             "sources": [src(101, "Vehicle B: CNG auto-rickshaw (three-wheeler), registration MH12 QR 2208")]},
            {"ref": "v3", "kind": "vehicle", "model": "motorcycle", "label": "Honda Activa scooter",
             "object_id": ref("object", 103), "colour": "Grey", "plate": "MH12 ZB 9031"},
            {"ref": "p1", "kind": "person", "model": "person", "label": "Rajesh Menon", "person_id": ref("person", 103)},
            {"ref": "p2", "kind": "person", "model": "person", "label": "Santosh Jadhav",
             "person_id": ref("person", 102)},
            {"ref": "p3", "kind": "person", "model": "person", "label": "Meera Kulkarni",
             "person_id": ref("person", 101)},
            {"ref": "p4", "kind": "person", "model": "person", "label": "Pradeep Shinde",
             "person_id": ref("person", 104)},
            {"ref": "p5", "kind": "person", "model": "person", "label": "Woman in a blue kurta",
             "person_id": ref("person", 106)},
            {"ref": "i1", "kind": "item", "model": "bag", "label": "Passenger's handbag and phone",
             "object_id": ref("object", 105)},
        ],
        "traces": [
            {"kind": "skid_marks", "label": "Sedan skid marks, 13.4 m", "position": p(-11.8, 1.75),
             "end": p(1.6, 1.75),
             "sources": [src(101, "Marks end at the point of impact. Total measured length 13.4 m")]},
            {"kind": "impact_point", "label": "Point of impact", "position": p(1.6, 1.7),
             "sources": [src(101, "Point of impact (debris cluster centre, glass and plastic fragments) | +1.6, +1.7")]},
            {"kind": "debris", "label": "Debris field", "position": p(3.5, 1.0), "radius_m": 2.6},
            {"kind": "evidence_marker", "label": "Fluid trace", "position": p(4.0, 2.0)},
        ],
        "viewpoints": [
            {"label": "Pradeep Shinde's view", "person_id": ref("person", 104), "position": p(-6.0, 7.0),
             "eye_height_m": 1.6, "looks_at": p(1.6, 1.7)},
            {"label": "Camera KR-CAM-09", "position": p(6.0, 6.0), "eye_height_m": 6.0, "looks_at": p(-2.0, -1.0)},
            {"label": "Camera KR-CAM-07 (west approach)", "position": p(-58.0, 4.0), "eye_height_m": 6.0,
             "looks_at": p(0.0, 1.75)},
        ],
        "scenarios": [
            {
                "title": "Sedan entered on red at about 65 km/h",
                "assumptions": [
                    "Follows the GPS-synchronised signal log, the two synchronised cameras and the event data recorder.",
                    "The sedan crossed its stop line 4.7 s into its red, after Lane 7 had turned green.",
                    "An adult sat in the sedan's front passenger seat; who she is is not established.",
                ],
                "supported_by": [
                    src(106, "the Karve Road (east-west) signal had been red for 5 seconds"),
                    src(108, "The vehicle was recorded at 66 km/h"),
                ],
                "stages": [
                    {"label": "Approach", "time": "22:13:45",
                     "description": "Karve Road has been red for a second. The sedan, at about 65 km/h, has just "
                                    "overtaken the scooter across the double line; the auto waits at the Lane 7 stop "
                                    "line.",
                     "event_ids": events(105, 106, 107),
                     "placements": occupants + [place("v1", -57.0, 1.75, 90), place("v3", -64.0, 1.75, 90),
                                                place("v2", 1.75, 9.5, 180), place("p4", -6.0, 7.0, 135),
                                                place("p5", -57.0, 1.75, 90, inside)]},
                    {"label": "Lane 7 green", "time": "22:13:48",
                     "description": "Lane 7 has been green for a second. The auto crosses its stop line at about "
                                    "17 km/h; the sedan is about 18 m from its stop line and brakes 0.4 s later.",
                     "event_ids": events(108, 109, 110),
                     "placements": [place("v1", -26.2, 1.75, 90), place("v2", 1.75, 8.0, 180),
                                    place("v3", -52.0, 1.75, 90), place("p4", -6.0, 7.0, 135)]},
                    {"label": "Impact", "time": "22:13:49",
                     "description": "Braking from 66 km/h, the sedan crosses the stop line on red and its front right "
                                    "corner strikes the auto's right side at about 44 km/h.",
                     "event_ids": events(111, 112),
                     "placements": impact + [place("v3", -45.0, 1.75, 90)]},
                    {"label": "Rest positions", "time": "22:14:02",
                     "description": "The auto has rolled onto its left side and the passenger lies on the road. The "
                                    "driver and a woman in blue have got out of the sedan.",
                     "event_ids": events(113, 114, 115, 116),
                     "placements": rest + [place("p5", 4.2, 3.9, 180, note="From the front passenger door")]},
                ],
            },
            {
                "title": "Rajesh Menon's account: amber at about 40 km/h",
                "assumptions": [
                    "Follows Rajesh Menon's statement: his signal was amber when he crossed the line, he drove at "
                    "about 40 km/h and he was alone.",
                    "The signal log, both cameras, the event data recorder and three witnesses contradict each of "
                    "these points.",
                    "The impact and rest positions are the surveyed ones, as in the other scenario.",
                ],
                "supported_by": [
                    src(102, "I am sure the light was amber and had not turned red when I went over the line."),
                ],
                "stages": [
                    {"label": "Approach", "time": "22:13:41",
                     "description": "By his account the signal turns amber when the sedan is some distance away, "
                                    "travelling at about 40 km/h.",
                     "event_ids": events(105),
                     "placements": occupants[1:] + [place("v1", -42.0, 1.75, 90), place("v2", 1.75, 9.5, 180),
                                                     place("p4", -6.0, 7.0, 135), place("v3", -52.0, 1.75, 90)]},
                    {"label": "Impact", "time": "22:13:49",
                     "description": "He says the auto appeared from his left without slowing and he braked hard.",
                     "event_ids": events(111, 112),
                     "placements": impact + [place("v3", -45.0, 1.75, 90)]},
                    {"label": "Rest positions", "time": "22:13:58",
                     "description": "He says he got out to help the auto driver and that nobody else was in his car.",
                     "event_ids": events(113, 114, 116),
                     "placements": rest},
                ],
            },
        ],
        "open_questions": [c["description"] for c in CONFLICTS if c["status"] == "open"]
        + ["Who was the woman in the blue kurta, and is she Priya Nair? Her statement has not been recorded."],
    }
