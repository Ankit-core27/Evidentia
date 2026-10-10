import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assetRegistry,
  createSceneSelection,
  diagnoseScene,
  loadScene,
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

test('scene loader returns validated murder and road fixtures without changing their scene IDs', () => {
  const murder = loadScene(JSON.stringify(mockMurderScene));
  const road = loadScene(mockRoadAccidentScene);
  assert.equal(murder.success, true);
  assert.equal(murder.scene.sceneId, mockMurderScene.sceneId);
  assert.equal(road.success, true);
  assert.equal(road.scene.sceneId, mockRoadAccidentScene.sceneId);
});

test('scene loader reports malformed JSON and unsupported schema versions separately', () => {
  assert.equal(loadScene('{"sceneId":').diagnostics[0].code, 'INVALID_JSON');
  const unsupported = structuredClone(mockMurderScene);
  unsupported.schemaVersion = '2.0';
  const result = loadScene(unsupported);
  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, 'UNSUPPORTED_SCHEMA_VERSION');
  assert.equal(result.diagnostics[0].path, 'schemaVersion');
});

test('scene loader reports unknown assets and unresolved scene references with paths', () => {
  const unknownAsset = structuredClone(mockMurderScene);
  unknownAsset.objects[0].assetId = 'missing_asset';
  const assetResult = loadScene(unknownAsset);
  assert.equal(assetResult.success, false);
  assert.equal(assetResult.diagnostics[0].code, 'UNKNOWN_ASSET');
  assert.match(assetResult.diagnostics[0].path, /^objects\./);

  const unknownRoom = structuredClone(mockMurderScene);
  unknownRoom.objects[0].roomId = 'missing_room';
  const roomResult = loadScene(unknownRoom);
  assert.equal(roomResult.success, false);
  assert.ok(roomResult.diagnostics.some(({ code }) => code === 'INVALID_REFERENCE'));
});

test('scene loader rejects invalid camera transforms without treating them as JSON errors', () => {
  const scene = structuredClone(mockMurderScene);
  scene.camera.near = 300;
  scene.camera.far = 200;
  const result = loadScene(scene);
  assert.equal(result.success, false);
  assert.ok(result.diagnostics.some(({ code, path }) =>
    code === 'INVALID_SCENE' && path === 'camera.near'));
});

test('unavailable asset URLs are diagnosed as asset errors, independently of scene validity', () => {
  const diagnostics = diagnoseScene(mockRoadAccidentScene, assetRegistry, () => false);
  assert.ok(diagnostics.some(({ code }) => code === 'UNRESOLVED_ASSET_URL'));
  assert.equal(loadScene(mockRoadAccidentScene).success, true);
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

test('object selection payload preserves scene identity, transform, provenance, evidence IDs, and calibration', () => {
  const selection = createSceneSelection(mockMurderScene, 'knife-weapon');
  assert.equal(selection.kind, 'object');
  assert.equal(selection.id, 'knife-weapon');
  assert.equal(selection.name, 'Knife');
  assert.equal(selection.assetId, 'knife');
  assert.equal(selection.category, 'weapon');
  assert.deepEqual(selection.association, {
    sceneType: 'indoor',
    environmentType: 'residential_house',
    roomId: 'room-living-room',
    roomName: 'Living Room',
  });
  assert.deepEqual(selection.transform.position, [1.1, 0.025, -0.75]);
  assert.equal(selection.transform.space, 'world');
  assert.equal(selection.transform.positionUnit, 'meters');
  assert.equal(selection.transform.rotationUnit, 'degrees');
  assert.equal(selection.transform.scaleUnit, 'unitless');
  assert.deepEqual(selection.evidenceIds, ['evidence-knife-001']);
  assert.equal(selection.evidenceRecordAvailability, 'not-included-in-scene-schema');
  assert.equal(selection.provenance.source, 'manual');
  assert.equal(selection.provenance.confidence, 0.8);
  assert.equal(selection.calibration.status, 'source-bounds-inspected');
});

test('evidence marker selection is distinguishable and exposes the stable evidence reference', () => {
  const selection = createSceneSelection(mockMurderScene, 'marker-knife');
  assert.equal(selection.kind, 'evidence-marker');
  assert.equal(selection.id, 'marker-knife');
  assert.equal(selection.name, 'Knife evidence marker');
  assert.equal(selection.evidenceId, 'evidence-knife-001');
  assert.deepEqual(selection.evidenceIds, ['evidence-knife-001']);
  assert.equal(selection.objectId, 'knife-weapon');
  assert.equal(selection.calibration.status, 'source-bounds-inspected');
});

test('opening selections include world transforms from the room transform', () => {
  const scene = structuredClone(mockMultiRoomScene);
  scene.environment.rooms[0].rotation = [0, 90, 0];
  const selection = createSceneSelection(scene, 'opening-main-entry');
  assert.equal(selection.kind, 'object');
  assert.equal(selection.association.roomId, 'room-main');
  assert.ok(selection.transform.position.every(Number.isFinite));
  assert.equal(selection.transform.space, 'world');
});

test('unknown evidence IDs remain explicit references without invented records', () => {
  const scene = structuredClone(mockRoadAccidentScene);
  scene.objects[0].evidenceIds = ['evidence-not-included'];
  const selection = createSceneSelection(scene, 'road-segment');
  assert.deepEqual(selection.evidenceIds, ['evidence-not-included']);
  assert.equal(selection.evidenceRecordAvailability, 'not-included-in-scene-schema');
  assert.equal(createSceneSelection(scene, 'unknown-renderable-id'), null);
});

test('selection supports missing metadata and both indoor and outdoor scenes', () => {
  const indoor = createSceneSelection(mockMultiRoomScene, 'house-table');
  const outdoor = createSceneSelection(mockRoadAccidentScene, 'vehicle-motorcycle');
  assert.equal(indoor.kind, 'object');
  assert.equal(indoor.association.sceneType, 'indoor');
  assert.equal(indoor.provenance, undefined);
  assert.equal(indoor.metadata, undefined);
  assert.equal(indoor.calibration.status, 'source-bounds-inspected');
  assert.equal(outdoor.kind, 'object');
  assert.equal(outdoor.association.sceneType, 'road');
  assert.equal(outdoor.association.roomId, undefined);
  assert.equal(outdoor.calibration.status, 'not-inspected');
});
