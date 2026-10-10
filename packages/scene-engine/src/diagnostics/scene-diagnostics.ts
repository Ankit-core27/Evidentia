import { Euler, Vector3 as ThreeVector3 } from 'three';

import { assetRegistry, resolveAssetTransform, type AssetRegistry } from '../assets/asset-registry.js';
import { validateScene } from '../schema/scene.schema.js';
import { worldToRoomLocal } from '../spatial.js';
import type {
  RoomDefinition,
  RoomWall,
  SceneDefinition,
  SceneDiagnostic,
  Vector3,
} from '../types/scene.js';

const roomSpan = (room: RoomDefinition, wall: RoomWall) =>
  wall === 'north' || wall === 'south'
    ? room.dimensions?.width ?? room.dimensions?.length
    : room.dimensions?.depth;

function wallCenter(room: RoomDefinition, wall: RoomWall): Vector3 {
  const width = room.dimensions?.width ?? room.dimensions?.length ?? 0;
  const depth = room.dimensions?.depth ?? 0;
  const local: Vector3 =
    wall === 'north' ? [0, 0, -depth / 2] :
      wall === 'south' ? [0, 0, depth / 2] :
        wall === 'east' ? [width / 2, 0, 0] : [-width / 2, 0, 0];
  const radians = ((room.rotation?.[1] ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    (room.position?.[0] ?? 0) + local[0] * cosine + local[2] * sine,
    (room.position?.[1] ?? 0) + local[1],
    (room.position?.[2] ?? 0) - local[0] * sine + local[2] * cosine,
  ];
}

function wallNormal(room: RoomDefinition, wall: RoomWall): Vector3 {
  const normal: Vector3 =
    wall === 'north' ? [0, 0, -1] :
      wall === 'south' ? [0, 0, 1] :
        wall === 'east' ? [1, 0, 0] : [-1, 0, 0];
  const radians = ((room.rotation?.[1] ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [normal[0] * cosine + normal[2] * sine, normal[1], -normal[0] * sine + normal[2] * cosine];
}

function sharedWallsAlign(roomA: RoomDefinition, wallA: RoomWall, roomB: RoomDefinition, wallB: RoomWall) {
  const spanA = roomSpan(roomA, wallA);
  const spanB = roomSpan(roomB, wallB);
  const heightA = roomA.dimensions?.height;
  const heightB = roomB.dimensions?.height;
  if (spanA === undefined || spanB === undefined || heightA === undefined || heightB === undefined) {
    return false;
  }
  const centerA = wallCenter(roomA, wallA);
  const centerB = wallCenter(roomB, wallB);
  const centerDistance = Math.hypot(
    centerA[0] - centerB[0],
    centerA[1] - centerB[1],
    centerA[2] - centerB[2],
  );
  const normalA = wallNormal(roomA, wallA);
  const normalB = wallNormal(roomB, wallB);
  const normalDot = normalA[0] * normalB[0] + normalA[2] * normalB[2];
  return centerDistance <= 0.05 &&
    Math.abs(spanA - spanB) <= 0.05 &&
    Math.abs(heightA - heightB) <= 0.05 &&
    normalDot <= -0.999;
}

function roomsOverlapInPlan(a: RoomDefinition, b: RoomDefinition, tolerance = 0.01): boolean {
  const dimensionsA = a.dimensions;
  const dimensionsB = b.dimensions;
  const widthA = dimensionsA?.width ?? dimensionsA?.length;
  const widthB = dimensionsB?.width ?? dimensionsB?.length;
  const depthA = dimensionsA?.depth;
  const depthB = dimensionsB?.depth;
  if (widthA === undefined || widthB === undefined || depthA === undefined || depthB === undefined) {
    return false;
  }
  const rotationA = ((a.rotation?.[1] ?? 0) * Math.PI) / 180;
  const rotationB = ((b.rotation?.[1] ?? 0) * Math.PI) / 180;
  const axes = [
    [Math.cos(rotationA), -Math.sin(rotationA)],
    [Math.sin(rotationA), Math.cos(rotationA)],
    [Math.cos(rotationB), -Math.sin(rotationB)],
    [Math.sin(rotationB), Math.cos(rotationB)],
  ];
  const deltaX = (b.position?.[0] ?? 0) - (a.position?.[0] ?? 0);
  const deltaZ = (b.position?.[2] ?? 0) - (a.position?.[2] ?? 0);

  return axes.every(([axisX, axisZ]) => {
    const distance = Math.abs(deltaX * axisX + deltaZ * axisZ);
    const radiusA = widthA / 2 * Math.abs(Math.cos(rotationA) * axisX - Math.sin(rotationA) * axisZ) +
      depthA / 2 * Math.abs(Math.sin(rotationA) * axisX + Math.cos(rotationA) * axisZ);
    const radiusB = widthB / 2 * Math.abs(Math.cos(rotationB) * axisX - Math.sin(rotationB) * axisZ) +
      depthB / 2 * Math.abs(Math.sin(rotationB) * axisX + Math.cos(rotationB) * axisZ);
    return distance < radiusA + radiusB - tolerance;
  });
}

function intersectsRoomWall(
  scene: SceneDefinition,
  room: RoomDefinition,
  object: SceneDefinition['objects'][number],
  registry: AssetRegistry,
): boolean | undefined {
  const entry = registry[object.assetId];
  const calibration = entry?.calibration;
  const dimensions = calibration?.physicalDimensions;
  const width = dimensions?.width;
  const height = dimensions?.height;
  const depth = dimensions?.depth;
  if (
    calibration?.status !== 'physical-dimensions-verified' ||
    calibration.originConvention !== 'center' && calibration.originConvention !== 'bottom' ||
    dimensions?.unit !== 'meters' ||
    width === undefined || height === undefined || depth === undefined ||
    room.layoutMode !== 'procedural'
  ) {
    return undefined;
  }

  const transform = resolveAssetTransform(object.transform, calibration, entry.defaultScale, scene.coordinateSystem.rotationOrder);
  const rotation = new Euler(
    transform.rotation[0] * Math.PI / 180,
    transform.rotation[1] * Math.PI / 180,
    transform.rotation[2] * Math.PI / 180,
    scene.coordinateSystem.rotationOrder,
  );
  const halfSize = [
    width * Math.abs(transform.scale[0]) / 2,
    height * Math.abs(transform.scale[1]) / 2,
    depth * Math.abs(transform.scale[2]) / 2,
  ];
  const originOffsetY = calibration.originConvention === 'bottom' ? halfSize[1] : 0;
  const localBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const x of [-halfSize[0], halfSize[0]]) {
    for (const y of [-halfSize[1], halfSize[1]]) {
      for (const z of [-halfSize[2], halfSize[2]]) {
        const corner = new ThreeVector3(x, y + originOffsetY, z).applyEuler(rotation);
        const world: Vector3 = [
          transform.position[0] + corner.x,
          transform.position[1] + corner.y,
          transform.position[2] + corner.z,
        ];
        const local = worldToRoomLocal(world, room);
        for (let axis = 0; axis < 3; axis += 1) {
          localBounds.min[axis] = Math.min(localBounds.min[axis], local[axis]);
          localBounds.max[axis] = Math.max(localBounds.max[axis], local[axis]);
        }
      }
    }
  }

  const roomWidth = room.dimensions?.width ?? room.dimensions?.length ?? 0;
  const roomDepth = room.dimensions?.depth ?? 0;
  const roomHeight = room.dimensions?.height ?? 0;
  const halfThickness = (room.wallThickness ?? 0.12) / 2;
  const verticalOverlap = localBounds.min[1] < roomHeight && localBounds.max[1] > 0;
  if (!verticalOverlap) return false;

  const walls = [
    { side: 'north' as const, min: -roomDepth / 2 - halfThickness, max: -roomDepth / 2 + halfThickness, minAxis: 2 },
    { side: 'south' as const, min: roomDepth / 2 - halfThickness, max: roomDepth / 2 + halfThickness, minAxis: 2 },
    { side: 'west' as const, min: -roomWidth / 2 - halfThickness, max: -roomWidth / 2 + halfThickness, minAxis: 0 },
    { side: 'east' as const, min: roomWidth / 2 - halfThickness, max: roomWidth / 2 + halfThickness, minAxis: 0 },
  ];
  return walls.some(({ side, min, max, minAxis }) => {
    if (localBounds.min[minAxis] >= max || localBounds.max[minAxis] <= min) return false;
    const horizontalAxis = minAxis === 2 ? 0 : 2;
    const openingSpan = minAxis === 2 ? roomWidth : roomDepth;
    const coveredByOpening = (room.openings ?? [])
      .filter(({ wall }) => wall === side)
      .some((opening) => {
        const openingMin = -openingSpan / 2 + opening.offset;
        const openingMax = openingMin + opening.width;
        return localBounds.min[horizontalAxis] >= openingMin &&
          localBounds.max[horizontalAxis] <= openingMax &&
          localBounds.min[1] >= opening.sillHeight &&
          localBounds.max[1] <= opening.sillHeight + opening.height;
      });
    return !coveredByOpening;
  });
}

function add(
  diagnostics: SceneDiagnostic[],
  severity: SceneDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
) {
  diagnostics.push({ severity, code, path, message });
}

export function diagnoseScene(
  scene: SceneDefinition,
  registry: AssetRegistry = assetRegistry,
  assetUrlExists?: (url: string) => boolean,
): SceneDiagnostic[] {
  const diagnostics: SceneDiagnostic[] = [];
  const validation = validateScene(scene, registry);
  validation.errors.forEach((issue) =>
    add(diagnostics, 'error', 'INVALID_SCENE', issue.path, issue.message),
  );

  const assetIds = [
    ...scene.objects.map((object) => ({ id: object.assetId, path: `objects.${object.id}.assetId` })),
    ...scene.environment.rooms.flatMap((room) => [
      ...(room.openings ?? []).flatMap((opening) =>
        opening.assetId ? [{ id: opening.assetId, path: `environment.rooms.${room.id}.openings.${opening.id}.assetId` }] : [],
      ),
      ...(['floorTiles', 'walls', 'doors', 'windows'] as const).flatMap((category) =>
        (room.structural?.[category] ?? []).map((placement) => ({
          id: placement.assetId,
          path: `environment.rooms.${room.id}.structural.${category}.${placement.id}.assetId`,
        })),
      ),
    ]),
  ];

  const diagnosedAssets = new Set<string>();
  for (const { id, path } of assetIds) {
    const asset = registry[id];
    if (!asset) {
      add(diagnostics, 'error', 'UNKNOWN_ASSET', path, `Asset "${id}" is not present in the registry.`);
      continue;
    }
    if (diagnosedAssets.has(id)) continue;
    diagnosedAssets.add(id);
    if (!asset.url.startsWith('/') && !/^https?:\/\//i.test(asset.url)) {
      add(diagnostics, 'error', 'UNRESOLVED_ASSET_URL', `${path}.url`, `Asset URL "${asset.url}" is not an absolute browser path or HTTP URL.`);
    }
    if (assetUrlExists && !assetUrlExists(asset.url)) {
      add(diagnostics, 'error', 'UNRESOLVED_ASSET_URL', `${path}.url`, `Asset URL "${asset.url}" could not be resolved by the supplied URL checker.`);
    }
    const status = asset.calibration?.status ?? (asset.dimensions ? 'source-bounds-inspected' : 'not-inspected');
    if (status !== 'physical-dimensions-verified') {
      const message = status === 'not-inspected'
        ? 'Asset bounds and physical scale have not been inspected; displayed size may be inaccurate.'
        : status === 'demo-scale-estimate'
          ? 'Asset scale is a demonstration estimate, not a verified physical measurement.'
          : 'Asset source bounds were inspected, but source units are not verified physical measurements.';
      add(diagnostics, 'warning', 'ASSET_CALIBRATION_UNVERIFIED', path, message);
    }
  }

  for (const object of scene.objects) {
    for (const [axis, value] of object.transform.scale.entries()) {
      if (Math.abs(value) < 0.01 || Math.abs(value) > 100) {
        add(
          diagnostics,
          'warning',
          'SUSPICIOUS_SCALE',
          `objects.${object.id}.transform.scale.${axis}`,
          `Scale component ${value} is unusually small or large; confirm the source asset units.`,
        );
      }
    }

    if (!object.roomId) continue;
    const room = scene.environment.rooms.find(({ id }) => id === object.roomId);
    if (!room) continue;
    const width = room.dimensions?.width ?? room.dimensions?.length;
    const depth = room.dimensions?.depth;
    const height = room.dimensions?.height;
    if (!width || !depth || !height) continue;
    const inverseRotated = worldToRoomLocal(object.transform.position, room);
    if (
      Math.abs(inverseRotated[0]) > width / 2 + 0.05 ||
      Math.abs(inverseRotated[2]) > depth / 2 + 0.05 ||
      inverseRotated[1] < -0.05 ||
      inverseRotated[1] > height + 0.05
    ) {
      add(
        diagnostics,
        'warning',
        'OBJECT_OUTSIDE_ROOM',
        `objects.${object.id}.transform.position`,
        `Object center falls outside room "${room.id}" bounds. This check does not account for the object's full dimensions.`,
      );
    }
    const wallIntersection = intersectsRoomWall(scene, room, object, registry);
    if (wallIntersection) {
      add(
        diagnostics,
        'warning',
        'OBJECT_WALL_INTERSECTION',
        `objects.${object.id}.transform`,
        `The verified asset bounds for "${object.id}" intersect a wall of room "${room.id}". Confirm the authored placement; no automatic correction was applied.`,
      );
    }
  }

  for (let roomIndex = 0; roomIndex < scene.environment.rooms.length; roomIndex += 1) {
    const room = scene.environment.rooms[roomIndex];
    for (const other of scene.environment.rooms.slice(roomIndex + 1)) {
      if (!roomsOverlapInPlan(room, other)) continue;
      add(
        diagnostics,
        'warning',
        'ROOM_FOOTPRINT_OVERLAP',
        `environment.rooms.${room.id}`,
        `Room "${room.id}" overlaps room "${other.id}" in plan view. Room adjacency is not inferred from overlap.`,
      );
    }
  }

  for (const marker of scene.evidenceMarkers) {
    const referencedObject = marker.objectId
      ? scene.objects.find(({ id }) => id === marker.objectId)
      : undefined;
    if (referencedObject?.roomId && marker.roomId && referencedObject.roomId !== marker.roomId) {
      add(
        diagnostics,
        'warning',
        'MARKER_OBJECT_ROOM_MISMATCH',
        `evidenceMarkers.${marker.id}.roomId`,
        `Marker room "${marker.roomId}" differs from referenced object room "${referencedObject.roomId}".`,
      );
    }

    const associatedRoomId = marker.roomId ?? referencedObject?.roomId;
    if (!associatedRoomId) continue;
    const room = scene.environment.rooms.find(({ id }) => id === associatedRoomId);
    if (!room) continue;
    const width = room.dimensions?.width ?? room.dimensions?.length;
    const depth = room.dimensions?.depth;
    const height = room.dimensions?.height;
    if (width === undefined || depth === undefined || height === undefined) continue;
    const local = worldToRoomLocal(marker.position, room);
    if (
      Math.abs(local[0]) > width / 2 + 0.05 ||
      Math.abs(local[2]) > depth / 2 + 0.05 ||
      local[1] < -0.05 ||
      local[1] > height + 0.05
    ) {
      add(
        diagnostics,
        'warning',
        marker.roomId ? 'MARKER_OUTSIDE_ROOM' : 'MARKER_OBJECT_POSITION_MISMATCH',
        `evidenceMarkers.${marker.id}.position`,
        marker.roomId
          ? `Evidence marker center falls outside room "${room.id}" bounds.`
          : `Evidence marker lies outside referenced object "${referencedObject?.id}" room "${room.id}".`,
      );
    }
  }

  for (const [index, boundary] of (scene.environment.sharedBoundaries ?? []).entries()) {
    const roomA = scene.environment.rooms.find(({ id }) => id === boundary.roomA);
    const roomB = scene.environment.rooms.find(({ id }) => id === boundary.roomB);
    if (!roomA || !roomB) continue;
    const spanA = roomSpan(roomA, boundary.wallA);
    if (spanA === undefined) continue;
    const heightA = roomA.dimensions?.height;
    const aligned = sharedWallsAlign(roomA, boundary.wallA, roomB, boundary.wallB);
    const opening = boundary.openingId
      ? roomA.openings?.find(({ id }) => id === boundary.openingId)
      : roomA.openings?.find(({ type, wall }) => type === 'door' && wall === boundary.wallA);
    if (boundary.openingId && (!opening || opening.type !== 'door' || opening.wall !== boundary.wallA)) {
      add(
        diagnostics,
        'error',
        'BOUNDARY_DOORWAY_INVALID',
        `environment.sharedBoundaries.${index}.openingId`,
        `Boundary "${boundary.id}" must reference a door opening on room "${roomA.id}" wall "${boundary.wallA}".`,
      );
    }
    const openingsOnSuppressedWall = roomB.openings?.filter(({ wall }) => wall === boundary.wallB) ?? [];
    if (openingsOnSuppressedWall.length > 0) {
      add(
        diagnostics,
        'warning',
        'OPENING_ON_SUPPRESSED_BOUNDARY',
        `environment.rooms.${roomB.id}.openings`,
        `Room "${roomB.id}" has openings on its suppressed shared wall; put the opening on room A's wall so the renderer cuts the shared geometry.`,
      );
    }
    if (!aligned) {
      add(
        diagnostics,
        'warning',
        'SHARED_BOUNDARY_MISALIGNED',
        `environment.sharedBoundaries.${index}`,
        `Rooms "${roomA.id}" and "${roomB.id}" do not have matching, opposing wall planes; room A supplies the boundary geometry while room B's duplicate wall is suppressed.`,
      );
    }
    if (opening && (
      opening.offset < 0 ||
      opening.offset + opening.width > spanA + 0.001 ||
      opening.sillHeight < 0 ||
      opening.sillHeight + opening.height > (heightA ?? 0) + 0.001
    )) {
      add(
        diagnostics,
        'error',
        'BOUNDARY_DOORWAY_OUT_OF_BOUNDS',
        `environment.rooms.${roomA.id}.openings.${opening.id}`,
        `Doorway "${opening.id}" does not fit inside the shared wall between "${roomA.id}" and "${roomB.id}".`,
      );
    }
    if (opening && opening.sillHeight > 0.001) {
      add(
        diagnostics,
        'warning',
        'BOUNDARY_DOORWAY_BLOCKED',
        `environment.rooms.${roomA.id}.openings.${opening.id}.sillHeight`,
        `Doorway "${opening.id}" has a raised sill and does not provide a clear floor-level passage.`,
      );
    }
  }

  const entranceRoomId = scene.environment.entranceRoomId;
  if (entranceRoomId && !scene.environment.allowDisconnectedRooms) {
    const reachable = new Set([entranceRoomId]);
    const queue = [entranceRoomId];
    while (queue.length > 0) {
      const currentRoomId = queue.shift()!;
      for (const boundary of scene.environment.sharedBoundaries ?? []) {
        const roomA = scene.environment.rooms.find(({ id }) => id === boundary.roomA);
        const roomB = scene.environment.rooms.find(({ id }) => id === boundary.roomB);
        if (!roomA || !roomB || !sharedWallsAlign(roomA, boundary.wallA, roomB, boundary.wallB)) continue;
        const opening = boundary.openingId
          ? roomA.openings?.find(({ id }) => id === boundary.openingId)
          : roomA.openings?.find(({ type, wall }) => type === 'door' && wall === boundary.wallA);
        const span = roomSpan(roomA, boundary.wallA);
        if (
          !opening ||
          opening.type !== 'door' ||
          opening.wall !== boundary.wallA ||
          span === undefined ||
          opening.offset < 0 ||
          opening.offset + opening.width > span ||
          opening.sillHeight > 0.001 ||
          opening.sillHeight + opening.height > (roomA.dimensions?.height ?? 0)
        ) continue;
        const neighbor = boundary.roomA === currentRoomId
          ? boundary.roomB
          : boundary.roomB === currentRoomId
            ? boundary.roomA
            : undefined;
        if (neighbor && !reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    for (const room of scene.environment.rooms) {
      if (reachable.has(room.id)) continue;
      add(
        diagnostics,
        'warning',
        'ROOM_UNREACHABLE_FROM_ENTRANCE',
        `environment.rooms.${room.id}`,
        `Room "${room.name}" is not reachable from entrance room "${entranceRoomId}" through an explicitly connected doorway.`,
      );
    }
  }
  return diagnostics;
}
