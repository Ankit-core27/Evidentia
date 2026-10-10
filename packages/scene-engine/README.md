# Forensix Scene Engine

This package defines the reusable scene contract, asset metadata and first working React Three Fiber renderer for Forensix. It deliberately does not own case navigation, evidence upload, backend APIs or forensic workflows.

## Responsibilities

This package owns:

- the versioned scene JSON schema used by the app and renderer
- the registry of reusable GLB asset IDs and browser URLs
- TypeScript definitions and runtime validation for valid scene data
- synthetic fixture data used for local development and testing
- the reusable `CrimeSceneEngine` React Three Fiber viewer, controls, asset loading and selection

The frontend consumes this package for type-safe scene input and the reusable React Three Fiber viewer, while keeping application navigation and case workflows in the frontend.

## Scene JSON format

The top-level scene object is versioned and deliberately sparse enough to support indoor, outdoor and road-accident layouts. A sketch is below:

```ts
{
  schemaVersion: '1.0',
  sceneId: 'scene-murder-001',
  caseId: 'FOR-2026-001',
  title: 'Residential Murder Scene',
  sceneType: 'indoor',
  units: 'meters',
  coordinateSystem: {
    up: 'Y',
    forward: '-Z',
    handedness: 'right',
    rotationOrder: 'XYZ'
  },
  environment: {
    type: 'residential_house',
    rooms: [{
      id: 'room-1',
      name: 'Living room',
      type: 'living_room',
      layoutMode: 'procedural',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { width: 6, depth: 5, height: 3 },
      wallThickness: 0.12,
      openings: [{
        id: 'entry-door',
        type: 'door',
        wall: 'south',
        offset: 2.4,
        width: 1,
        height: 2.1,
        sillHeight: 0,
        assetId: 'door_wooden'
      }]
    }]
  },
  objects: [],
  evidenceMarkers: [],
  camera: {
    position: [8, 6, 8],
    target: [0, 0, 0]
  }
}
```

## Procedural rooms and openings

Rooms with `layoutMode: 'procedural'` are built from their dimensions, world-space center position and horizontal Y-axis rotation. The engine generates a floor (unless disabled), four wall planes and optional ceilings. Door and window openings are cut from the specified wall using metre offsets measured from that wall's start edge; windows retain the wall below their sill and above their top. An opening may reference a registry asset, for example a door GLB. `sharedBoundaries` explicitly pairs opposite walls of two rooms; room A owns the shared wall and any connecting opening on that wall, and room B's duplicate wall is suppressed. Diagnostics report shared walls whose planes, heights or spans do not align. Authored structural placements remain supported for existing scenes.

Procedural rooms require width, depth and height. Openings must fit within their wall and room height, and openings on a wall cannot overlap. Room object transforms remain world-space; setting `roomId` associates an object and enables center-point containment diagnostics without changing its transform.

## Calibration and diagnostics

Registry calibration status is explicit. `source-bounds-inspected` means source-coordinate bounds were inspected only; it is not a physical measurement. The legacy `dimensions` values on inspected entries are source-coordinate extents, not metres, and calibration records these as `sourceDimensions` with `sourceUnits: 'unknown'`. `demo-scale-estimate` records a demonstration estimate, `physical-dimensions-verified` is reserved for measured physical dimensions, and `not-inspected` indicates missing measurements. Optional `positionCorrection` is interpreted in model-local source units, `rotationCorrection` is composed in the configured scene rotation order, and scale corrections are applied by the shared `resolveAssetTransform` helper rather than model-specific offsets in components.

`diagnoseScene(scene)` returns actionable errors and warnings for schema/registry issues, non-browser asset URLs, unverified asset scale, suspicious object scales, object centers outside their associated room, and misaligned shared boundaries. Outdoor objects without a room are valid. Diagnostics do not claim forensic accuracy.

The package exports `mockMurderScene`, `mockMultiRoomScene`, and `mockRoadAccidentScene` as synthetic regression/demo fixtures. The existing reconstruction viewer's demo selector lets you switch between all three without creating a second frontend. Run `npm test` in `packages/scene-engine` for schema, diagnostics and calibration tests.

