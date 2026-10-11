import {
  assetRegistry,
  roomLocalToWorld,
  type AssetRegistry,
  type RoomDefinition,
  type RoomWall,
  type SceneDefinition,
  type Vector3,
} from '@evidentia/scene-engine';

import type {
  PlannerObjectConstraint,
  PlannerConnectionConstraint,
  PlannerRequest,
  PlannerRoomConstraint,
  ScenePlannerProvider,
  ScenePlannerProviderRequest,
} from './types.js';

interface RoomSeed extends PlannerRoomConstraint {
  id: string;
  name: string;
  type: string;
}

interface ObjectSeed extends PlannerObjectConstraint {
  assetId: string;
}

interface PlannerFinding {
  code: 'UNRESOLVED_OBJECT_PLACEMENT' | 'UNSUPPORTED_ASSET_REQUEST';
  path: string;
  message: string;
}

interface PlannerMetadata {
  mode: 'deterministic-mock';
  synthetic: true;
  disclaimer: string;
  assumptions: string[];
  findings: PlannerFinding[];
}

const roomKinds = [
  { type: 'living_room', names: ['living room', 'living-room'] },
  { type: 'bedroom', names: ['bedroom'] },
  { type: 'kitchen', names: ['kitchen'] },
  { type: 'bathroom', names: ['bathroom'] },
  { type: 'hallway', names: ['hallway', 'corridor'] },
  { type: 'office', names: ['office', 'study'] },
  { type: 'dining_room', names: ['dining room', 'dining-room'] },
  { type: 'utility', names: ['utility room', 'laundry room'] },
] as const;

const objectKinds = [
  { assetId: 'table_wooden', name: 'Table', category: 'furniture', pattern: /\btable\b/i },
  { assetId: 'chair_wooden', name: 'Chair', category: 'furniture', pattern: /\bchairs?\b/i },
  { assetId: 'knife', name: 'Knife', category: 'weapon', pattern: /\bknives\b|\bknife\b/i },
  { assetId: 'victim_body', name: 'Body', category: 'body', pattern: /\bbody\b|\bvictim\b/i },
  { assetId: 'bed_single', name: 'Bed', category: 'furniture', pattern: /\bbeds?\b/i },
  { assetId: 'cupboard_wooden', name: 'Cupboard', category: 'furniture', pattern: /\bcupboards?\b/i },
  { assetId: 'sedan_car', name: 'Sedan', category: 'vehicle', pattern: /\bsedan\b|\bcar\b/i },
  { assetId: 'motorcycle', name: 'Motorcycle', category: 'vehicle', pattern: /\bmotorcycle\b/i },
  { assetId: 'traffic_cone', name: 'Traffic cone', category: 'road', pattern: /\btraffic cone\b/i },
  { assetId: 'road_straight', name: 'Road segment', category: 'road', pattern: /\broad\b/i },
] as const;

function roomSeedsFromRequest(request: PlannerRequest): RoomSeed[] {
  if (request.roomConstraints?.length) {
    return request.roomConstraints.map((room, index) => ({
      ...room,
      id: room.id ?? `planned-room-${index + 1}`,
      type: room.type ?? 'room',
    }));
  }
  const normalized = request.description.toLowerCase();
  const found: RoomSeed[] = [];
  for (const kind of roomKinds) {
    const matchedName = kind.names.find((name) => normalized.includes(name));
    if (!matchedName) continue;
    const pluralBedroomCount = kind.type === 'bedroom' && /\b(two|2)\s+bedrooms?\b/i.test(normalized) ? 2 : 1;
    for (let index = 0; index < pluralBedroomCount; index += 1) {
      const displayName = kind.type === 'bedroom' && pluralBedroomCount > 1
        ? `Bedroom ${index + 1}`
        : matchedName.replace(/(^|-|\s)\S/g, (part) => part.toUpperCase()).replace('-', ' ');
      found.push({
        id: `planned-room-${found.length + 1}`,
        name: displayName,
        type: kind.type,
      });
    }
  }
  return found;
}

