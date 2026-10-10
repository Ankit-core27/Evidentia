import { useCallback, useRef, useState, type FormEvent } from 'react';
import {
  CrimeSceneEngine,
  mockMultiRoomScene,
  mockMurderScene,
  mockRoadAccidentScene,
  mockRoomLayoutScenes,
  loadScene,
  type SceneDefinition,
  type SceneLoadResult,
  type SceneSelection,
} from '@forensix/scene-engine';
import { planScene, type ScenePlannerDiagnostic, type ScenePlannerResult } from '@forensix/scene-planner';
import { SceneInspectionPanel } from '@/features/crime-scene/SceneInspectionPanel';

const demoScenes: Record<string, SceneDefinition> = {
  murder: mockMurderScene,
  'multi-room': mockMultiRoomScene,
  road: mockRoadAccidentScene,
  'rooms-1': mockRoomLayoutScenes[1],
  'rooms-3': mockRoomLayoutScenes[3],
  'rooms-5': mockRoomLayoutScenes[5],
  'rooms-10': mockRoomLayoutScenes[10],
};

const sampleDescription = 'A residential house has a living room, a bedroom and a kitchen. The rooms are connected by doorways. A table and chairs are in the living room. A knife is reported near the bedroom doorway. The body exact position has not been measured.';

interface CrimeSceneDemoProps {
  onEvidenceNavigate?: (evidenceId: string) => void;
}

export function CrimeSceneDemo({ onEvidenceNavigate }: CrimeSceneDemoProps) {
  const [sceneId, setSceneId] = useState('murder');
  const [loadResult, setLoadResult] = useState<SceneLoadResult>(() => loadScene(demoScenes.murder));
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const [description, setDescription] = useState(sampleDescription);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [plannerResult, setPlannerResult] = useState<ScenePlannerResult | null>(null);
  const [plannedScene, setPlannedScene] = useState<SceneDefinition | null>(null);
  const plannerDetailsRef = useRef<HTMLDetailsElement>(null);
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
    if (nextSceneId === 'planned') {
      if (!plannedScene) return;
      setSceneId(nextSceneId);
      setSelection(null);
      setLoadResult(loadScene(plannedScene));
      return;
    }
    const nextScene = demoScenes[nextSceneId];
    if (!nextScene) return;
    setSceneId(nextSceneId);
    setSelection(null);
    setLoadResult(loadScene(nextScene));
  };
  const handlePlanScene = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPlannerBusy(true);
    setPlannerResult(null);
    const result = await planScene({
      description,
      environmentType: 'indoor',
    });
    setPlannerResult(result);
    setPlannerBusy(false);
    if (result.success) setPlannedScene(result.scene);
  };
  const handleLoadPlannedScene = () => {
    if (!plannerResult?.success) return;
    const validated = loadScene(plannerResult.scene);
    setLoadResult(validated);
    setSelection(null);
    if (validated.success) setSceneId('planned');
    if (validated.success && plannerDetailsRef.current) plannerDetailsRef.current.open = false;
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
          <option value="rooms-1">1-room validation layout</option>
          <option value="rooms-3">3-room connected house</option>
          <option value="rooms-5">5-room connected house</option>
          <option value="rooms-10">10-room connected house</option>
          <option value="planned">Planned synthetic scene</option>
        </select>
      </label>
      <details ref={plannerDetailsRef} className="absolute left-3 top-[6.7rem] z-[3] w-[min(25rem,calc(100%-1.5rem))] rounded-md border border-slate-600 bg-slate-950/95 p-2 text-xs text-slate-200 shadow-lg">
        <summary className="cursor-pointer font-medium">Plan a synthetic scene</summary>
        <form className="mt-2 space-y-2" onSubmit={handlePlanScene}>
          <label className="block">
            Scene description
            <textarea
              aria-label="Synthetic scene description"
              className="mt-1 min-h-24 w-full rounded border border-slate-600 bg-slate-900 p-2 text-xs"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={plannerBusy}
            className="rounded bg-cyan-700 px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            {plannerBusy ? 'Planning…' : 'Generate mock plan'}
          </button>
        </form>
        {plannerResult && (
          <div
            role={plannerResult.success ? 'status' : 'alert'}
            className="mt-2 max-h-32 overflow-auto border-t border-slate-700 pt-2"
          >
            <p>
              {plannerResult.success
                ? 'Validated deterministic mock plan; not an LLM result or measured reconstruction.'
                : 'Scene plan could not be loaded.'}
            </p>
            {plannerResult.diagnostics.length > 0 && (
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {plannerResult.diagnostics.map((diagnostic: ScenePlannerDiagnostic, index) => (
                  <li key={`${diagnostic.code}-${diagnostic.path}-${index}`}>
                    <strong>{diagnostic.code}</strong> · {diagnostic.message}
                  </li>
              ))}
              </ul>
              )}
              {plannerResult.success && (
                <button
                  type="button"
                  onClick={handleLoadPlannedScene}
                  className="mt-2 rounded bg-emerald-700 px-3 py-1.5 font-medium text-white"
                >
                  Load validated scene
                </button>
              )}
          </div>
        )}
      </details>
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
