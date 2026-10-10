# Forensix Scene Engine

This package defines the contract for the future Forensix crime-scene visualization layer. It intentionally stays focused on scene data, asset metadata, runtime validation and demo fixtures. It does not implement a full 3D renderer yet.

## Responsibilities

This package owns:

- the versioned scene JSON schema used by the app and any future 3D viewer
- the registry of reusable GLB asset IDs and browser URLs
- TypeScript definitions and runtime validation for valid scene data
- synthetic fixture data used for local development and testing

The frontend should consume this package for type-safe scene input, but the actual rendering behavior belongs in the future React + Three.js viewer layer.

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
- Position and scale are world-space unless a child object is explicitly parented.
- A scene object may optionally set `parentId` to indicate a hierarchical relationship, but the eventual engine must interpret that relationship consistently.
- Asset origins are not assumed to be identical across GLB files. Each asset entry in the registry should document its expected origin or pivot when known; otherwise the asset stays unscaled and its transform remains explicit at the scene level.

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

Use the exported `validateScene` API to test a scene before sending it to the renderer:

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
- unique object and room IDs
- room and parent references
- evidence-marker references
- known asset IDs when a registry is supplied
- finite numeric transforms

It does not treat a scene as factually accurate just because it passes validation.

## Mock scene fixture

`mock-murder-scene` is a synthetic demonstration scene designed to exercise the contract. It models a residential living room with floor, walls, a door, a table, chair, body and evidence markers. It is intentionally not a real-world forensic reconstruction.

Use it for schema checks, smoke tests and future rendering tests, but do not treat it as evidence.

## Frontend integration plan

The future frontend can import the package as:

```ts
import {
  CrimeSceneEngine,
  validateScene,
  type SceneDefinition,
} from '@forensix/scene-engine';
```

The first rendering phase will pass a validated scene to a `CrimeSceneEngine` component with a `scene` prop and an optional `onObjectSelect` callback. This phase only reserves the API; it does not yet render the scene.

## Boundaries

This package intentionally does not include:

- backend routes or database migrations
- AI scene generation or evidence upload logic
- UI page redesign work
- a full 3D renderer implementation

The next phase will layer rendering on top of this package rather than replace the contract.
