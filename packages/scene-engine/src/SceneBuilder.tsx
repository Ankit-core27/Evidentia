import { useMemo } from 'react';
import type { EulerOrder } from 'three';

import { EvidenceMarker } from './EvidenceMarker.js';
import { ProceduralRoom } from './ProceduralRoom.js';
import { createSceneSelection } from './selection.js';
import { SceneObject } from './SceneObject.js';
import type { SceneSelection } from './types/scene.js';
import type { AssetPlacement, RoomDefinition, SceneDefinition } from './types/scene.js';

interface SceneBuilderProps {
  scene: SceneDefinition;
  selectedId: string | null;
  showEvidenceMarkers: boolean;
  showCeilings: boolean;
  onObjectSelect?: (selection: SceneSelection) => void;
  onClearSelection?: () => void;
}

const STRUCTURAL_CATEGORIES = ['floorTiles', 'walls', 'doors', 'windows'] as const;

export function SceneBuilder({
  scene,
  selectedId,
  showEvidenceMarkers,
  showCeilings,
  onObjectSelect,
  onClearSelection,
}: SceneBuilderProps) {
  const rotationOrder = scene.coordinateSystem.rotationOrder;
  const roomStructures = useMemo(
    () =>
      scene.environment.rooms.flatMap((room) =>
        STRUCTURAL_CATEGORIES.flatMap((category) =>
          (room.layoutMode === 'procedural' && (category === 'floorTiles' || category === 'walls')
            ? []
            : room.structural?.[category] ?? []
          ).map((placement) => ({
            room,
            category,
            placement,
          })),
        ),
      ),
    [scene.environment.rooms],
  );
  const selections = useMemo(() => {
    const ids = [
      ...scene.objects.map(({ id }) => id),
      ...scene.evidenceMarkers.map(({ id }) => id),
      ...scene.environment.rooms.flatMap((room) => [
        ...(room.openings ?? []).map(({ id }) => id),
        ...STRUCTURAL_CATEGORIES.flatMap((category) =>
          (room.structural?.[category] ?? []).map(({ id }) => id),
        ),
      ]),
    ];
    return new Map(ids.map((id) => [id, createSceneSelection(scene, id)]));
  }, [scene]);

  return (
    <group>
      {scene.environment.rooms.map((room) => (
        room.layoutMode === 'procedural' ? (
          <ProceduralRoom
            key={`procedural-room-${room.id}`}
            scene={scene}
            room={room}
            showCeiling={showCeilings}
            rotationOrder={rotationOrder}
            hiddenWalls={(scene.environment.sharedBoundaries ?? []).flatMap((boundary) => {
              if (boundary.roomB === room.id) return [boundary.wallB];
              return [];
            })}
            selectedId={selectedId}
            onObjectSelect={onObjectSelect}
            onClearSelection={onClearSelection}
          />
        ) : (
          <RoomFloor key={`floor-${room.id}`} room={room} onClearSelection={onClearSelection} />
        )
      ))}
      {roomStructures.map(({ placement }) => (
        <PlacedAsset
          key={placement.id}
          selection={selections.get(placement.id) ?? null}
          placement={placement}
          rotationOrder={rotationOrder}
          selected={selectedId === placement.id}
          onSelect={onObjectSelect}
        />
      ))}
      {scene.objects.map((object) => (
        <SceneObject
          key={object.id}
          selection={selections.get(object.id) ?? null}
          id={object.id}
          assetId={object.assetId}
          name={object.name}
          transform={object.transform}
          rotationOrder={rotationOrder}
          selected={selectedId === object.id}
          onSelect={onObjectSelect}
        />
      ))}
      {showEvidenceMarkers &&
        scene.evidenceMarkers.map((marker, index) => (
          <EvidenceMarker
            key={marker.id}
            marker={marker}
            selection={selections.get(marker.id) ?? null}
            number={index + 1}
            rotationOrder={rotationOrder}
            selected={selectedId === marker.id}
            onSelect={onObjectSelect}
          />
        ))}
    </group>
  );
}

function RoomFloor({
  room,
  onClearSelection,
}: {
  room: RoomDefinition;
  onClearSelection?: () => void;
}) {
  const width = room.dimensions?.width ?? room.dimensions?.length;
  const depth = room.dimensions?.depth;
  if (!width || !depth) return null;

  return (
    <mesh
      position={[
        room.position?.[0] ?? 0,
        (room.position?.[1] ?? 0) - 0.06,
        room.position?.[2] ?? 0,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        onClearSelection?.();
      }}
      userData={{ roomId: room.id, sceneFloor: true }}
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#8b8174" roughness={0.88} />
    </mesh>
  );
}

function PlacedAsset({
  placement,
  rotationOrder,
  selected,
  selection,
  onSelect,
}: {
  placement: AssetPlacement;
  rotationOrder: string;
  selected: boolean;
  onSelect?: (selection: SceneSelection) => void;
  selection: SceneSelection | null;
}) {
  if (!selection) return null;
  return (
    <SceneObject
      selection={selection}
      id={placement.id}
      assetId={placement.assetId}
      name={placement.label}
      transform={placement.transform}
      rotationOrder={rotationOrder as EulerOrder}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
