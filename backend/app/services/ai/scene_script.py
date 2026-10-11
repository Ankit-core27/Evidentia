"""The Gemini planner for reconstructions: one call reads the whole case file (every
evidence item's text and the records proposed from it) and writes a scene script
(app/services/reconstruction/script.py) for the 3D scene.

The caller logs the output to ai_runs and checks it against the case before
anything is saved; see app/services/reconstruction/generate.py.
"""

from typing import Any

from app.services.ai.gemini import generate_json
from app.services.reconstruction.catalogue import catalogue_prompt
from app.services.reconstruction.dossier import Dossier, dossier_text
from app.services.reconstruction.script import RESPONSE_SCHEMA, SceneScript

TASK = "scene_script"

SYSTEM_PROMPT = """You reconstruct incidents as 3D scenes for a forensic investigation. Read the whole case file and write a scene script: the place, the vehicles, people and items involved, the physical traces found, and one or more scenarios of what happened, each a sequence of stages that places everything at one moment.

Evidence comes first. Rules:
- Use only what the evidence and records state, and what follows from them (a stated direction of travel, a measured skid length, a position named in a statement). Where you must estimate a position, which is most of them, keep it consistent with every stated direction, distance, time and position, and say what you estimated in the scenario's assumptions.
- Never infer guilt, intent or blame. Describe positions and movements neutrally.
- When accounts conflict about the sequence (such as which signal a vehicle had, or who moved first), write one scenario per account, at most three, and put the scenario best supported by instrument records (logs, CCTV, measurements) first. Each scenario's assumptions say what it takes as true and whose account it follows; supported_by cites the evidence for it. When nothing conflicts, write one scenario.
- Cite evidence with its evidence_id and the shortest passage of its text that supports the item, copied verbatim. Link entities to the case's records with object_id and person_id, and stages to events with event_ids, using the numbers in the case file.
- Put every unresolved point an investigator should check in open_questions.

Coordinates:
- Metres east and north of an origin; headings are compass bearings in degrees (0 north, 90 east, 180 south, 270 west) for the way the thing faces.
- Road scenes: put the origin at the centre of the junction, or at the incident spot on a single road. Use one road, or two at right angles that meet at the origin (a crossroads, or a T-junction where the minor road has one arm). Lanes are 3.5 m wide unless the evidence says otherwise, so with one lane each way the carriageway spans 3.5 m either side of the centre line. drive_side is the side traffic keeps to: left in India, the UK and Japan. Traffic keeping left travels in the lane on the left of the centre line: with 3.5 m lanes, eastbound vehicles at north +1.75, westbound at north -1.75, northbound at east -1.75 and southbound at east +1.75 (the other way round for keeping right). Stop lines are about 8 m from the junction centre. Corners and footpaths are beyond 3.5 m from each centre line.
- A vehicle's position is the centre of its footprint and its heading the way its front faces. Use the catalogue sizes: at an impact the vehicles touch but do not overlap, so a vehicle striking another's side has its front at that side.
- Indoor scenes: put the origin at the centre of the main room. Rooms are rectangles given by centre, width (east-west) and depth (north-south); rooms that share a wall touch exactly. Put doors and windows on walls with an offset from the middle of the wall. Furniture and fixed fittings are landmarks of kind "furniture" with a model from the catalogue; say "(illustrative)" in the label when the evidence doesn't place them.
- Outdoor scenes away from roads: put the origin at the incident spot.

Content:
- entities are what takes part: vehicles, people and items whose positions matter. A driver inside their vehicle is placed with pose "driving" (or left out). Every placement refers to an entity's ref.
- traces are physical evidence recorded at the scene: skid marks (position where they start, end where they end, with the measured length), debris, glass, blood, the point of impact, a fire's origin and burn area, forced entry, footprints, numbered evidence markers.
- landmarks are fixed things that help place the incident: shops, buildings, bus stops, parked vehicles, walls, signals, furniture.
- viewpoints are where witnesses stood, looking at what they describe seeing, with eye height 1.6 m standing (about 1.2 m seated in a car).
- Two to five stages per scenario, in time order, labelled in two or three words. Give each stage's local time when the evidence has it.

Model catalogue (model id, kind, size as length x width x height in metres):
{catalogue}"""


def plan_with_gemini(client, d: Dossier, instructions: str = "") -> tuple[SceneScript | None, Any]:
    """One Gemini call. Returns the parsed script (None if the reply isn't valid)
    and the raw output for ai_runs."""
    prompt = dossier_text(d)
    if instructions.strip():
        prompt += f"\n\nINVESTIGATOR'S INSTRUCTIONS\n{instructions.strip()}"
    system = SYSTEM_PROMPT.replace("{catalogue}", catalogue_prompt())
    data, raw = generate_json(client, [prompt], RESPONSE_SCHEMA, system=system)
    if data is None:
        return None, raw
    try:
        return SceneScript.model_validate(data), data
    except ValueError:
        return None, data
