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
  mockRoomLayoutScenes,
  resolveAssetTransform,
  roomLocalToWorld,
  worldToRoomLocal,
  hiddenSharedWalls,
  validateScene,
} from '../dist/index.js';
import { buildWallSegments } from '../dist/ProceduralRoom.js';

test('all supported demonstration fixtures validate using the registry', () => {
  for (const scene of [mockMurderScene, mockMultiRoomScene, mockRoadAccidentScene]) {
    assert.deepEqual(validateScene(scene, assetRegistry).errors, []);
  }
});

test('one-room fixture validates and 3, 5, and 10 room house fixtures are fully connected', () => {
  for (const [count, scene] of Object.entries(mockRoomLayoutScenes)) {
    assert.equal(scene.environment.rooms.length, Number(count));
    assert.deepEqual(validateScene(scene, assetRegistry).errors, []);
    const boundaries = scene.environment.sharedBoundaries;
    assert.equal(boundaries.length, Number(count) === 1 ? 0 : Number(count) === 3 ? 2 : Number(count) === 5 ? 5 : 13);
    assert.ok(scene.environment.rooms.every(({ rotation, dimensions }) =>
      rotation?.[1] !== undefined && dimensions.width > 0 && dimensions.depth > 0));
    assert.ok(!diagnoseScene(scene).some(({ code, severity }) =>
      code === 'SHARED_BOUNDARY_MISALIGNED' && severity === 'warning'));
    assert.ok(!diagnoseScene(scene).some(({ code }) =>
      code === 'ROOM_FOOTPRINT_OVERLAP' || code === 'ROOM_UNREACHABLE_FROM_ENTRANCE'));
    if (Number(count) === 1) continue;
    const reachable = new Set([scene.environment.entranceRoomId]);
    const queue = [scene.environment.entranceRoomId];
    while (queue.length) {
      const roomId = queue.shift();
      for (const boundary of boundaries) {
        const roomA = scene.environment.rooms.find(({ id }) => id === boundary.roomA);
        const roomB = scene.environment.rooms.find(({ id }) => id === boundary.roomB);
        const opening = roomA.openings.find(({ id }) => id === boundary.openingId);
        assert.ok(opening);
        assert.equal(opening.type, 'door');
        assert.equal(opening.wall, boundary.wallA);
        const span = boundary.wallA === 'north' || boundary.wallA === 'south'
          ? roomA.dimensions.width
          : roomA.dimensions.depth;
        assert.ok(opening.offset >= 0 && opening.offset + opening.width <= span);
        const wallCenter = (room, wall) => roomLocalToWorld(
          wall === 'north' ? [0, 0, -room.dimensions.depth / 2] :
            wall === 'south' ? [0, 0, room.dimensions.depth / 2] :
              wall === 'east' ? [room.dimensions.width / 2, 0, 0] :
                [-room.dimensions.width / 2, 0, 0],
          room,
        );
        const centerA = wallCenter(roomA, boundary.wallA);
        const centerB = wallCenter(roomB, boundary.wallB);
        assert.ok(Math.hypot(...centerA.map((value, index) => value - centerB[index])) < 0.001);
        const spanB = boundary.wallB === 'north' || boundary.wallB === 'south'
          ? roomB.dimensions.width
          : roomB.dimensions.depth;
        assert.ok(Math.abs(span - spanB) < 0.001);
        const wallSegments = buildWallSegments(span, roomA.dimensions.height, [opening]);
        const openingStart = -span / 2 + opening.offset;
        const openingEnd = openingStart + opening.width;
        assert.ok(wallSegments.every(({ center, bottom, height }) =>
          center < openingStart || center > openingEnd ||
          bottom >= opening.sillHeight + opening.height || bottom + height <= opening.sillHeight));
        assert.ok(hiddenSharedWalls(scene, boundary.roomB).includes(boundary.wallB));
        const neighbor = boundary.roomA === roomId
          ? boundary.roomB
          : boundary.roomB === roomId
            ? boundary.roomA
            : undefined;
        if (neighbor && !reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    assert.equal(reachable.size, Number(count));
  }
});

test('shared-boundary suppression hides only room B duplicate walls', () => {
  const scene = mockRoomLayoutScenes[3];
  const [boundary] = scene.environment.sharedBoundaries;
  assert.deepEqual(hiddenSharedWalls(scene, boundary.roomA), []);
  assert.deepEqual(hiddenSharedWalls(scene, boundary.roomB), [boundary.wallB]);
  assert.deepEqual(hiddenSharedWalls(scene, 'unconnected-room'), []);
});

test('rotated room openings render in room-local coordinates and selection reports their world position', () => {
  const scene = mockRoomLayoutScenes[5];
  const room = scene.environment.rooms.find(({ openings }) =>
    openings.some(({ type, wall }) => type === 'door' && wall === 'east'));
  const door = room.openings.find(({ type, wall }) => type === 'door' && wall === 'east');
  const span = room.dimensions.depth;
  const localPosition = [room.dimensions.width / 2 - (room.wallThickness ?? 0.12) / 2,
    door.sillHeight, -span / 2 + door.offset + door.width / 2];
  const selection = createSceneSelection(scene, door.id);
  assert.notEqual(room.rotation[1], 0);
  assert.deepEqual(selection.transform.position, roomLocalToWorld(localPosition, room));
  assert.ok(worldToRoomLocal(selection.transform.position, room)
    .every((value, index) => Math.abs(value - localPosition[index]) < 1e-9));
  assert.equal(selection.association.roomId, room.id);
  assert.ok(buildWallSegments(span, room.dimensions.height, [door]).length > 0);
  const doorSegments = buildWallSegments(span, room.dimensions.height, [door])
    .filter(({ center }) =>
      center > -span / 2 + door.offset && center < -span / 2 + door.offset + door.width);
  assert.ok(doorSegments.every(({ bottom, height }) =>
    bottom >= door.sillHeight + door.height || bottom + height <= door.sillHeight));
});

test('room-local window openings leave wall segments above and below the aperture', () => {
  const room = mockRoomLayoutScenes[5].environment.rooms[0];
  const window = room.openings.find(({ type }) => type === 'window');
  const segments = buildWallSegments(room.dimensions.width, room.dimensions.height, [window]);
  const atWindow = segments.filter(({ center }) =>
    center > -room.dimensions.width / 2 + window.offset &&
    center < -room.dimensions.width / 2 + window.offset + window.width);
  assert.ok(atWindow.some(({ bottom }) => bottom === 0));
  assert.ok(atWindow.some(({ bottom, height }) => bottom + height === room.dimensions.height));
  assert.ok(atWindow.every(({ bottom, height }) =>
    bottom + height <= window.sillHeight || bottom >= window.sillHeight + window.height));
});

test('world-space object transforms are not changed by rotated room association', () => {
  const scene = mockRoomLayoutScenes[3];
  const object = scene.objects[0];
  const selection = createSceneSelection(scene, object.id);
  assert.deepEqual(selection.transform.position, object.transform.position);
  assert.equal(selection.association.roomId, object.roomId);
  assert.ok(mockRoadAccidentScene.objects.every(({ roomId }) => roomId === undefined));
  assert.deepEqual(validateScene(mockRoadAccidentScene, assetRegistry).errors, []);
});

test('spatial diagnostics report missing rooms and marker association inconsistencies', () => {
  const invalidRoom = structuredClone(mockRoomLayoutScenes[3]);
  invalidRoom.objects[0].roomId = 'room-does-not-exist';
  assert.ok(validateScene(invalidRoom).errors.some(({ message }) => message.includes('was not found')));

  const mismatch = structuredClone(mockRoomLayoutScenes[3]);
  mismatch.evidenceMarkers[0].roomId = mismatch.environment.rooms[1].id;
  mismatch.evidenceMarkers[0].position = [100, 0, 100];
  const codes = diagnoseScene(mismatch).map(({ code }) => code);
  assert.ok(codes.includes('MARKER_OBJECT_ROOM_MISMATCH'));
  assert.ok(codes.includes('MARKER_OUTSIDE_ROOM'));

  const markerOutsideObjectRoom = structuredClone(mockRoomLayoutScenes[3]);
  markerOutsideObjectRoom.evidenceMarkers[0].roomId = undefined;
  markerOutsideObjectRoom.evidenceMarkers[0].position = [100, 0, 100];
  assert.ok(diagnoseScene(markerOutsideObjectRoom).some(({ code }) =>
    code === 'MARKER_OBJECT_POSITION_MISMATCH'));
});

test('misaligned explicit room connections and openings on suppressed walls are warnings', () => {
  const scene = structuredClone(mockRoomLayoutScenes[3]);
  const [boundary] = scene.environment.sharedBoundaries;
  const roomB = scene.environment.rooms.find(({ id }) => id === boundary.roomB);
  roomB.openings.push({
    id: 'unexpected-suppressed-opening',
    type: 'door',
    wall: boundary.wallB,
    offset: 1,
    width: 0.8,
    height: 2,
    sillHeight: 0,
  });
  roomB.position[0] += 0.4;
  const diagnostics = diagnoseScene(scene);
  assert.ok(diagnostics.some(({ code, severity }) =>
    code === 'SHARED_BOUNDARY_MISALIGNED' && severity === 'warning'));
  assert.ok(diagnostics.some(({ code, severity }) =>
    code === 'OPENING_ON_SUPPRESSED_BOUNDARY' && severity === 'warning'));
  assert.ok(diagnostics.some(({ code, path }) =>
    code === 'ROOM_UNREACHABLE_FROM_ENTRANCE' && path.includes('room-3-2')));
});

test('unconnected overlapping room footprints are warned rather than treated as a connection', () => {
  const scene = structuredClone(mockRoomLayoutScenes[3]);
  scene.environment.rooms[2].position = [...scene.environment.rooms[0].position];
  const diagnostic = diagnoseScene(scene).find(({ code }) => code === 'ROOM_FOOTPRINT_OVERLAP');
  assert.ok(diagnostic);
  assert.equal(diagnostic.severity, 'warning');
  assert.match(diagnostic.message, /adjacency is not inferred/);
});

test('entrance reachability reports disconnected rooms unless explicitly permitted', () => {
  const scene = structuredClone(mockRoomLayoutScenes[3]);
  scene.environment.sharedBoundaries.splice(1, 1);
  const unreachable = diagnoseScene(scene).filter(({ code }) =>
    code === 'ROOM_UNREACHABLE_FROM_ENTRANCE');
  assert.equal(unreachable.length, 1);
  scene.environment.allowDisconnectedRooms = true;
  assert.equal(diagnoseScene(scene).filter(({ code }) =>
    code === 'ROOM_UNREACHABLE_FROM_ENTRANCE').length, 0);
});

test('shared doorway references must identify a door on the owning shared wall', () => {
  const scene = structuredClone(mockRoomLayoutScenes[3]);
  scene.environment.sharedBoundaries[0].openingId = 'not-a-door';
  assert.ok(validateScene(scene).errors.some(({ message }) => message.includes('was not found')));
  assert.ok(diagnoseScene(scene).some(({ code, severity }) =>
    code === 'BOUNDARY_DOORWAY_INVALID' && severity === 'error'));

  const raisedThreshold = structuredClone(mockRoomLayoutScenes[3]);
  const roomA = raisedThreshold.environment.rooms.find(({ id }) =>
    id === raisedThreshold.environment.sharedBoundaries[0].roomA);
  roomA.openings.find(({ id }) =>
    id === raisedThreshold.environment.sharedBoundaries[0].openingId).sillHeight = 0.2;
  assert.ok(diagnoseScene(raisedThreshold).some(({ code }) =>
    code === 'BOUNDARY_DOORWAY_BLOCKED'));
});

test('wall intersections use only explicitly verified metre bounds and respect authored openings', () => {
  const scene = structuredClone(mockRoomLayoutScenes[1]);
  const room = scene.environment.rooms[0];
  const object = scene.objects[0];
  const registry = structuredClone(assetRegistry);
  registry.chair_wooden.calibration = {
    status: 'physical-dimensions-verified',
    sourceUnits: 'meters',
    sourceDimensions: [0.8, 1, 0.6],
    originConvention: 'bottom',
    physicalDimensions: { width: 0.8, height: 1, depth: 0.6, unit: 'meters' },
  };

  object.transform.position = [room.position[0] + room.dimensions.width / 2 - 0.05, 0, room.position[2]];
  assert.ok(diagnoseScene(scene, registry).some(({ code, severity }) =>
    code === 'OBJECT_WALL_INTERSECTION' && severity === 'warning'));

  room.openings.push({
    id: 'test-door-opening',
    type: 'door',
    wall: 'east',
    offset: (room.dimensions.depth - 1) / 2,
    width: 1,
    height: 2,
    sillHeight: 0,
  });
  object.transform.position = [room.position[0] + room.dimensions.width / 2, 0, room.position[2]];
  assert.ok(!diagnoseScene(scene, registry).some(({ code }) => code === 'OBJECT_WALL_INTERSECTION'));

  registry.chair_wooden.calibration.status = 'source-bounds-inspected';
  assert.ok(!diagnoseScene(scene, registry).some(({ code }) => code === 'OBJECT_WALL_INTERSECTION'));
});

test('schema rejects zero scale and cyclic parent references', () => {
  const zeroScale = structuredClone(mockRoomLayoutScenes[3]);
  zeroScale.objects[0].transform.scale[1] = 0;
  assert.ok(validateScene(zeroScale).errors.some(({ path }) => path.includes('scale')));

  const parentCycle = structuredClone(mockRoomLayoutScenes[3]);
  parentCycle.objects[0].parentId = parentCycle.objects[1].id;
  parentCycle.objects[1].parentId = parentCycle.objects[0].id;
  assert.ok(validateScene(parentCycle).errors.some(({ message }) => message.includes('cycle')));
});

test('schema rejects openings and shared boundaries that cannot be rendered from authored wall data', () => {
  const scene = structuredClone(mockRoomLayoutScenes[3]);
  scene.environment.rooms[0].layoutMode = 'authored';
  assert.ok(validateScene(scene).errors.some(({ message }) =>
    message.includes('Room openings require procedural layout mode')));
  assert.ok(validateScene(scene).errors.some(({ message }) =>
    message.includes('Shared boundaries require procedural layout mode')));
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