function objectSeedsFromRequest(
  request: PlannerRequest,
  rooms: RoomSeed[],
  registry: AssetRegistry,
  findings: PlannerFinding[],
): ObjectSeed[] {
  if (request.objectConstraints?.length) {
    return request.objectConstraints.map((object) => ({
      ...object,
      assetId: object.assetId ?? objectKinds.find(({ pattern }) => pattern.test(object.name))?.assetId ?? '',
    }));
  }

  const normalized = request.description.toLowerCase();
  const seeds: ObjectSeed[] = [];
  for (const kind of objectKinds) {
    if (!kind.pattern.test(request.description)) continue;
    const assetId = kind.assetId;
    if (!registry[assetId] || request.permittedAssetIds && !request.permittedAssetIds.includes(assetId)) {
      findings.push({
        code: 'UNSUPPORTED_ASSET_REQUEST',
        path: `objects.${kind.name}`,
        message: `The requested "${kind.name}" model (${assetId}) is unavailable or not permitted; no substitute was selected.`,
      });
      continue;
    }
    const roomName = rooms.find((room) => {
      const escaped = room.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const placement = new RegExp(`(?:in|near|by)\\s+(?:the\\s+)?${escaped}\\b`, 'i');
      return placement.test(normalized);
    })?.name ?? rooms.find(({ type }) => type === 'living_room')?.name ?? rooms[0]?.name;
    const count = kind.assetId === 'chair_wooden' && /\bchairs\b/i.test(request.description) ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      seeds.push({
        name: count > 1 ? `${kind.name} ${index + 1}` : kind.name,
        assetId,
        roomName,
      });
    }
  }
  return seeds;
}

function localWallCenter(room: RoomDefinition, wall: RoomWall): Vector3 {
  const width = room.dimensions?.width ?? room.dimensions?.length ?? 0;
  const depth = room.dimensions?.depth ?? 0;
  return wall === 'north' ? [0, 0, -depth / 2] :
    wall === 'south' ? [0, 0, depth / 2] :
      wall === 'east' ? [width / 2, 0, 0] : [-width / 2, 0, 0];
}

function sceneTypeFor(environmentType: PlannerRequest['environmentType']): SceneDefinition['sceneType'] {
  return environmentType === 'outdoor' ? 'outdoor' : environmentType;
}

