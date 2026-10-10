import type { RoomDefinition, RoomWall, SceneDefinition, Vector3 } from './types/scene.js';

export function roomLocalToWorld(position: Vector3, room: RoomDefinition): Vector3 {
  const radians = ((room.rotation?.[1] ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    (room.position?.[0] ?? 0) + position[0] * cosine + position[2] * sine,
    (room.position?.[1] ?? 0) + position[1],
    (room.position?.[2] ?? 0) - position[0] * sine + position[2] * cosine,
  ];
}

export function worldToRoomLocal(position: Vector3, room: RoomDefinition): Vector3 {
  const relative: Vector3 = [
    position[0] - (room.position?.[0] ?? 0),
    position[1] - (room.position?.[1] ?? 0),
    position[2] - (room.position?.[2] ?? 0),
  ];
  const radians = -((room.rotation?.[1] ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    relative[0] * cosine + relative[2] * sine,
    relative[1],
    -relative[0] * sine + relative[2] * cosine,
  ];
}

export function hiddenSharedWalls(scene: SceneDefinition, roomId: string): RoomWall[] {
  return (scene.environment.sharedBoundaries ?? [])
    .filter((boundary) => boundary.roomB === roomId)
    .map((boundary) => boundary.wallB);
}
