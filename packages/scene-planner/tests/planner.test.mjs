import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assetRegistry,
  mockMurderScene,
  mockRoadAccidentScene,
  mockRoomLayoutScenes,
  validateScene,
} from '@forensix/scene-engine';
import { DeterministicMockScenePlanner, ScenePlanner, planScene } from '../dist/index.js';

const exampleDescription = 'A synthetic residential house has a living room, a bedroom and a kitchen. The rooms are connected by doorways. A table and chairs are in the living room. A knife is reported near the bedroom doorway. The body exact position has not been measured.';
const baseRequest = {
  description: exampleDescription,
  environmentType: 'indoor',
};

test('deterministic mock creates a validated connected three-room synthetic house', async () => {
  const result = await planScene(baseRequest);
  assert.equal(result.success, true);
  assert.equal(result.providerId, 'deterministic-mock');
  if (!result.success) return;
  assert.equal(result.scene.environment.rooms.length, 3);
  assert.equal(result.scene.environment.sharedBoundaries.length, 2);
  assert.ok(result.scene.environment.rooms.every(({ position, dimensions }) =>
    position && dimensions.width > 0 && dimensions.depth > 0 && dimensions.height > 0));
  assert.deepEqual(validateScene(result.scene, assetRegistry).errors, []);
  assert.ok(!result.diagnostics.some(({ severity }) => severity === 'error'));
  assert.equal(result.scene.metadata.planner.mode, 'deterministic-mock');
  assert.match(result.scene.metadata.planner.disclaimer, /not an LLM/);
});

test('unmeasured body location is omitted rather than assigned invented coordinates', async () => {
  const result = await planScene(baseRequest);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(!result.scene.objects.some(({ assetId }) => assetId === 'victim_body'));
  assert.ok(result.diagnostics.some(({ code, severity }) =>
    code === 'UNRESOLVED_OBJECT_PLACEMENT' && severity === 'warning'));
});

test('unknown permitted asset IDs and invalid requested room references are actionable errors', async () => {
  const unknownAsset = await planScene({ ...baseRequest, permittedAssetIds: ['imaginary_asset'] });
  assert.equal(unknownAsset.success, false);
  assert.ok(unknownAsset.diagnostics.some(({ code }) => code === 'UNSUPPORTED_ASSET_REQUEST'));

  const invalidRoom = await planScene({
    ...baseRequest,
    roomConstraints: [{ id: 'living', name: 'Living room' }],
    requestedLayout: {
      connections: [{
        roomA: 'living',
        wallA: 'east',
        roomB: 'missing-room',
        wallB: 'west',
      }],
    },
  });
  assert.equal(invalidRoom.success, false);
  assert.ok(invalidRoom.diagnostics.some(({ code }) => code === 'INVALID_REFERENCE'));

  const invalidScene = structuredClone(mockRoomLayoutScenes[3]);
  invalidScene.objects[0].roomId = 'missing-room';
  const invalidScenePlanner = new ScenePlanner({
    provider: {
      id: 'test-invalid-room',
      supportsStructuredOutput: true,
      async generateScene() { return invalidScene; },
    },
  });
  const invalidSceneResult = await invalidScenePlanner.plan(baseRequest);
  assert.equal(invalidSceneResult.success, false);
  assert.ok(invalidSceneResult.diagnostics.some(({ code }) => code === 'INVALID_REFERENCE'));

  const unknownAssetScene = structuredClone(mockRoomLayoutScenes[3]);
  unknownAssetScene.objects[0].assetId = 'not-registered';
  const unknownAssetPlanner = new ScenePlanner({
    provider: {
      id: 'test-unknown-asset',
      supportsStructuredOutput: true,
      async generateScene() { return unknownAssetScene; },
    },
  });
  const unknownAssetResult = await unknownAssetPlanner.plan(baseRequest);
  assert.equal(unknownAssetResult.success, false);
  assert.ok(unknownAssetResult.diagnostics.some(({ code }) => code === 'UNKNOWN_ASSET'));
});

