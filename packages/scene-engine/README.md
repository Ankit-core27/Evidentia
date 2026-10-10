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

Rooms with `layoutMode: 'procedural'` are built from their dimensions, world-space center position and horizontal Y-axis rotation. The engine generates a floor (unless disabled), four wall planes and optional ceilings. Door and window openings are cut from the specified wall using metre offsets measured from that wall's start edge; windows retain the wall below their sill and above their top. `sharedBoundaries` explicitly pairs opposite walls of two rooms. An optional `openingId` must reference a door on room A's shared wall: room A generates the one shared wall surface with its doorway cut, while room B's coincident wall is suppressed. This avoids duplicate solids across the passage. Diagnostics report boundaries whose planes, heights or spans do not align. Authored structural placements remain supported for existing scenes.

Procedural rooms require positive width, depth and height. Openings must fit within their wall and room height, and openings on a wall cannot overlap. Their `offset` is measured from the negative end of the selected room-local wall span. Openings and shared boundaries require procedural layout on their room(s), because authored structural wall placements do not expose enough wall identity to reliably cut or suppress duplicate walls. Room object transforms remain world-space; setting `roomId` associates an object and enables center-point containment diagnostics without changing its transform. `entranceRoomId` enables reachability warnings through explicitly opened shared boundaries; set `allowDisconnectedRooms` when disconnected spaces are intentional. An opening authored only on the suppressed wall is diagnosed.

```ts
environment: {
  rooms: [livingRoom, bedroom],
  sharedBoundaries: [{
    id: 'living-bedroom',
    roomA: 'living-room',
    wallA: 'east',
    roomB: 'bedroom',
    wallB: 'west',
    openingId: 'living-bedroom-door'
  }],
  entranceRoomId: 'living-room',
  allowDisconnectedRooms: false
}
```

## Calibration and diagnostics

Registry calibration status is explicit. `source-bounds-inspected` means source-coordinate bounds were inspected only; it is not a physical measurement. The legacy `dimensions` values on inspected entries are source-coordinate extents, not metres, and calibration records these as `sourceDimensions` with `sourceUnits: 'unknown'`. `demo-scale-estimate` records a demonstration estimate, `physical-dimensions-verified` is reserved for measured physical dimensions, and `not-inspected` indicates missing measurements. Optional `positionCorrection` is interpreted in model-local source units, `rotationCorrection` is composed in the configured scene rotation order, and scale corrections are applied by the shared `resolveAssetTransform` helper rather than model-specific offsets in components.

`diagnoseScene(scene)` returns actionable errors and warnings for schema/registry issues, non-browser asset URLs, unverified asset scale, suspicious object scales, object and evidence-marker centers outside their associated room, mismatched marker/object room associations, overlapping room footprints, misaligned shared boundaries, invalid or blocked door references, and rooms unreachable from a configured entrance. Intentional disconnection can be allowed explicitly. Outdoor objects without a room are valid. Containment checks are center-point checks. A conservative wall-intersection advisory is emitted only when an asset has verified metre dimensions and a known center/bottom origin; source GLB bounds are never treated as physical. This bounding-box check is not physics or a complete collision test. Diagnostics do not claim forensic accuracy.

The package exports `mockMurderScene`, `mockMultiRoomScene`, `mockRoadAccidentScene`, and deterministic `mockRoomLayoutScenes` for 1, 3, 5 and 10 room counts. The three-, five-, and ten-room fixtures are connected house floor plans with aligned shared boundaries and centered door openings; the five-room plan also exercises a uniform 90-degree room rotation. The existing reconstruction viewer selector exposes these layouts for regression inspection. Run `npm test` in `packages/scene-engine` for schema, diagnostics and calibration tests.

## Coordinate conventions

- Units are metres.
- Up axis is `Y`.
- Forward axis is `-Z`.
- Rotation is stored as `[x, y, z]` in degrees using the scene's declared `coordinateSystem.rotationOrder`.
- Scene object position, rotation and scale are world-space. `roomId` associates an object with a room for diagnostics only; it does not transform the object. `parentId` is a validated hierarchy/reference only; this renderer does not compound child transforms relative to a parent.
- A room's optional `position` is the world-space origin at the center of its floor plane (floor elevation), and its optional rotation is a room-local-to-world yaw about Y. Procedural floors, walls, ceilings and openings inherit that room transform.
- Opening offsets, widths, heights and sill heights are room-local metres. Structural placements, scene objects, evidence-marker positions, camera position and camera target use explicit world-space values. Rotating a room does not rotate or translate these independently positioned elements.
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

Use the exported `validateScene` API to test a scene before sending it to the renderer. `CrimeSceneEngine` also validates its input, presents schema/registry issues, and reports model-loading failures separately while keeping unaffected scene elements visible.

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

### Loading external scene data

Use `loadScene` to parse JSON text or validate already-parsed data before rendering:

```ts
import { loadScene } from '@forensix/scene-engine';

const result = loadScene(jsonText);
if (result.success) {
  renderScene(result.scene);
} else {
  console.error(result.diagnostics);
}
```

The result is a discriminated union. Failures contain diagnostics with a stable
`code`, field `path`, and actionable `message`; codes distinguish malformed JSON,
unsupported schema versions, invalid scene data/references, and unknown registry
assets. The loader does not normalize invalid data. It checks registry membership
but does not fetch GLB files: network or model-decoding failures are reported by
the viewer as per-asset placeholders so other scene elements remain visible.
Evidence IDs remain references only because the scene schema has no evidence
record catalog.

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

### Selection and inspection API

`onObjectSelect` receives a serializable `SceneSelection` for the clicked scene object or evidence marker. `onSelectionChange` receives the same selection or `null` when selection is cleared (including empty-space clicks, room-floor clicks, scene changes, and hiding a selected marker). The payload discriminates `kind: 'object'` from `kind: 'evidence-marker'` and includes the element ID, display name, asset ID, category, room/environment association, scene-definition transform, evidence ID references, placement provenance when supplied, asset calibration, and available metadata. Transform values are labeled world-space: positions use metres, rotations use degrees, and scale is unitless. Parent-relative transforms are not implied.

Evidence IDs remain references only because this scene schema does not include evidence records. Marker/object relationships are explicit scene fields; the engine does not infer them from names or proximity. Consumers can wire evidence navigation through an `onEvidenceSelect(evidenceId)` callback. The frontend demo currently reports this as a mock action and does not claim the evidence record exists.

The frontend's compact inspection panel shows the selected object's IDs, association, transform, placement provenance/confidence and calibration status. Source GLB dimensions are labeled as uncalibrated source bounds unless the registry explicitly marks physical dimensions verified. A confidence score is displayed as recorded context only, not proof of placement accuracy.

### Asset measurement note

For the fixture's floor tile, wall, door, table, chair, knife, body and evidence marker, the recorded dimensions were read from GLB accessor bounds, with node translations included for the multi-part body. GLB itself does not declare a physical unit; source coordinates remain unit-unknown and these dimensions are not certified survey measurements. The engine preserves model-local transforms unless explicit registry corrections are configured.

## Boundaries

This package intentionally does not include:

- backend routes or database migrations
- AI scene generation or evidence upload logic
- UI page redesign work
- physics, forensic verification or scene-generation logic

Future phases can extend the renderer while preserving this package's scene contract.
