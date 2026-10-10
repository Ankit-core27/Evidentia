import { Euler, Quaternion } from 'three';
import { assetRegistry, type AssetRegistryEntry } from './assets/asset-registry.js';
import { roomLocalToWorld } from './spatial.js';
import type {
  AssetCalibration,
  EvidenceMarkerDefinition,
  RoomDefinition,
  SceneDefinition,
  SceneObjectDefinition,
  SceneObjectSelection,
  SceneSelection,
  SceneTransform,
} from './types/scene.js';

function calibrationSnapshot(entry: AssetRegistryEntry | undefined): AssetCalibration {
  const calibration = entry?.calibration;
  if (calibration) {
    return {
      ...calibration,
      sourceDimensions: calibration.sourceDimensions ? [...calibration.sourceDimensions] : undefined,
      sourceBounds: calibration.sourceBounds
        ? { min: [...calibration.sourceBounds.min], max: [...calibration.sourceBounds.max] }
        : undefined,
      physicalDimensions: calibration.physicalDimensions ? { ...calibration.physicalDimensions } : undefined,
      defaultScale: calibration.defaultScale ? [...calibration.defaultScale] : undefined,
      rotationCorrection: calibration.rotationCorrection ? [...calibration.rotationCorrection] : undefined,
      positionCorrection: calibration.positionCorrection ? [...calibration.positionCorrection] : undefined,
    };
  }
  return {
    status: 'not-inspected',
    sourceUnits: 'unknown',
    originConvention: 'unknown',
    notes: 'No asset calibration metadata is available.',
  };
}

function association(scene: SceneDefinition, room?: RoomDefinition) {
  return {
    sceneType: scene.sceneType,
    environmentType: scene.environment.type,
    roomId: room?.id,
    roomName: room?.name,
  };
}

function selectionTransform(transform: SceneTransform) {
  return {
    position: [...transform.position] as [number, number, number],
    rotation: [...transform.rotation] as [number, number, number],
    scale: [...transform.scale] as [number, number, number],
    space: 'world' as const,
    positionUnit: 'meters' as const,
    rotationUnit: 'degrees' as const,
    scaleUnit: 'unitless' as const,
  };
}

function objectSelection(
  scene: SceneDefinition,
  object: SceneObjectDefinition,
  registry: Record<string, AssetRegistryEntry>,
): SceneObjectSelection {
  const room = object.roomId
    ? scene.environment.rooms.find((candidate) => candidate.id === object.roomId)
    : undefined;
  const entry = registry[object.assetId];
  return {
    kind: 'object',
    id: object.id,
    name: object.name,
    assetId: object.assetId,
    category: object.category,
    association: association(scene, room),
    transform: selectionTransform(object.transform),
    evidenceIds: [...(object.evidenceIds ?? [])],
    evidenceRecordAvailability: 'not-included-in-scene-schema',
    provenance: object.provenance ? { ...object.provenance } : undefined,
    calibration: calibrationSnapshot(entry),
    metadata: object.metadata ? structuredClone(object.metadata) : undefined,
  };
}

function markerSelection(
  scene: SceneDefinition,
  marker: EvidenceMarkerDefinition,
  registry: Record<string, AssetRegistryEntry>,
): SceneSelection {
  const room = marker.roomId
    ? scene.environment.rooms.find((candidate) => candidate.id === marker.roomId)
    : undefined;
  const transform: SceneTransform = {
    position: marker.position,
    rotation: marker.rotation ?? [0, 0, 0],
    scale: marker.scale ?? [1, 1, 1],
  };
  return {
    kind: 'evidence-marker',
    id: marker.id,
    name: marker.label,
    assetId: 'evidence_marker',
    category: 'evidence',
    association: association(scene, room),
    transform: selectionTransform(transform),
    evidenceIds: [marker.evidenceId],
    evidenceRecordAvailability: 'not-included-in-scene-schema',
    evidenceId: marker.evidenceId,
    objectId: marker.objectId,
    calibration: calibrationSnapshot(registry.evidence_marker),
    metadata: marker.metadata ? structuredClone(marker.metadata) : undefined,
  };
}

export function createSceneSelection(
  scene: SceneDefinition,
  id: string,
  registry: Record<string, AssetRegistryEntry> = assetRegistry,
): SceneSelection | null {
  const marker = scene.evidenceMarkers.find((candidate) => candidate.id === id);
  if (marker) return markerSelection(scene, marker, registry);

  const object = scene.objects.find((candidate) => candidate.id === id);
  if (object) return objectSelection(scene, object, registry);

  for (const room of scene.environment.rooms) {
    const opening = room.openings?.find((candidate) => candidate.id === id);
    if (opening) {
      const assetId = opening.assetId ?? 'unknown';
      const asset = registry[assetId];
      const width = asset?.dimensions?.width ?? opening.width;
      const height = asset?.dimensions?.height ?? opening.height;
      const depth = asset?.dimensions?.depth ?? room.wallThickness ?? 0.12;
      const isNorthSouth = opening.wall === 'north' || opening.wall === 'south';
      const center = -(isNorthSouth
        ? room.dimensions?.width ?? room.dimensions?.length ?? 0
        : room.dimensions?.depth ?? 0) / 2 + opening.offset + opening.width / 2;
      const roomWidth = room.dimensions?.width ?? room.dimensions?.length ?? 0;
      const roomDepth = room.dimensions?.depth ?? 0;
      const thickness = room.wallThickness ?? 0.12;
      const position: [number, number, number] =
        opening.wall === 'north' ? [center, opening.sillHeight, -roomDepth / 2 + thickness / 2] :
          opening.wall === 'south' ? [center, opening.sillHeight, roomDepth / 2 - thickness / 2] :
            opening.wall === 'east' ? [roomWidth / 2 - thickness / 2, opening.sillHeight, center] :
              [-roomWidth / 2 + thickness / 2, opening.sillHeight, center];
      const rotationY = opening.wall === 'north' ? 0 :
        opening.wall === 'south' ? 180 : opening.wall === 'east' ? -90 : 90;
      const roomRotation = new Euler(
        ...((room.rotation ?? [0, 0, 0]).map((degree) => (degree * Math.PI) / 180) as [number, number, number]),
        scene.coordinateSystem.rotationOrder,
      );
      const openingRotation = new Euler(0, (rotationY * Math.PI) / 180, 0, scene.coordinateSystem.rotationOrder);
      const worldRotation = new Euler().setFromQuaternion(
        new Quaternion().setFromEuler(roomRotation).multiply(new Quaternion().setFromEuler(openingRotation)),
        scene.coordinateSystem.rotationOrder,
      );
      const sceneObject: SceneObjectDefinition = {
        id: opening.id,
        name: opening.label ?? opening.type,
        assetId,
        category: opening.type,
        roomId: room.id,
        transform: {
          position: roomLocalToWorld(position, room),
          rotation: [
            (worldRotation.x * 180) / Math.PI,
            (worldRotation.y * 180) / Math.PI,
            (worldRotation.z * 180) / Math.PI,
          ],
          scale: [opening.width / width, opening.height / height, thickness / depth],
        },
      };
      return objectSelection(scene, sceneObject, registry);
    }

    for (const category of ['floorTiles', 'walls', 'doors', 'windows'] as const) {
      const placement = room.structural?.[category]?.find((candidate) => candidate.id === id);
      if (placement) {
        return objectSelection(scene, {
          id: placement.id,
          name: placement.label,
          assetId: placement.assetId,
          category: 'structural',
          roomId: room.id,
          transform: placement.transform,
        }, registry);
      }
    }
  }
  return null;
}