test('planner diagnostics reject misaligned room boundaries and out-of-bounds door openings', async () => {
  const misaligned = structuredClone(mockRoomLayoutScenes[3]);
  misaligned.environment.rooms[1].position[0] += 0.5;
  const misalignedPlanner = new ScenePlanner({
    provider: {
      id: 'test-misaligned',
      supportsStructuredOutput: true,
      async generateScene() { return misaligned; },
    },
  });
  const result = await misalignedPlanner.plan(baseRequest);
  assert.equal(result.success, false);
  assert.ok(result.diagnostics.some(({ code }) => code === 'SHARED_BOUNDARY_MISALIGNED'));

  const outside = structuredClone(mockRoomLayoutScenes[3]);
  const boundary = outside.environment.sharedBoundaries[0];
  const room = outside.environment.rooms.find(({ id }) => id === boundary.roomA);
  room.openings.find(({ id }) => id === boundary.openingId).offset = room.dimensions.depth + 0.1;
  const outsidePlanner = new ScenePlanner({
    provider: {
      id: 'test-outside-opening',
      supportsStructuredOutput: false,
      async generateScene() { return outside; },
    },
  });
  const outsideResult = await outsidePlanner.plan(baseRequest);
  assert.equal(outsideResult.success, false);
  assert.ok(outsideResult.diagnostics.some(({ path }) => path.includes('openings')));
});

test('unsupported schema versions are rejected using the engine scene loader', async () => {
  const candidate = structuredClone(mockMurderScene);
  candidate.schemaVersion = '2.0';
  const planner = new ScenePlanner({
    provider: {
      id: 'test-version',
      supportsStructuredOutput: true,
      async generateScene() { return candidate; },
    },
  });
  const result = await planner.plan(baseRequest);
  assert.equal(result.success, false);
  assert.ok(result.diagnostics.some(({ code }) => code === 'UNSUPPORTED_SCHEMA_VERSION'));
});

test('missing optional metadata remains valid and engine fixtures remain compatible', async () => {
  const candidate = structuredClone(mockRoomLayoutScenes[3]);
  delete candidate.metadata;
  const planner = new ScenePlanner({
    provider: {
      id: 'test-optional-metadata',
      supportsStructuredOutput: true,
      async generateScene() { return candidate; },
    },
  });
  const result = await planner.plan(baseRequest);
  assert.equal(result.success, true);
  assert.deepEqual(validateScene(mockMurderScene, assetRegistry).errors, []);
  assert.deepEqual(validateScene(mockRoadAccidentScene, assetRegistry).errors, []);
  for (const fixture of Object.values(mockRoomLayoutScenes)) {
    assert.deepEqual(validateScene(fixture, assetRegistry).errors, []);
  }
});

test('provider errors and malformed output are returned as structured diagnostics', async () => {
  const failing = new ScenePlanner({
    provider: {
      id: 'test-error',
      supportsStructuredOutput: false,
      async generateScene() { throw new Error('test provider failure'); },
    },
  });
  const providerError = await failing.plan(baseRequest);
  assert.equal(providerError.success, false);
  assert.ok(providerError.diagnostics.some(({ code }) => code === 'PROVIDER_ERROR'));

  const malformed = new ScenePlanner({
    provider: {
      id: 'test-malformed',
      supportsStructuredOutput: true,
      async generateScene() { return '{not valid json'; },
    },
  });
  const malformedResult = await malformed.plan(baseRequest);
  assert.equal(malformedResult.success, false);
  assert.ok(malformedResult.diagnostics.some(({ code }) => code === 'MALFORMED_PROVIDER_OUTPUT'));
});

test('mock provider output is deterministic and uses only registry asset identifiers', async () => {
  const provider = new DeterministicMockScenePlanner();
  const request = {
    plannerRequest: {
      ...baseRequest,
      roomConstraints: [
        { id: 'living', name: 'Living room', dimensions: { width: 5, depth: 4, height: 2.8 } },
        { id: 'bedroom', name: 'Bedroom', dimensions: { width: 5, depth: 4, height: 2.8 } },
        { id: 'kitchen', name: 'Kitchen', dimensions: { width: 5, depth: 4, height: 2.8 } },
      ],
    },
    responseFormat: { name: 'forensix_scene_v1', schema: undefined },
  };
  const first = await provider.generateScene(request);
  const second = await provider.generateScene(request);
  assert.deepEqual(first, second);
  assert.ok(first.objects.every(({ assetId }) => Object.hasOwn(assetRegistry, assetId)));
});

