import type { RoomDefinition, RoomWall, SceneDefinition, SharedBoundary, Vector3 } from '../types/scene.js';

type RoomSeed = { name: string; type: string; row: number; column: number };

const fixtureDefinitions: Record<number, RoomSeed[]> = {
  1: [{ name: 'Study', type: 'study', row: 0, column: 0 }],
  3: [
    { name: 'Living room', type: 'living_room', row: 0, column: 0 },
    { name: 'Kitchen', type: 'kitchen', row: 0, column: 1 },
    { name: 'Bedroom', type: 'bedroom', row: 1, column: 0 },
  ],
  5: [
    { name: 'Living room', type: 'living_room', row: 0, column: 0 },
    { name: 'Kitchen', type: 'kitchen', row: 0, column: 1 },
    { name: 'Bathroom', type: 'bathroom', row: 0, column: 2 },
    { name: 'Bedroom 1', type: 'bedroom', row: 1, column: 0 },
    { name: 'Bedroom 2', type: 'bedroom', row: 1, column: 1 },
  ],
  10: [
    { name: 'Bedroom 1', type: 'bedroom', row: 0, column: 0 },
    { name: 'Bathroom', type: 'bathroom', row: 0, column: 1 },
    { name: 'Hallway', type: 'hallway', row: 0, column: 2 },
    { name: 'Kitchen', type: 'kitchen', row: 0, column: 3 },
    { name: 'Utility room', type: 'utility', row: 0, column: 4 },
    { name: 'Bedroom 2', type: 'bedroom', row: 1, column: 0 },
    { name: 'Office', type: 'office', row: 1, column: 1 },
    { name: 'Living room', type: 'living_room', row: 1, column: 2 },
    { name: 'Dining room', type: 'dining_room', row: 1, column: 3 },
    { name: 'Laundry room', type: 'utility', row: 1, column: 4 },
  ],
};

const dimensionsByCount: Record<number, { widths: number[]; depths: number[] }> = {
  1: { widths: [5.6], depths: [4.8] },
  3: { widths: [5.2, 4.8], depths: [4.5, 4] },
  5: { widths: [5.4, 4.6, 3.8], depths: [4.6, 3.8] },
  10: { widths: [3.8, 4.1, 3.4, 4, 3.7], depths: [4.1, 4] },
};

const wallSpan = (room: RoomDefinition, wall: RoomWall) =>
  wall === 'north' || wall === 'south'
    ? room.dimensions?.width ?? room.dimensions?.length ?? 0
    : room.dimensions?.depth ?? 0;

