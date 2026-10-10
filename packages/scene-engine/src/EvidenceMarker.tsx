import type { EvidenceMarkerDefinition } from './types/scene.js';
import type { EulerOrder } from 'three';
import { SceneObject } from './SceneObject.js';
import type { SceneAssetLoadError, SceneSelection } from './types/scene.js';

interface EvidenceMarkerProps {
  marker: EvidenceMarkerDefinition;
  number: number;
  rotationOrder: EulerOrder;
  selected: boolean;
  selection: SceneSelection | null;
  onSelect?: (selection: SceneSelection) => void;
  onAssetLoadError?: (failure: SceneAssetLoadError) => void;
}

export function EvidenceMarker({
  marker,
  number,
  rotationOrder,
  selected,
  selection,
  onSelect,
  onAssetLoadError,
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
      onAssetLoadError={onAssetLoadError}
      markerNumber={number}
      markerLabel={marker.label}
    />
  );
}
