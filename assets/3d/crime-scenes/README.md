# Crime-scene assets

Served by Vite from `/3d/crime-scenes/...` (the repo's `assets/` folder is the frontend's public directory). The 3D viewer in `frontend/src/features/crime-scene/case-scene/` loads them.

All coordinates are in metres. x points east, y up and z south, with the origin at the scene's reference point. A heading `h` faces `(cos h, 0, -sin h)`, so 0 faces east and π/2 faces north, the same as a scene object's `rotation[1]`.

## Scenes

A scene layout holds the parts of a scene that don't change between stages. The vehicles, people and other movable objects come from each stage's scene objects in the API.

A layout comes from one of two places:
- **Generated:** `POST /api/cases/{id}/reconstructions/generate` reads a case's evidence, writes a scene script and stores the layout on each reconstruction as `scene`. See `backend/app/services/reconstruction/`.
- **Authored:** `scenes/<name>.json`, named by a reconstruction's `scene_file`.

A generated layout also has `setting`, `rooms`, `ground`, `focus`, `appearance`, `generated` (who wrote the script, open questions, check warnings), `scenario` and `stages`, and its `models` are catalogue entries rather than URLs.

| Key | Holds |
| --- | --- |
| `models` | `model_id` to GLB URL, for scene objects and static models |
| `roads` | Each road's axis, extent, lanes each way and lane width |
| `junction` | Kerb corner radius and height, stop-line distance, zebra crossing range |
| `static` | Signals, street lights, trees, buildings, bus stops, walls, skid marks, traces (debris, blood, impact point, fire origin and more) and placed models |
| `camera` | The opening view: `position` and `target` |

`scenes/road-accident/junction.json` is the Ring Road and 5th Avenue junction of case FX-2026-0001. It is laid out to match the seed's placements. Each road has one 3.5 m lane each way, traffic keeps left, stop lines are 8 m from the centre and the hatchback's skid marks are 8.4 m long. The buildings, trees and street lights are illustrative. The signal heads are drawn unlit, because the case records don't say what the signals showed.

## Models

The catalogue in `backend/app/services/reconstruction/catalogue.py` lists every model a generated scene may use, with its size. Every file faces +x with its origin on the ground at the centre of its footprint.

### Vehicles and people

These are generated in code by `frontend/scripts/crime-scene-models/`, so they can be changed and rebuilt (`cd frontend && npm run build:3d-models`, and `node scripts/crime-scene-models/build-person.mjs` for the person).

| File | Model | Size (L x W x H) |
| --- | --- | --- |
| `library/hatchback.glb` | White Maruti Swift-style hatchback, right-hand drive | 3.85 x 1.74 x 1.53 m |
| `library/sedan.glb` | Honda City-style sedan | 4.55 x 1.75 x 1.49 m |
| `library/delivery-van.glb` | Blue Tata Ace-style mini truck with a closed cargo box | 3.80 x 1.58 x 2.12 m |
| `library/truck.glb` | Rigid lorry | 8.5 x 2.5 x 3.4 m |
| `library/bus.glb` | City bus, doors on the left | 11.5 x 2.55 x 3.2 m |
| `library/auto-rickshaw.glb` | Bajaj RE-style auto-rickshaw | 2.65 x 1.3 x 1.75 m |
| `library/motorcycle.glb` | Commuter motorcycle | 2.05 x 0.75 x 1.1 m |
| `library/bicycle.glb` | Roadster bicycle | 1.75 x 0.6 x 1.05 m |
| `library/person.glb` | Posable forensic mannequin; poses in `frontend/src/features/crime-scene/case-scene/poses.ts` | 1.72 m tall |

### Furniture and items