function createRoomLayoutScene(count: number): SceneDefinition {
  const seeds = fixtureDefinitions[count];
  const { widths, depths } = dimensionsByCount[count];
  const rotationY = count === 5 ? 90 : 0;
  const columnEdges = [-(widths.reduce((sum, width) => sum + width, 0) / 2)];
  const rowEdges = [-(depths.reduce((sum, depth) => sum + depth, 0) / 2)];
  widths.forEach((width) => columnEdges.push(columnEdges.at(-1)! + width));
  depths.forEach((depth) => rowEdges.push(rowEdges.at(-1)! + depth));

  const rooms: RoomDefinition[] = seeds.map((seed, index) => {
    const width = widths[seed.column];
    const depth = depths[seed.row];
    const localPosition: Vector3 = [
      (columnEdges[seed.column] + columnEdges[seed.column + 1]) / 2,
      0,
      (rowEdges[seed.row] + rowEdges[seed.row + 1]) / 2,
    ];
    const room: RoomDefinition = {
      id: `room-${count}-${index + 1}`,
      name: seed.name,
      type: seed.type,
      position: [
        localPosition[0] * Math.cos(rotationY * Math.PI / 180) +
          localPosition[2] * Math.sin(rotationY * Math.PI / 180),
        0,
        -localPosition[0] * Math.sin(rotationY * Math.PI / 180) +
          localPosition[2] * Math.cos(rotationY * Math.PI / 180),
      ],
      rotation: [0, rotationY, 0],
      layoutMode: 'procedural',
      wallThickness: 0.12,
      dimensions: { width, depth, height: 2.8, area: width * depth },
      openings: [],
    };
    return room;
  });

  const roomAt = (row: number, column: number) =>
    seeds.findIndex((seed) => seed.row === row && seed.column === column);
  const sharedBoundaries: SharedBoundary[] = [];
  const usedWalls = new Map<string, Set<RoomWall>>();
  const addConnection = (indexA: number, indexB: number, wallA: RoomWall, wallB: RoomWall) => {
    if (indexA < 0 || indexB < 0) return;
    const roomA = rooms[indexA];
    const roomB = rooms[indexB];
    const openingId = `door-${count}-${indexA + 1}-${indexB + 1}`;
    roomA.openings?.push({
      id: openingId,
      type: 'door',
      wall: wallA,
      offset: (wallSpan(roomA, wallA) - 0.9) / 2,
      width: 0.9,
      height: 2.1,
      sillHeight: 0,
      label: `${roomA.name} to ${roomB.name}`,
    });
    sharedBoundaries.push({
      id: `boundary-${count}-${indexA + 1}-${indexB + 1}`,
      roomA: roomA.id,
      wallA,
      roomB: roomB.id,
      wallB,
      openingId,
    });
    usedWalls.set(roomA.id, new Set([...(usedWalls.get(roomA.id) ?? []), wallA]));
    usedWalls.set(roomB.id, new Set([...(usedWalls.get(roomB.id) ?? []), wallB]));
  };

  seeds.forEach((seed, index) => {
    addConnection(index, roomAt(seed.row, seed.column + 1), 'east', 'west');
    addConnection(index, roomAt(seed.row + 1, seed.column), 'south', 'north');
  });

  rooms.forEach((room) => {
    const occupiedWalls = usedWalls.get(room.id) ?? new Set<RoomWall>();
    const exteriorWall = (['north', 'east', 'south', 'west'] as const)
      .find((wall) => !occupiedWalls.has(wall));
    if (!exteriorWall) return;
    const span = wallSpan(room, exteriorWall);
    const windowWidth = Math.min(1.2, span - 0.8);
    room.openings?.push({
      id: `window-${room.id}`,
      type: 'window',
      wall: exteriorWall,
      offset: (span - windowWidth) / 2,
      width: windowWidth,
      height: 1,
      sillHeight: 0.9,
      label: `${room.name} exterior window`,
    });
  });

  const objects: SceneDefinition['objects'] = rooms.map((room, index) => ({
    id: `chair-${count}-${index + 1}`,
    name: `${room.name} chair`,
    assetId: 'chair_wooden',
    category: 'furniture',
    roomId: room.id,
    transform: {
      position: [...(room.position ?? [0, 0, 0])],
      rotation: [0, rotationY, 0],
      scale: [1, 1, 1],
    },
  }));
  const minX = Math.min(...rooms.map(({ position, dimensions }) =>
    (position?.[0] ?? 0) - Math.hypot(dimensions?.width ?? 0, dimensions?.depth ?? 0) / 2));
  const maxX = Math.max(...rooms.map(({ position, dimensions }) =>
    (position?.[0] ?? 0) + Math.hypot(dimensions?.width ?? 0, dimensions?.depth ?? 0) / 2));
  const minZ = Math.min(...rooms.map(({ position, dimensions }) =>
    (position?.[2] ?? 0) - Math.hypot(dimensions?.width ?? 0, dimensions?.depth ?? 0) / 2));
  const maxZ = Math.max(...rooms.map(({ position, dimensions }) =>
    (position?.[2] ?? 0) + Math.hypot(dimensions?.width ?? 0, dimensions?.depth ?? 0) / 2));
  const focus: Vector3 = [(minX + maxX) / 2, 0.8, (minZ + maxZ) / 2];
  const viewDistance = Math.max(12, Math.max(maxX - minX, maxZ - minZ) * 1.3);

  return {
    schemaVersion: '1.0',
    sceneId: `scene-room-layout-${count}`,
    caseId: 'FOR-DEMO-ROOM-LAYOUTS',
    title: count === 10 ? 'Synthetic 10-room connected house' : `Synthetic ${count}-room house layout`,
    sceneType: 'indoor',
    units: 'meters',
    coordinateSystem: {
      up: 'Y',
      forward: '-Z',
      handedness: 'right',
      rotationOrder: 'XYZ',
    },
    environment: {
      type: 'synthetic_residence',
      rooms,
      sharedBoundaries,
      entranceRoomId: rooms[0]?.id,
      allowDisconnectedRooms: false,
    },
    objects,
    evidenceMarkers: objects[0] ? [{
      id: `marker-${count}-1`,
      label: 'Room 1 object marker',
      evidenceId: `evidence-room-layout-${count}-1`,
      objectId: objects[0].id,
      roomId: objects[0].roomId,
      position: [...objects[0].transform.position],
    }] : [],
    camera: {
      position: [
        focus[0] + viewDistance * 0.75,
        focus[1] + viewDistance * 0.8,
        focus[2] + viewDistance * 0.75,
      ],
      target: focus,
    },
    metadata: {
      synthetic: true,
      purpose: 'connected-multi-room-house-validation',
      notes: 'Every room is explicitly connected by an aligned shared wall with a centered doorway.',
    },
  };
}

export const mockRoomLayoutScenes = Object.fromEntries(
  Object.keys(fixtureDefinitions).map((count) => [Number(count), createRoomLayoutScene(Number(count))]),
) as Record<1 | 3 | 5 | 10, SceneDefinition>;
