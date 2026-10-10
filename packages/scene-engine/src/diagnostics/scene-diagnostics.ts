import { assetRegistry, type AssetRegistry } from '../assets/asset-registry.js';
import { validateScene } from '../schema/scene.schema.js';
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

function rotateY([x, y, z]: Vector3, degrees: number): Vector3 {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function wallCenter(room: RoomDefinition, wall: RoomWall): Vector3 {
  const width = room.dimensions?.width ?? room.dimensions?.length ?? 0;
  const depth = room.dimensions?.depth ?? 0;
  const local: Vector3 =
    wall === 'north' ? [0, 0, -depth / 2] :
      wall === 'south' ? [0, 0, depth / 2] :
        wall === 'east' ? [width / 2, 0, 0] : [-width / 2, 0, 0];
  const rotated = rotateY(local, room.rotation?.[1] ?? 0);
  return [
    (room.position?.[0] ?? 0) + rotated[0],
    (room.position?.[1] ?? 0) + rotated[1],
    (room.position?.[2] ?? 0) + rotated[2],
  ];
}

function wallNormal(room: RoomDefinition, wall: RoomWall): Vector3 {
  const normal: Vector3 =
    wall === 'north' ? [0, 0, -1] :
      wall === 'south' ? [0, 0, 1] :
        wall === 'east' ? [1, 0, 0] : [-1, 0, 0];
  return rotateY(normal, room.rotation?.[1] ?? 0);
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
  const validation = validateScene(scene);
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
    const relative: Vector3 = [
      object.transform.position[0] - (room.position?.[0] ?? 0),
      object.transform.position[1] - (room.position?.[1] ?? 0),
      object.transform.position[2] - (room.position?.[2] ?? 0),
    ];
    const inverseRotated = rotateY(relative, -(room.rotation?.[1] ?? 0));
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
  }

  for (const [index, boundary] of (scene.environment.sharedBoundaries ?? []).entries()) {
    const roomA = scene.environment.rooms.find(({ id }) => id === boundary.roomA);
    const roomB = scene.environment.rooms.find(({ id }) => id === boundary.roomB);
    if (!roomA || !roomB) continue;
    const spanA = roomSpan(roomA, boundary.wallA);
    const spanB = roomSpan(roomB, boundary.wallB);
    if (spanA === undefined || spanB === undefined) continue;
    const heightA = roomA.dimensions?.height;
    const heightB = roomB.dimensions?.height;
    const centerA = wallCenter(roomA, boundary.wallA);
    const centerB = wallCenter(roomB, boundary.wallB);
    const centerDistance = Math.hypot(
      centerA[0] - centerB[0],
      centerA[1] - centerB[1],
      centerA[2] - centerB[2],
    );
    const normalA = wallNormal(roomA, boundary.wallA);
    const normalB = wallNormal(roomB, boundary.wallB);
    const normalDot = normalA[0] * normalB[0] + normalA[2] * normalB[2];
    if (
      centerDistance > 0.05 ||
      Math.abs(spanA - spanB) > 0.05 ||
      (heightA !== undefined && heightB !== undefined && Math.abs(heightA - heightB) > 0.05) ||
      normalDot > -0.98
    ) {
      add(
        diagnostics,
        'warning',
        'SHARED_BOUNDARY_MISALIGNED',
        `environment.sharedBoundaries.${index}`,
        `Rooms "${roomA.id}" and "${roomB.id}" do not have matching, opposing wall planes; room A supplies the boundary geometry while room B's duplicate wall is suppressed.`,
      );
    }
  }
  return diagnostics;
}
