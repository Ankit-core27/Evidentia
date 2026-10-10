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
    rooms: []
  },
  objects: [],
  evidenceMarkers: [],
  camera: {
    position: [8, 6, 8],
    target: [0, 0, 0]
  }
}
```

## Coordinate conventions

- Units are metres.
- Up axis is `Y`.
- Forward axis is `-Z`.
- Rotation is stored as `[x, y, z]` in degrees, using the `XYZ` rotation order.
- Position, rotation and scale are world-space. `parentId` records a hierarchy/reference only; this renderer does not compound child transforms relative to a parent.
- A room's optional `position` is the world-space center of its floor footprint. Structural placements and scene objects still use their own explicit world-space transforms.
- Asset origins are not assumed to be identical across GLB files. When bounds were inspected from the GLB accessors, the registry records source-coordinate dimensions and the model-local origin/pivot. No automatic origin or scale correction is applied by the loader.

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

For the fixture's floor tile, wall, door, table, chair, knife, body and evidence marker, the recorded dimensions were read from GLB accessor bounds, with node translations included for the multi-part body. GLB itself does not declare a physical unit; source coordinates are interpreted as metres to match this scene format. These values are useful renderer defaults, not certified survey measurements. Model-local transforms are preserved as authored; the engine does not normalize different origins automatically.

## Boundaries

This package intentionally does not include:

- backend routes or database migrations
- AI scene generation or evidence upload logic
- UI page redesign work
- physics, forensic verification or scene-generation logic

Future phases can extend the renderer while preserving this package's scene contract.