export function createMockSceneCandidate(
  request: PlannerRequest,
  registry: AssetRegistry = assetRegistry,
): SceneDefinition {
  const findings: PlannerFinding[] = [];
  const roomSeeds = roomSeedsFromRequest(request);
  const objectSeeds = objectSeedsFromRequest(request, roomSeeds, registry, findings);
  const widths = roomSeeds.map(({ dimensions }) => dimensions?.width ?? 5);
  const depths = roomSeeds.map(({ dimensions }) => dimensions?.depth ?? 4.5);
  const heights = roomSeeds.map(({ dimensions }) => dimensions?.height ?? 2.8);
  const entranceId = request.requestedLayout?.entranceRoomId ?? roomSeeds[0]?.id;

  const rooms: RoomDefinition[] = roomSeeds.map((seed, index) => ({
    id: seed.id,
    name: seed.name,
    type: seed.type,
    position: seed.position ?? [0, 0, 0],
    rotation: seed.rotation ?? [0, 0, 0],
    layoutMode: 'procedural',
    wallThickness: 0.12,
    dimensions: {
      width: widths[index],
      depth: depths[index],
      height: heights[index],
      area: widths[index] * depths[index],
    },
    openings: [],
  }));

  const roomByNameOrId = (value: string) =>
    rooms.find(({ id, name }) => id === value || name.toLowerCase() === value.toLowerCase());
  const authoredConnections = request.requestedLayout?.connections;
  const connections: PlannerConnectionConstraint[] = request.environmentType !== 'outdoor' && authoredConnections?.length
    ? authoredConnections
    : request.environmentType !== 'outdoor' ? rooms.slice(1).map((room, index) => ({
        roomA: rooms[index].id,
        wallA: 'east' as const,
        roomB: room.id,
        wallB: 'west' as const,
      })) : [];
  const sharedBoundaries = [];

  for (const [index, connection] of connections.entries()) {
    const roomA = roomByNameOrId(connection.roomA);
    const roomB = roomByNameOrId(connection.roomB);
    if (!roomA || !roomB) continue;
    if (!roomSeeds.find((room) => room.id === roomB.id)?.position) {
      const localCenterA = roomLocalToWorld(localWallCenter(roomA, connection.wallA), {
        ...roomA,
        position: [0, 0, 0],
      });
      const localCenterB = roomLocalToWorld(localWallCenter(roomB, connection.wallB), {
        ...roomB,
        position: [0, 0, 0],
      });
      roomB.position = [
        (roomA.position?.[0] ?? 0) + localCenterA[0] - localCenterB[0],
        roomA.position?.[1] ?? 0,
        (roomA.position?.[2] ?? 0) + localCenterA[2] - localCenterB[2],
      ];
    }
    const wallLength = connection.wallA === 'north' || connection.wallA === 'south'
      ? roomA.dimensions?.width ?? 0
      : roomA.dimensions?.depth ?? 0;
    const openingWidth = connection.openingWidth ?? 0.9;
    const openingId = `planned-door-${index + 1}`;
    roomA.openings?.push({
      id: openingId,
      type: 'door',
      wall: connection.wallA,
      offset: (wallLength - openingWidth) / 2,
      width: openingWidth,
      height: Math.min(2.1, roomA.dimensions?.height ?? 2.1),
      sillHeight: 0,
      label: `${roomA.name} to ${roomB.name} doorway`,
    });
    sharedBoundaries.push({
      id: `planned-boundary-${index + 1}`,
      roomA: roomA.id,
      wallA: connection.wallA,
      roomB: roomB.id,
      wallB: connection.wallB,
      openingId,
    });
  }

  const assumptions: string[] = [];
  for (const [index, seed] of roomSeeds.entries()) {
    if (!seed.dimensions || seed.dimensions.width === undefined ||
      seed.dimensions.depth === undefined || seed.dimensions.height === undefined) {
      assumptions.push(`Illustrative dimensions were used for ${seed.name}; they are not measurements.`);
    }
    if (!seed.position) assumptions.push(`An illustrative position was generated for ${seed.name}; it is not a surveyed coordinate.`);
    if (!seed.rotation) assumptions.push(`A zero room rotation was assumed for ${seed.name}.`);
  }
  if (!authoredConnections?.length && rooms.length > 1) {
    assumptions.push('Rooms were connected sequentially in a suggested illustrative layout because no explicit connection graph was supplied.');
  }

  const objects: SceneDefinition['objects'] = [];
  for (const seed of objectSeeds) {
    const room = request.environmentType === 'outdoor'
      ? undefined
      : roomByNameOrId(seed.roomName ?? '') ?? rooms[0];
    const roomSeed = roomSeeds.find(({ id }) => id === room?.id);
    if (!seed.assetId || !registry[seed.assetId]) {
      findings.push({
        code: 'UNSUPPORTED_ASSET_REQUEST',
        path: `objects.${seed.name}.assetId`,
        message: seed.assetId
          ? `Asset "${seed.assetId}" is not in the scene asset registry; no substitute was selected.`
          : `No registered asset matches "${seed.name}".`,
      });
      continue;
    }
    if (request.permittedAssetIds && !request.permittedAssetIds.includes(seed.assetId)) {
      findings.push({
        code: 'UNSUPPORTED_ASSET_REQUEST',
        path: `objects.${seed.name}.assetId`,
        message: `Asset "${seed.assetId}" is not in the caller's permitted asset list; no substitute was selected.`,
      });
      continue;
    }

    let position = seed.position;
    let provenance: 'manual' | 'estimated' | 'unknown' = seed.position ? 'manual' : 'estimated';
    let plannerSource: 'explicit' | 'derived' | 'estimated' = seed.position ? 'explicit' : 'estimated';
    let notes = seed.position ? 'Position supplied in the planner request.' : 'Illustrative placement only; not a measured scene coordinate.';
    if (!position && seed.assetId === 'knife' && /near|by|beside|doorway/i.test(request.description)) {
      const connection = sharedBoundaries.find((boundary) => {
        const roomA = rooms.find(({ id }) => id === boundary.roomA);
        const roomB = rooms.find(({ id }) => id === boundary.roomB);
        return roomA?.id === room?.id || roomB?.id === room?.id;
      });
      if (connection) {
        const owner = rooms.find(({ id }) => id === connection.roomA)!;
        const neighbor = rooms.find(({ id }) => id === connection.roomB)!;
        const ownerWallCenter = localWallCenter(owner, connection.wallA);
        const isOwner = owner.id === room?.id;
        const localPosition = isOwner
          ? [...ownerWallCenter] as Vector3
          : localWallCenter(neighbor, connection.wallB);
        const inwardOffset = connection.wallA === 'east' || connection.wallB === 'west' ? -0.35 :
          connection.wallA === 'west' || connection.wallB === 'east' ? 0.35 :
            connection.wallA === 'north' || connection.wallB === 'south' ? 0.35 : -0.35;
        if (connection.wallA === 'east' || connection.wallA === 'west') localPosition[0] += isOwner ? inwardOffset : -inwardOffset;
        else localPosition[2] += isOwner ? inwardOffset : -inwardOffset;
        position = roomLocalToWorld(localPosition, isOwner ? owner : neighbor);
        provenance = 'estimated';
        plannerSource = 'derived';
        notes = 'Illustrative position inferred from the requested doorway association; not a measured coordinate.';
      }
    }
    if (!position && seed.assetId === 'victim_body' &&
      /(?:exact|precise).{0,30}(?:position|location).{0,30}(?:unknown|not(?:\s+been)?\s+measured|unmeasured)|(?:position|location).{0,30}(?:unknown|not(?:\s+been)?\s+measured|unmeasured)/i.test(request.description)) {
      findings.push({
        code: 'UNRESOLVED_OBJECT_PLACEMENT',
        path: `objects.${seed.name}.transform.position`,
        message: `The ${seed.name.toLowerCase()} was omitted from the renderable scene because its position is stated to be unknown or unmeasured. No coordinates were fabricated.`,
      });
      continue;
    }
    if (!position) {
      const index = objects.length;
      position = roomLocalToWorld(
        seed.assetId === 'table_wooden' ? [0, 0, 0] :
          seed.assetId === 'chair_wooden' ? [(index % 2 ? 1 : -1) * 1.2, 0, 0.75] :
            [0, 0, 0],
        room ?? { id: '', name: '', type: '', dimensions: {} },
      );
    }
    objects.push({
      id: `planned-object-${objects.length + 1}`,
      name: seed.name,
      assetId: seed.assetId,
      category: registry[seed.assetId].category,
      roomId: room?.id,
      evidenceIds: seed.evidenceIds,
      transform: {
        position,
        rotation: room?.rotation ?? [0, 0, 0],
        scale: [1, 1, 1],
      },
      provenance: {
        source: provenance,
        notes,
      },
      metadata: {
        plannerProvenance: plannerSource,
        placementStatus: plannerSource === 'estimated' ? 'illustrative' : plannerSource,
        dimensionsStatus: registry[seed.assetId].calibration?.status ?? 'not-inspected',
      },
    });
    if (roomSeed && provenance === 'estimated') {
      assumptions.push(`Placement of ${seed.name} in ${roomSeed.name} is illustrative, not measured.`);
    }
  }

  const bounds = rooms.reduce((current, room) => {
    const x = room.position?.[0] ?? 0;
    const z = room.position?.[2] ?? 0;
    return {
      minX: Math.min(current.minX, x - (room.dimensions?.width ?? 0) / 2),
      maxX: Math.max(current.maxX, x + (room.dimensions?.width ?? 0) / 2),
      minZ: Math.min(current.minZ, z - (room.dimensions?.depth ?? 0) / 2),
      maxZ: Math.max(current.maxZ, z + (room.dimensions?.depth ?? 0) / 2),
    };
  }, { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const evidenceMarkers: SceneDefinition['evidenceMarkers'] = (request.evidenceMarkerConstraints ?? []).map((marker, index) => {
    const object = marker.objectName
      ? objects.find(({ name }) => name === marker.objectName)
      : undefined;
    const room = marker.roomName
      ? roomByNameOrId(marker.roomName)
      : object?.roomId
        ? rooms.find(({ id }) => id === object.roomId)
        : undefined;
    return {
      id: `planned-evidence-marker-${index + 1}`,
      label: marker.label ?? `Evidence marker ${marker.evidenceId}`,
      evidenceId: marker.evidenceId,
      objectId: object?.id,
      roomId: room?.id,
      position: marker.position,
      metadata: { plannerProvenance: 'explicit' },
    };
  });
  const centerX = Number.isFinite(bounds.minX) ? (bounds.minX + bounds.maxX) / 2 : 0;
  const centerZ = Number.isFinite(bounds.minZ) ? (bounds.minZ + bounds.maxZ) / 2 : 0;
  const viewDistance = Math.max(10, Number.isFinite(bounds.minX) ? Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.5 : 10);
  const descriptionSlug = request.description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  const plannerMetadata: PlannerMetadata = {
    mode: 'deterministic-mock',
    synthetic: true,
    disclaimer: 'This is a deterministic mock plan, not an LLM result, measured reconstruction, or forensic conclusion.',
    assumptions: [...new Set(assumptions)],
    findings,
  };

  return {
    schemaVersion: '1.0',
    sceneId: `scene-plan-${descriptionSlug || 'synthetic'}`,
    caseId: 'FOR-DEMO-PLANNER',
    title: 'Synthetic AI Scene Planner Demonstration',
    sceneType: sceneTypeFor(request.environmentType),
    units: 'meters',
    coordinateSystem: {
      up: 'Y',
      forward: '-Z',
      handedness: 'right',
      rotationOrder: 'XYZ',
    },
    environment: {
      type: request.environmentType === 'outdoor' ? 'synthetic_outdoor' : 'synthetic_residence',
      rooms: request.environmentType === 'outdoor' ? [] : rooms,
      sharedBoundaries: request.environmentType === 'outdoor' ? [] : sharedBoundaries,
      entranceRoomId: request.environmentType === 'outdoor' ? undefined : entranceId,
      allowDisconnectedRooms: request.requestedLayout?.allowDisconnectedRooms ?? false,
      metadata: {
        synthetic: true,
        plannerMode: 'deterministic-mock',
      },
    },
    objects,
    evidenceMarkers,
    camera: {
      position: [centerX + viewDistance * 0.8, viewDistance, centerZ + viewDistance * 0.8],
      target: [centerX, 0.8, centerZ],
    },
    metadata: {
      synthetic: true,
      planner: plannerMetadata,
      ...(request.metadata ? { requestMetadata: request.metadata } : {}),
    },
  };
}

export class DeterministicMockScenePlanner implements ScenePlannerProvider {
  readonly id = 'deterministic-mock';
  readonly supportsStructuredOutput = false;

  constructor(private readonly registry: AssetRegistry = assetRegistry) {}

  async generateScene({ plannerRequest }: ScenePlannerProviderRequest): Promise<unknown> {
    return createMockSceneCandidate(plannerRequest, this.registry);
  }
}
