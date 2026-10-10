import { useCallback, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EulerOrder } from 'three';

import { assetRegistry } from './assets/asset-registry.js';
import { validateScene } from './schema/scene.schema.js';
import { SceneCanvas } from './SceneCanvas.js';
import { SceneControls } from './SceneControls.js';
import type { SceneDefinition } from './types/scene.js';

export interface SceneObjectSelection {
  id: string;
  assetId: string;
  evidenceIds: string[];
  metadata?: Record<string, unknown>;
}

export interface CrimeSceneEngineProps {
  scene: SceneDefinition;
  onObjectSelect?: (object: SceneObjectSelection) => void;
  className?: string;
  style?: CSSProperties;
}

const viewerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  minHeight: 420,
  height: '100%',
  overflow: 'hidden',
  background: '#111827',
  borderRadius: 12,
};

export function CrimeSceneEngine({
  scene,
  onObjectSelect,
  className,
  style,
}: CrimeSceneEngineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEvidenceMarkers, setShowEvidenceMarkers] = useState(true);
  const [resetVersion, setResetVersion] = useState(0);
  const [overheadVersion, setOverheadVersion] = useState(0);
  const validation = validateScene(scene, assetRegistry);

  const selectObject = useCallback(
    (selection: SceneObjectSelection) => {
      setSelectedId(selection.id);
      onObjectSelect?.(selection);
    },
    [onObjectSelect],
  );
  const clearSelection = useCallback(() => setSelectedId(null), []);

  if (!validation.success) {
    return (
      <div
        className={className}
        role="alert"
        style={{
          ...viewerStyle,
          padding: 16,
          color: '#fecaca',
          border: '1px solid #b91c1c',
          ...(style ?? {}),
        }}
      >
        <strong>Scene data is invalid and cannot be rendered.</strong>
        <ul>
          {validation.errors.map((error, index) => (
            <li key={`${error.path}-${index}`}>
              {error.path}: {error.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={className} style={{ ...viewerStyle, ...style }}>
      <SceneControls
        showEvidenceMarkers={showEvidenceMarkers}
        onToggleEvidenceMarkers={() => setShowEvidenceMarkers((visible) => !visible)}
        onResetCamera={() => setResetVersion((version) => version + 1)}
        onOverheadView={() => setOverheadVersion((version) => version + 1)}
      />
      <div style={{ position: 'absolute', inset: 0 }}>
        <SceneCanvas
          scene={scene}
          selectedId={selectedId}
          showEvidenceMarkers={showEvidenceMarkers}
          resetVersion={resetVersion}
          overheadVersion={overheadVersion}
          onObjectSelect={selectObject}
          onClearSelection={clearSelection}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          color: '#cbd5e1',
          background: '#0f172acc',
          borderRadius: 5,
          padding: '4px 7px',
          font: '11px/1.3 sans-serif',
          pointerEvents: 'none',
        }}
      >
        {scene.title}
        {scene.metadata?.synthetic === true && ' · synthetic scene'}
        {selectedId && ` · selected ${selectedId}`}
      </div>
    </div>
  );
}
