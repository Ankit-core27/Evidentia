import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EulerOrder } from 'three';

import { assetRegistry } from './assets/asset-registry.js';
import { diagnoseScene } from './diagnostics/scene-diagnostics.js';
import { validateScene } from './schema/scene.schema.js';
import { SceneCanvas } from './SceneCanvas.js';
import { SceneControls } from './SceneControls.js';
import type { SceneAssetLoadError, SceneDefinition, SceneSelection } from './types/scene.js';

export type { SceneAssetLoadError, SceneObjectSelection, SceneSelection } from './types/scene.js';

export interface CrimeSceneEngineProps {
  scene: SceneDefinition;
  onObjectSelect?: (object: SceneSelection) => void;
  onSelectionChange?: (selection: SceneSelection | null) => void;
  onAssetLoadError?: (failure: SceneAssetLoadError) => void;
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
  onSelectionChange,
  onAssetLoadError,
  className,
  style,
}: CrimeSceneEngineProps) {
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const [selectionSceneId, setSelectionSceneId] = useState(scene.sceneId);
  const selectedId = selectionSceneId === scene.sceneId ? selection?.id ?? null : null;
  const [showEvidenceMarkers, setShowEvidenceMarkers] = useState(true);
  const [showCeilings, setShowCeilings] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [overheadVersion, setOverheadVersion] = useState(0);
  const [assetErrors, setAssetErrors] = useState<SceneAssetLoadError[]>([]);
  const validation = useMemo(() => validateScene(scene, assetRegistry), [scene]);
  const diagnostics = useMemo(() => diagnoseScene(scene, assetRegistry), [scene]);
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');

  useEffect(() => {
    setSelection(null);
    setSelectionSceneId(scene.sceneId);
    setResetVersion((version) => version + 1);
    setAssetErrors([]);
    onSelectionChange?.(null);
  }, [scene.sceneId]);

  const selectObject = useCallback(
    (nextSelection: SceneSelection) => {
      setSelection(nextSelection);
      setSelectionSceneId(scene.sceneId);
      onObjectSelect?.(nextSelection);
      onSelectionChange?.(nextSelection);
    },
    [onObjectSelect, onSelectionChange, scene.sceneId],
  );
  const clearSelection = useCallback(() => {
    setSelection(null);
    onSelectionChange?.(null);
  }, [onSelectionChange]);
  const reportAssetError = useCallback((failure: SceneAssetLoadError) => {
    setAssetErrors((current) => current.some(({ id }) => id === failure.id)
      ? current
      : [...current, failure]);
    onAssetLoadError?.(failure);
  }, [onAssetLoadError]);

  useEffect(() => {
    if (!showEvidenceMarkers && selection?.kind === 'evidence-marker') clearSelection();
  }, [clearSelection, selection, showEvidenceMarkers]);

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
          key={scene.sceneId}
          scene={scene}
          selectedId={selectedId}
          showEvidenceMarkers={showEvidenceMarkers}
          showCeilings={showCeilings}
          resetVersion={resetVersion}
          overheadVersion={overheadVersion}
          onObjectSelect={selectObject}
          onAssetLoadError={reportAssetError}
          onClearSelection={clearSelection}
        />
      </div>
      {assetErrors.length > 0 && (
        <div
          role="alert"
          className="absolute right-3 top-[5.5rem] z-[2] max-w-[min(20rem,calc(100%-1.5rem))] rounded border border-rose-700 bg-slate-950/95 p-2 text-xs text-rose-200"
        >
          <p className="font-semibold">Some scene assets could not be loaded.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {assetErrors.map((failure) => (
              <li key={failure.id}>
                {failure.name} ({failure.assetId}): {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
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
