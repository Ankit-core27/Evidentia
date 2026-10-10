import type { EvidenceMarkerDefinition } from './types/scene.js';
import type { EulerOrder } from 'three';
import { SceneObject } from './SceneObject.js';
import type { SceneSelection } from './types/scene.js';

interface EvidenceMarkerProps {
  marker: EvidenceMarkerDefinition;
  number: number;
  rotationOrder: EulerOrder;
  selected: boolean;
  selection: SceneSelection | null;
  onSelect?: (selection: SceneSelection) => void;
}

export function EvidenceMarker({
  marker,
  number,
  rotationOrder,
  selected,
  selection,
  onSelect,
}: EvidenceMarkerProps) {
  return (
    <SceneObject
      selection={selection}
      id={marker.id}
      assetId="evidence_marker"
      name={marker.label}
      transform={{
        position: marker.position,
        rotation: marker.rotation ?? [0, 0, 0],
        scale: marker.scale ?? [1, 1, 1],
      }}
      rotationOrder={rotationOrder}
      selected={selected}
      onSelect={onSelect}
      markerNumber={number}
      markerLabel={marker.label}
    />
  );
}
