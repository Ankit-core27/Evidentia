import { useMemo } from 'react';
import type { EulerOrder } from 'three';

import { getAssetRegistryEntry } from './assets/asset-registry.js';
import { createSceneSelection } from './selection.js';
import { SceneObject } from './SceneObject.js';
import type { RoomDefinition, RoomOpening, RoomWall, SceneDefinition, SceneSelection } from './types/scene.js';

interface ProceduralRoomProps {
  scene: SceneDefinition;
  room: RoomDefinition;
  showCeiling: boolean;
  rotationOrder: EulerOrder;
  hiddenWalls: RoomWall[];
  onObjectSelect?: (selection: SceneSelection) => void;
  onClearSelection?: () => void;
  selectedId: string | null;
}

interface WallSegment {
  key: string;
  center: number;
  width: number;
  bottom: number;
  height: number;
}

export function buildWallSegments(span: number, height: number, openings: RoomOpening[]): WallSegment[] {
  const cuts = [...new Set([
    -span / 2,
    span / 2,
    ...openings.flatMap((opening) => [-span / 2 + opening.offset, -span / 2 + opening.offset + opening.width]),
  ])].sort((a, b) => a - b);
  const segments: WallSegment[] = [];

  for (let index = 0; index < cuts.length - 1; index += 1) {
    const left = cuts[index];
    const right = cuts[index + 1];
    if (right <= left) continue;
    const center = (left + right) / 2;
    const coveringOpenings = openings.filter((opening) => {
      const start = -span / 2 + opening.offset;
      return center >= start && center <= start + opening.width;
    });
    const occlusions = coveringOpenings
      .map((opening) => [opening.sillHeight, opening.sillHeight + opening.height] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const mergedOcclusions: Array<[number, number]> = [];
    for (const interval of occlusions) {
      const previous = mergedOcclusions.at(-1);
      if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
      else mergedOcclusions.push([...interval]);
    }
    const ranges: Array<[number, number]> = [];
    let lower = 0;
    for (const [openingBottom, openingTop] of mergedOcclusions) {
      if (openingBottom > lower) ranges.push([lower, openingBottom]);
      lower = Math.max(lower, openingTop);
    }
    if (lower < height) ranges.push([lower, height]);
    ranges.forEach(([bottom, top], rangeIndex) => {
      if (top - bottom > 0.001) {
        segments.push({
          key: `${index}-${rangeIndex}`,
          center,
          width: right - left,
          bottom,
          height: top - bottom,
        });
      }
    });
  }
  return segments;
}

export function ProceduralRoom({
  scene,
  room,
  showCeiling,
  rotationOrder,
  hiddenWalls,
  onObjectSelect,
  onClearSelection,
  selectedId,
}: ProceduralRoomProps) {
  const width = room.dimensions?.width ?? room.dimensions?.length ?? 0;
  const depth = room.dimensions?.depth ?? 0;
  const height = room.dimensions?.height ?? 0;
  const thickness = room.wallThickness ?? 0.12;
  const roomRotation = useMemo(
    () => (room.rotation ?? [0, 0, 0]).map((degree) => (degree * Math.PI) / 180) as [number, number, number],
    [room.rotation],
  );

  if (width <= 0 || depth <= 0 || height <= 0) return null;

  return (
    <group
      position={room.position ?? [0, 0, 0]}
      rotation={[...roomRotation, rotationOrder]}
      userData={{ roomId: room.id, proceduralRoom: true }}
    >
      {room.floor?.enabled !== false && (
        <mesh
          position={[0, -0.025, 0]}
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            onClearSelection?.();
          }}
        >
          <boxGeometry args={[width, 0.05, depth]} />
          <meshStandardMaterial color="#8b8174" roughness={0.88} />
        </mesh>
      )}
      {(['north', 'south', 'east', 'west'] as const)
        .filter((wall) => !hiddenWalls.includes(wall))
        .map((wall) => (
          <ProceduralWall
            key={`${room.id}-${wall}`}
            wall={wall}
            width={width}
            depth={depth}
            height={height}
            thickness={thickness}
            openings={(room.openings ?? []).filter((opening) => opening.wall === wall)}
          />
        ))}
      {showCeiling && room.ceiling?.enabled && (
        <mesh position={[0, height + 0.025, 0]} receiveShadow>
          <boxGeometry args={[width, 0.05, depth]} />
          <meshStandardMaterial color="#d6d3d1" roughness={0.95} />
        </mesh>
      )}
      {(room.openings ?? []).filter((opening) => opening.assetId).map((opening) => (
        <OpeningAsset
          key={opening.id}
          opening={opening}
          selection={createSceneSelection(scene, opening.id)}
          wallSpan={opening.wall === 'north' || opening.wall === 'south' ? width : depth}
          roomWidth={width}
          roomDepth={depth}
          thickness={thickness}
          rotationOrder={rotationOrder}
          selected={selectedId === opening.id}
          onSelect={onObjectSelect}
        />
      ))}
    </group>
  );
}

