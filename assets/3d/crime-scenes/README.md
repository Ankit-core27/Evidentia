# Crime-scene assets

Served by Vite from `/3d/crime-scenes/...` (the repo's `assets/` folder is the frontend's public directory). The 3D viewer in `frontend/src/features/crime-scene/case-scene/` loads them.

All coordinates are in metres. x points east, y up and z south, with the origin at the scene's reference point. A heading `h` faces `(cos h, 0, -sin h)`, so 0 faces east and π/2 faces north, the same as a scene object's `rotation[1]`.

## Scenes

`scenes/<name>.json` is a reconstruction's `scene_file`: the parts of a scene that don't change between stages. The vehicles and other movable objects come from each stage's scene objects in the API.

| Key | Holds |
| --- | --- |
| `models` | `model_id` to GLB URL, for scene objects and static models |
| `roads` | Each road's axis, extent, lanes each way and lane width |
| `junction` | Kerb corner radius and height, stop-line distance, zebra crossing range |
| `static` | Signals, street lights, trees, buildings, skid marks and static models |
| `camera` | The opening view: `position` and `target` |

`scenes/road-accident/junction.json` is the Ring Road and 5th Avenue junction of case FX-2026-0001. It is laid out to match the seed's placements. Each road has one 3.5 m lane each way, traffic keeps left, stop lines are 8 m from the centre and the hatchback's skid marks are 8.4 m long. The buildings, trees and street lights are illustrative. The signal heads are drawn unlit, because the case records don't say what the signals showed.

## Models

| File | Model | Size (L x W x H) | Made by |
| --- | --- | --- | --- |
| `library/hatchback.glb` | White Maruti Swift-style hatchback, right-hand drive | 3.85 x 1.74 x 1.53 m | `npm run build:3d-models` |
| `library/delivery-van.glb` | Blue Tata Ace-style mini truck with a closed cargo box | 3.80 x 1.58 x 2.12 m | `npm run build:3d-models` |

The vehicles are generated in code by `frontend/scripts/crime-scene-models/`, so they can be changed and rebuilt (`cd frontend && npm run build:3d-models`). Each faces +x with its origin on the ground at the centre of its footprint.

The viewer restyles them through their material and node names:
- `paint` takes the case record's colour.
- `headlight`, `taillight` and `indicator` light up at night.
- `plate_front` and `plate_rear` get the registration from the case record, on white for private vehicles or yellow for commercial ones.
- The `wheel_*` nodes turn as the vehicle moves between stages.

The other files in `../crime-scenes/library/` come from the scene engine's demo (PR #36).

## Textures and lighting

All from [Poly Haven](https://polyhaven.com), released under CC0:

| File | Asset |
| --- | --- |
| `textures/asphalt_02_*_1k.jpg` | [Asphalt 02](https://polyhaven.com/a/asphalt_02): colour, OpenGL normal and roughness |
| `textures/concrete_pavers_02_*_1k.jpg` | [Concrete Pavers 02](https://polyhaven.com/a/concrete_pavers_02): colour, OpenGL normal and roughness |
| `hdri/crosswalk_1k.hdr` | [Crosswalk](https://polyhaven.com/a/crosswalk): daylight reflections |
| `hdri/cobblestone_street_night_1k.hdr` | [Cobblestone Street Night](https://polyhaven.com/a/cobblestone_street_night): night reflections |

Number plates, kerb paint, shutters, shop signs, plaster weathering and skid marks are drawn at runtime in `case-scene/textures.ts`.
