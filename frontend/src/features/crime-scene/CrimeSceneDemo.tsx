import { useCallback, useState } from 'react';
import {
  CrimeSceneEngine,
  mockMultiRoomScene,
  mockMurderScene,
  mockRoadAccidentScene,
  loadScene,
  type SceneDefinition,
  type SceneLoadResult,
  type SceneSelection,
} from '@forensix/scene-engine';
import { SceneInspectionPanel } from '@/features/crime-scene/SceneInspectionPanel';

const demoScenes: Record<string, SceneDefinition> = {
  murder: mockMurderScene,
  'multi-room': mockMultiRoomScene,
  road: mockRoadAccidentScene,
};

interface CrimeSceneDemoProps {
  onEvidenceNavigate?: (evidenceId: string) => void;
}

export function CrimeSceneDemo({ onEvidenceNavigate }: CrimeSceneDemoProps) {
  const [sceneId, setSceneId] = useState('murder');
  const [loadResult, setLoadResult] = useState<SceneLoadResult>(() => loadScene(demoScenes.murder));
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const handleSelectionChange = useCallback((nextSelection: SceneSelection | null) => {
    setSelection(nextSelection);
  }, []);
  const handleEvidenceNavigate = useCallback((evidenceId: string) => {
    if (onEvidenceNavigate) {
      onEvidenceNavigate(evidenceId);
    } else {
      console.info('Evidence navigation requested for scene reference:', evidenceId);
    }
  }, [onEvidenceNavigate]);
  const handleSceneChange = (nextSceneId: string) => {
    const nextScene = demoScenes[nextSceneId];
    setSceneId(nextSceneId);
    setSelection(null);
    setLoadResult(loadScene(nextScene));
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_15rem]" data-testid="crime-scene-demo">
      <div className="relative min-h-0">
      <label
        style={{
          position: 'absolute',
          zIndex: 3,
          top: 58,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: '#e2e8f0',
          background: '#0f172aee',
          border: '1px solid #475569',
          borderRadius: 6,
          padding: '5px 8px',
          font: '12px/1.2 sans-serif',
        }}
      >
        Demo scene
        <select
          aria-label="Demo scene"
          value={sceneId}
          onChange={(event) => handleSceneChange(event.target.value)}
          style={{ color: '#e2e8f0', background: '#0f172a', border: 0 }}
        >
          <option value="murder">Residential murder</option>
          <option value="multi-room">Multi-room house</option>
          <option value="road">Road collision</option>
        </select>
      </label>
      {loadResult.success ? (
        <>
          <CrimeSceneEngine
            key={loadResult.scene.sceneId}
            scene={loadResult.scene}
            onSelectionChange={handleSelectionChange}
            onObjectSelect={(object) => {
              console.info('Selected scene object:', object);
            }}
            style={{ minHeight: 0, height: '100%', borderRadius: 0 }}
          />
          <div
            role="status"
            className="pointer-events-none absolute bottom-10 left-3 z-[2] rounded bg-slate-950/80 px-2 py-1 text-[10px] text-emerald-300"
          >
            Scene validated · {loadResult.scene.sceneId}
          </div>
        </>
      ) : (
        <div
          role="alert"
          className="absolute inset-0 z-[2] overflow-auto bg-slate-950 p-5 pt-32 text-sm text-rose-200"
        >
          <h3 className="font-semibold">Scene could not be loaded</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {loadResult.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${diagnostic.path}-${index}`}>
                <strong>{diagnostic.code}</strong> · {diagnostic.path}: {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      <SceneInspectionPanel
        selection={selection}
        onEvidenceSelect={handleEvidenceNavigate}
      />
    </div>
  );
}