function ProceduralWall({
  wall,
  width,
  depth,
  height,
  thickness,
  openings,
}: {
  wall: RoomWall;
  width: number;
  depth: number;
  height: number;
  thickness: number;
  openings: RoomOpening[];
}) {
  const span = wall === 'north' || wall === 'south' ? width : depth;
  const segments = buildWallSegments(span, height, openings);
  const sidePosition =
    wall === 'north' ? -depth / 2 :
      wall === 'south' ? depth / 2 :
        wall === 'east' ? width / 2 : -width / 2;

  return (
    <group>
      {segments.map((segment) => {
        const center = wall === 'north' || wall === 'south'
          ? [segment.center, segment.bottom + segment.height / 2, sidePosition] as [number, number, number]
          : [sidePosition, segment.bottom + segment.height / 2, segment.center] as [number, number, number];
        const size = wall === 'north' || wall === 'south'
          ? [segment.width, segment.height, thickness] as [number, number, number]
          : [thickness, segment.height, segment.width] as [number, number, number];
        return (
          <mesh key={segment.key} position={center} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.94} />
          </mesh>
        );
      })}
    </group>
  );
}

function OpeningAsset({
  opening,
  wallSpan,
  roomWidth,
  roomDepth,
  thickness,
  rotationOrder,
  selected,
  selection,
  onSelect,
}: {
  opening: RoomOpening;
  wallSpan: number;
  roomWidth: number;
  roomDepth: number;
  thickness: number;
  rotationOrder: EulerOrder;
  selected: boolean;
  onSelect?: (selection: SceneSelection) => void;
  selection: SceneSelection | null;
}) {
  if (!opening.assetId) return null;
  if (!selection) return null;
  const entry = getAssetRegistryEntry(opening.assetId);
  const assetWidth = entry?.dimensions?.width ?? opening.width;
  const assetHeight = entry?.dimensions?.height ?? opening.height;
  const assetDepth = entry?.dimensions?.depth ?? thickness;
  const center = -wallSpan / 2 + opening.offset + opening.width / 2;
  const position: [number, number, number] =
    opening.wall === 'north' ? [center, opening.sillHeight, -roomDepth / 2 + thickness / 2] :
      opening.wall === 'south' ? [center, opening.sillHeight, roomDepth / 2 - thickness / 2] :
        opening.wall === 'east' ? [roomWidth / 2 - thickness / 2, opening.sillHeight, center] :
          [-roomWidth / 2 + thickness / 2, opening.sillHeight, center];
  const yaw = opening.wall === 'north' ? 0 : opening.wall === 'south' ? 180 : opening.wall === 'east' ? -90 : 90;
  return (
    <SceneObject
      selection={selection}
      id={opening.id}
      assetId={opening.assetId}
      name={opening.label ?? opening.type}
      transform={{
        position,
        rotation: [0, yaw, 0],
        scale: [opening.width / assetWidth, opening.height / assetHeight, thickness / assetDepth],
      }}
      rotationOrder={rotationOrder}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
