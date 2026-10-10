import type { EvidenceMarkerDefinition } from './types/scene.js';
import type { EulerOrder } from 'three';
import { SceneObject } from './SceneObject.js';
import type { SceneObjectSelection } from './CrimeSceneEngine.js';

interface EvidenceMarkerProps {
  marker: EvidenceMarkerDefinition;
  number: number;
  rotationOrder: EulerOrder;
  selected: boolean;
  onSelect?: (selection: SceneObjectSelection) => void;
}

export function EvidenceMarker({
  marker,
  number,
  rotationOrder,
  selected,
  onSelect,
}: EvidenceMarkerProps) {
  return (
    <SceneObject
      id={marker.id}
      assetId="evidence_marker"
      name={marker.label}
      transform={{
        position: marker.position,
        rotation: marker.rotation ?? [0, 0, 0],
        scale: marker.scale ?? [1, 1, 1],
      }}
      rotationOrder={rotationOrder}
      evidenceIds={[marker.evidenceId]}
      metadata={{
        ...marker.metadata,
        evidenceId: marker.evidenceId,
        objectId: marker.objectId,
        roomId: marker.roomId,
      }}
      selected={selected}
      onSelect={onSelect}
      markerNumber={number}
    />
  );
}