test('explicitly supplied world positions and connection topology are preserved', async () => {
  const positions = {
    living: [0, 0, 0],
    bedroom: [5, 0, 0],
    kitchen: [10, 0, 0],
  };
  let sawSchemaFormat = false;
  const planner = new ScenePlanner({
    provider: {
      id: 'test-constrained-provider',
      supportsStructuredOutput: true,
      async generateScene({ responseFormat }) {
        sawSchemaFormat = responseFormat.name === 'forensix_scene_v1' &&
          typeof responseFormat.schema.safeParse === 'function';
        const result = await new DeterministicMockScenePlanner().generateScene({
          plannerRequest: {
            ...baseRequest,
            roomConstraints: [
              { id: 'living', name: 'Living room', dimensions: { width: 5, depth: 4, height: 2.8 }, position: positions.living },
              { id: 'bedroom', name: 'Bedroom', dimensions: { width: 5, depth: 4, height: 2.8 }, position: positions.bedroom },
              { id: 'kitchen', name: 'Kitchen', dimensions: { width: 5, depth: 4, height: 2.8 }, position: positions.kitchen },
            ],
            requestedLayout: {
              connections: [
                { roomA: 'living', wallA: 'east', roomB: 'bedroom', wallB: 'west' },
                { roomA: 'bedroom', wallA: 'east', roomB: 'kitchen', wallB: 'west' },
              ],
              entranceRoomId: 'living',
            },
          },
          responseFormat,
        });
        return result;
      },
    },
  });
  const result = await planner.plan(baseRequest);
  assert.equal(sawSchemaFormat, true);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.scene.environment.rooms.map(({ id, position }) => [id, position]), [
    ['living', positions.living],
    ['bedroom', positions.bedroom],
    ['kitchen', positions.kitchen],
  ]);
  assert.equal(result.scene.environment.sharedBoundaries.length, 2);
});

test('evidence markers keep explicit IDs and world positions without creating evidence records', async () => {
  const result = await planScene({
    description: 'A table is in the living room.',
    environmentType: 'indoor',
    roomConstraints: [{ id: 'living', name: 'Living room' }],
    objectConstraints: [{
      name: 'Table',
      assetId: 'table_wooden',
      roomName: 'Living room',
      position: [0, 0, 0],
      evidenceIds: ['evidence-table-1'],
    }],
    evidenceMarkerConstraints: [{
      evidenceId: 'evidence-table-1',
      label: 'Table evidence',
      objectName: 'Table',
      roomName: 'Living room',
      position: [0, 0.1, 0],
    }],
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.scene.objects[0].evidenceIds, ['evidence-table-1']);
  assert.deepEqual(result.scene.evidenceMarkers[0], {
    id: 'planned-evidence-marker-1',
    label: 'Table evidence',
    evidenceId: 'evidence-table-1',
    objectId: 'planned-object-1',
    roomId: 'living',
    position: [0, 0.1, 0],
    metadata: { plannerProvenance: 'explicit' },
  });
});

test('outdoor planning does not emit room connections or room assignments', async () => {
  const result = await planScene({
    description: 'A sedan and traffic cone are on a synthetic road.',
    environmentType: 'outdoor',
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.scene.environment.rooms.length, 0);
  assert.equal(result.scene.environment.sharedBoundaries.length, 0);
  assert.ok(result.scene.objects.every(({ roomId }) => roomId === undefined));
});

test('custom asset registries are used consistently by loading and diagnostics', async () => {
  const registry = structuredClone(assetRegistry);
  registry.test_prop = {
    id: 'test_prop',
    name: 'Test prop',
    category: 'prop',
    url: '/test_prop.glb',
    format: 'glb',
  };
  const candidate = structuredClone(mockRoomLayoutScenes[1]);
  candidate.objects[0].assetId = 'test_prop';
  const planner = new ScenePlanner({
    registry,
    provider: {
      id: 'test-custom-registry',
      supportsStructuredOutput: true,
      async generateScene() { return candidate; },
    },
  });
  const result = await planner.plan(baseRequest);
  assert.equal(result.success, true);
});
