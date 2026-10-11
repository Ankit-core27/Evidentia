# Building models

Detailed models for the building inspection view (Area & buildings tab of a case). They are generated, not hand-edited: change `frontend/scripts/buildings/specs.mjs` and run `npm run build:buildings` from `frontend/`. `npm run test:buildings` checks that the models dissect and restore correctly.

| File | What it is |
| --- | --- |
| `manifest.json` | Every building the area view shows: footprint anchor (lat, lng, heading), height, floors and, when one exists, the detailed model |
| `corner-store.glb` | Corner store at the south-west corner of the Ring Road and 5th Avenue junction: shop on the ground floor, residence above (2 floors) |
| `office-block.glb` | Office block at the north-east corner: lobby, security room and café; open office and meeting room; offices, server and records rooms (3 floors) |

Both models are **authored and illustrative**. The case records hold no survey or floor plan of these buildings, and the viewer says so. The two other manifest entries are footprints only and have no model, so they cannot be opened.

## Frame and mapping

- Metres, origin on the ground at the centre of the footprint, +x east, -z north, +y up.
- `anchor.lat`/`anchor.lng` place the origin; `heading_deg` turns the model clockwise from north. The Cesium footprint is computed from the same anchor, so the geographic feature and the model always agree.
- `geo_building_id` is the geographic feature's identifier. To map a streamed OpenStreetMap building to a model, set it to `osm:<elementId>`.

## Components

Every part the viewer can explode, hide or isolate is a named glTF node whose extras carry `kind` and `label`:

```
building
├── floor_<n>                  kind: floor, level, elevation_m
│   ├── slab_f<n>              kind: slab (with a hole over the stair below)
│   ├── room_f<n>_<id>         kind: room, room_type, area_m2
│   ├── wall_ext_<side>_f<n>   kind: wall, wall_type: exterior, explode: [x, y, z]
│   │   └── door_f<n>_<id>     kind: door (moves with its wall)
│   ├── wall_int_f<n>_<id>     kind: wall, wall_type: interior, explode: [x, y, z]
│   ├── stairs_f<n>            kind: stairs, connects: [n, n + 1]
│   └── fur_f<n>_<id>          kind: furniture, room
└── roof                       kind: roof
    └── roof_<id>              kind: fixture
```

A model made elsewhere (for example in Blender) works if it follows the same node names; extras are optional, and walls without `explode` move away from the building's centre.