`library/props/` holds [Poly Haven](https://polyhaven.com) models, released under CC0. `frontend/scripts/crime-scene-models/props.mjs` downloads and prepares them: it turns each one to face +x, sets it on the ground and compresses its textures.

| File | Poly Haven model |
| --- | --- |
| `sofa.glb` | [sofa_03](https://polyhaven.com/a/sofa_03) |
| `table.glb` | [dining_table](https://polyhaven.com/a/dining_table) |
| `chair.glb` | [dining_chair_02](https://polyhaven.com/a/dining_chair_02) |
| `plastic-chair.glb` | [plastic_monobloc_chair_01](https://polyhaven.com/a/plastic_monobloc_chair_01) |
| `cupboard.glb` | [drawer_cabinet](https://polyhaven.com/a/drawer_cabinet) |
| `bed-frame.glb` | [old_bed_frame](https://polyhaven.com/a/old_bed_frame); the viewer adds the mattress |
| `nightstand.glb` | [ClassicNightstand_01](https://polyhaven.com/a/ClassicNightstand_01) |
| `shelf.glb` | [steel_frame_shelves_02](https://polyhaven.com/a/steel_frame_shelves_02); repeated to make a run of racking |
| `bookshelf.glb` | [wooden_bookshelf_worn](https://polyhaven.com/a/wooden_bookshelf_worn) |
| `television.glb` | [television_02](https://polyhaven.com/a/television_02) |
| `electrical-panel.glb` | [power_box_01](https://polyhaven.com/a/power_box_01) |
| `utility-box.glb` | [utility_box_01](https://polyhaven.com/a/utility_box_01) |
| `cardboard-box.glb` | [cardboard_box_01](https://polyhaven.com/a/cardboard_box_01); stacked on a pallet for stored goods |
| `crate.glb` | [wooden_crate_01](https://polyhaven.com/a/wooden_crate_01) |
| `generator.glb` | [portable_generator](https://polyhaven.com/a/portable_generator) |
| `pistol.glb` | [service_pistol](https://polyhaven.com/a/service_pistol), one of its two pistols |
| `bat.glb` | [baseball_bat](https://polyhaven.com/a/baseball_bat) |
| `crowbar.glb` | [crowbar_01](https://polyhaven.com/a/crowbar_01) |
| `knife.glb` | [fish_knife](https://polyhaven.com/a/fish_knife) |
| `suitcase.glb` | [vintage_suitcase](https://polyhaven.com/a/vintage_suitcase), one of its two cases |
| `papers.glb` | [office_notepads](https://polyhaven.com/a/office_notepads) |
| `cctv-camera.glb` | [security_camera_01](https://polyhaven.com/a/security_camera_01) |

A phone, bottle, jewellery box, traffic cone and collision debris are drawn in code (`case-scene/Props.tsx`).

The viewer restyles them through their material and node names:
- `paint` takes the case record's colour.
- `headlight`, `taillight` and `indicator` light up at night.
- `plate_front` and `plate_rear` get the registration from the case record, on white for private vehicles or yellow for commercial ones.
- The `wheel_*` nodes turn as the vehicle moves between stages.

The other files in `../crime-scenes/library/` are the scene engine demo's placeholders (PR #36). Generated scenes don't use them.

## Textures and lighting

All from [Poly Haven](https://polyhaven.com), released under CC0:

| File | Asset |
| --- | --- |
| `textures/asphalt_02_*_1k.jpg` | [Asphalt 02](https://polyhaven.com/a/asphalt_02): colour, OpenGL normal and roughness |
| `textures/concrete_pavers_02_*_1k.jpg` | [Concrete Pavers 02](https://polyhaven.com/a/concrete_pavers_02): colour, OpenGL normal and roughness |
| `textures/wood_floor_*_1k.jpg` | [Wood Floor](https://polyhaven.com/a/wood_floor): colour and OpenGL normal |
| `textures/marble_01_*_1k.jpg` | [Marble 01](https://polyhaven.com/a/marble_01): colour and OpenGL normal, for tiled and marble floors |
| `textures/concrete_floor_02_*_1k.jpg` | [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02): colour and OpenGL normal |
| `textures/sparse_grass_*_1k.jpg` | [Sparse Grass](https://polyhaven.com/a/sparse_grass): colour and OpenGL normal |
| `hdri/crosswalk_1k.hdr` | [Crosswalk](https://polyhaven.com/a/crosswalk): daylight reflections |
| `hdri/cobblestone_street_night_1k.hdr` | [Cobblestone Street Night](https://polyhaven.com/a/cobblestone_street_night): night reflections |

Number plates, kerb paint, shutters, shop signs, plaster weathering, skid marks, blood and soot stains, shoe prints and evidence tent numbers are drawn at runtime in `case-scene/textures.ts`.
