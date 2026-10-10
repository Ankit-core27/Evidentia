import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assetRegistry,
  diagnoseScene,
  mockMultiRoomScene,
  mockMurderScene,
  mockRoadAccidentScene,
  resolveAssetTransform,
  validateScene,
} from '../dist/index.js';
import { buildWallSegments } from '../dist/ProceduralRoom.js';

test('all supported demonstration fixtures validate using the registry', () => {
  for (const scene of [mockMurderScene, mockMultiRoomScene, mockRoadAccidentScene]) {
    assert.deepEqual(validateScene(scene, assetRegistry).errors, []);
  }
});

test('procedural room openings reject out-of-bounds and overlapping geometry', () => {
  const outside = structuredClone(mockMultiRoomScene);
  outside.environment.rooms[0].openings[0].offset = 5.5;
  assert.match(
    validateScene(outside, assetRegistry).errors.map(({ message }) => message).join('\n'),
    /extends beyond/,
  );

  const overlapping = structuredClone(mockMultiRoomScene);
  overlapping.environment.rooms[0].openings.push({
    id: 'opening-main-overlap',
    type: 'window',
    wall: 'south',
    offset: 2.8,
    width: 0.8,
    height: 1,
    sillHeight: 0.8,
  });
  assert.match(
    validateScene(overlapping, assetRegistry).errors.map(({ message }) => message).join('\n'),
    /overlaps opening/,
  );

  const tiltedRoom = structuredClone(mockMultiRoomScene);
  tiltedRoom.environment.rooms[0].rotation = [5, 0, 0];
  assert.match(
    validateScene(tiltedRoom, assetRegistry).errors.map(({ message }) => message).join('\n'),
    /Y axis only/,
  );
});

test('procedural wall segmentation leaves door and window openings while retaining wall panels', () => {
  const segments = buildWallSegments(6, 3, [
    { id: 'door', type: 'door', wall: 'south', offset: 2, width: 1, height: 2.1, sillHeight: 0 },
    { id: 'window', type: 'window', wall: 'south', offset: 4, width: 1, height: 1, sillHeight: 1 },
  ]);
  assert.ok(segments.some(({ bottom, height }) => bottom === 2.1 && height > 0));
  assert.ok(segments.some(({ bottom, height }) => bottom === 0 && height === 1));
  assert.equal(segments.some(({ center, bottom }) => center === -0.5 && bottom < 2.1), false);
});

test('diagnostics identify room containment and shared-boundary mismatches', () => {
  const scene = structuredClone(mockMultiRoomScene);
  scene.objects[0].transform.position = [20, 0, 0];
  scene.environment.rooms[1].position[0] = 6;
  const codes = diagnoseScene(scene).map(({ code }) => code);
  assert.ok(codes.includes('OBJECT_OUTSIDE_ROOM'));
  assert.ok(codes.includes('SHARED_BOUNDARY_MISALIGNED'));
  const unresolvedAssetCodes = diagnoseScene(mockRoadAccidentScene, assetRegistry, () => false)
    .map(({ code }) => code);
  assert.ok(unresolvedAssetCodes.includes('UNRESOLVED_ASSET_URL'));
  const unknownScale = structuredClone(mockRoadAccidentScene);
  unknownScale.objects[0].transform.scale = [101, 1, 1];
  const scaleDiagnostics = diagnoseScene(unknownScale).map(({ code }) => code);
  assert.ok(scaleDiagnostics.includes('SUSPICIOUS_SCALE'));
  assert.ok(scaleDiagnostics.includes('ASSET_CALIBRATION_UNVERIFIED'));

  const invalidReference = structuredClone(mockRoadAccidentScene);
  invalidReference.objects[0].roomId = 'missing-room';
  assert.ok(diagnoseScene(invalidReference).some(({ code }) => code === 'INVALID_SCENE'));
});

test('asset transform corrections are centralized and do not mutate scene transforms', () => {
  const source = {
    position: [1, 2, 3],
    rotation: [0, 10, 0],
    scale: [2, 2, 2],
  };
  const result = resolveAssetTransform(source, {
    status: 'demo-scale-estimate',
    sourceUnits: 'unknown',
    positionCorrection: [0, 0.5, 0],
    rotationCorrection: [0, -10, 0],
    defaultScale: [0.5, 1, 2],
  });

  assert.deepEqual(result, {
    position: [1, 3, 3],
    rotation: [0, 0, 0],
    scale: [1, 2, 4],
  });
  assert.deepEqual(source.position, [1, 2, 3]);
  assert.equal(assetRegistry.door_wooden.calibration?.status, 'source-bounds-inspected');
});