## Coordinate conventions

- Units are metres.
- Up axis is `Y`.
- Forward axis is `-Z`.
- Rotation is stored as `[x, y, z]` in degrees, using the `XYZ` rotation order.
- Position, rotation and scale are world-space. `parentId` records a hierarchy/reference only; this renderer does not compound child transforms relative to a parent.
- A room's optional `position` is the world-space center of its floor footprint. Structural placements and scene objects still use their own explicit world-space transforms.
- Asset origins are not assumed to be identical across GLB files. Registry calibration records whether only source bounds were inspected, a demo-scale estimate was applied, physical dimensions were verified, or the model remains uninspected. GLB source bounds do not prove physical units. Optional position, rotation, and scale corrections are centralized in the registry and applied without mutating scene transforms.

## Asset registry conventions

The asset registry maps a stable asset ID to a browser URL and metadata. Example:

```ts
{
  id: 'chair_wooden',
  name: 'Wooden Chair',
  category: 'furniture',
  url: '/crime-scenes/library/chair_wooden.glb',
  format: 'glb',
  tags: ['wood', 'indoor']
}
```

The registry is separate from the scene data itself. The scene stores the asset ID, and the engine resolves it through the registry at runtime. This keeps the scene portable and avoids embedding filesystem paths into JSON.

## Adding a new GLB asset

1. Keep the existing model file in the source asset library.
2. Add a stable registry entry using a descriptive ID, for example `door_wooden`.
3. Set a browser-safe URL relative to the existing Vite `publicDir` output.
4. Include any known size or origin metadata only when you have verified it; otherwise leave it unspecified.
5. Validate the scene fixture again after adding the entry.

## Validation

Use the exported `validateScene` API to test a scene before sending it to the renderer. `CrimeSceneEngine` also validates its input and presents the specific schema or registry issues instead of silently rendering invalid data.

```ts
import { validateScene, assetRegistry } from '@forensix/scene-engine';

const result = validateScene(scene, assetRegistry);
if (!result.success) {
  console.error(result.errors);
}
```

The validator checks:

- schema version and required fields
- valid scene type and vector lengths
- unique room IDs and renderable element IDs
- room and parent references
- evidence-marker references
- known asset IDs when a registry is supplied
- finite numeric transforms

It does not treat a scene as factually accurate just because it passes validation.

## Mock scene fixture

`mock-murder-scene` is a synthetic demonstration scene designed to exercise the contract. It models a residential living room with floor, walls, a door, a table, chair, body and evidence markers. It is intentionally not a real-world forensic reconstruction.

Use it for schema checks, smoke tests and future rendering tests, but do not treat it as evidence.

## Frontend integration plan

The frontend imports the package as:

```ts
import {
  CrimeSceneEngine,
  validateScene,
  type SceneDefinition,
} from '@forensix/scene-engine';
```

The frontend passes a scene to the `CrimeSceneEngine` component with a `scene` prop and optional `onObjectSelect` callback. The viewer provides orbit/zoom controls, camera reset and overhead view, evidence-marker visibility, and object selection. Selection callbacks receive the stable `id`, `assetId`, associated `evidenceIds` and object `metadata`.

The current package loads models using `useGLTF` from the registry URL, clones the cached scene and clones materials per instance before applying highlights. Geometry remains shared with the GLTF cache. When a known asset URL fails, a labelled placeholder keeps the remaining scene usable.

### Asset measurement note

For the fixture's floor tile, wall, door, table, chair, knife, body and evidence marker, the recorded dimensions were read from GLB accessor bounds, with node translations included for the multi-part body. GLB itself does not declare a physical unit; source coordinates remain unit-unknown and these dimensions are not certified survey measurements. The engine preserves model-local transforms unless explicit registry corrections are configured.

## Boundaries

This package intentionally does not include:

- backend routes or database migrations
- AI scene generation or evidence upload logic
- UI page redesign work
- physics, forensic verification or scene-generation logic

Future phases can extend the renderer while preserving this package's scene contract.
