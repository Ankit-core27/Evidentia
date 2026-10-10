import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EulerOrder } from 'three';

import { assetRegistry } from './assets/asset-registry.js';
import { diagnoseScene } from './diagnostics/scene-diagnostics.js';
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
  const [showCeilings, setShowCeilings] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [overheadVersion, setOverheadVersion] = useState(0);
  const validation = useMemo(() => validateScene(scene, assetRegistry), [scene]);
  const diagnostics = useMemo(() => diagnoseScene(scene, assetRegistry), [scene]);
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');

  useEffect(() => {
    setSelectedId(null);
  }, [scene.sceneId]);

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
        showCeilings={showCeilings}
        onToggleEvidenceMarkers={() => setShowEvidenceMarkers((visible) => !visible)}
        onToggleCeilings={() => setShowCeilings((visible) => !visible)}
        onResetCamera={() => setResetVersion((version) => version + 1)}
        onOverheadView={() => setOverheadVersion((version) => version + 1)}
      />
      <div style={{ position: 'absolute', inset: 0 }}>
        <SceneCanvas
          scene={scene}
          selectedId={selectedId}
          showEvidenceMarkers={showEvidenceMarkers}
          showCeilings={showCeilings}
          resetVersion={resetVersion}
          overheadVersion={overheadVersion}
          onObjectSelect={selectObject}
          onClearSelection={clearSelection}
        />
      </div>
      {warnings.length > 0 && (
        <details
          style={{
            position: 'absolute',
            zIndex: 2,
            left: 12,
            top: 12,
            maxWidth: 'min(380px, calc(100% - 220px))',
            color: '#fde68a',
            background: '#0f172ae8',
            border: '1px solid #854d0e',
            borderRadius: 6,
            padding: '6px 9px',
            font: '12px/1.4 sans-serif',
          }}
        >
          <summary>{warnings.length} scene diagnostic{warnings.length === 1 ? '' : 's'}</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.path}-${index}`}>
                {warning.path}: {warning.message}
              </li>
            ))}
          </ul>
        </details>
      )}
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
