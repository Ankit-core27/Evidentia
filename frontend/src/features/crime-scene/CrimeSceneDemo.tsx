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
} from '@evidentia/scene-engine';
import { planScene, type ScenePlannerDiagnostic, type ScenePlannerResult } from '@evidentia/scene-planner';
import { Eye, EyeOff } from 'lucide-react';
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
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const plannerDetailsRef = useRef<HTMLDetailsElement>(null);
  const handleSelectionChange = useCallback((nextSelection: SceneSelection | null) => {
    setSelection(nextSelection);
    if (nextSelection) setInspectorOpen(true);
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
      setInspectorOpen(false);
      setLoadResult(loadScene(plannedScene));
      return;
    }
    const nextScene = demoScenes[nextSceneId];
    if (!nextScene) return;
    setSceneId(nextSceneId);
    setSelection(null);
    setInspectorOpen(false);
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
    setInspectorOpen(false);
    if (validated.success) setSceneId('planned');
    if (validated.success && plannerDetailsRef.current) plannerDetailsRef.current.open = false;
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="crime-scene-demo">
      <div className="relative z-[4] flex min-h-10 flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-2 py-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
          Scene
          <select
            aria-label="Demo scene"
            value={sceneId}
            onChange={(event) => handleSceneChange(event.target.value)}
            className="max-w-[min(13rem,45vw)] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:border-cyan-500 focus:outline-none"
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
        <details ref={plannerDetailsRef} className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700">
            Plan scene
          </summary>
          <div className="absolute left-0 top-full z-[6] mt-1 w-[min(25rem,calc(100vw-2rem))] rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 shadow-xl">
            <form className="space-y-2" onSubmit={handlePlanScene}>
              <label className="block">
                Synthetic scene description
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
                className="mt-2 max-h-36 overflow-auto border-t border-slate-700 pt-2"
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
          </div>
        </details>
        <button
          type="button"
          onClick={() => setInspectorOpen((open) => !open)}
          aria-expanded={inspectorOpen}
          aria-label={inspectorOpen ? 'Hide object inspector' : 'Show object inspector'}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700"
        >
          {inspectorOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          Inspector{selection ? ' · selected' : ''}
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
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
              className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded bg-slate-950/80 px-2 py-1 text-[10px] text-emerald-300"
            >
              Scene validated · {loadResult.scene.sceneId}
            </div>
          </>
        ) : (
          <div
            role="alert"
            className="absolute inset-0 z-[2] overflow-auto bg-slate-950 p-5 text-sm text-rose-200"
          >
            <h3 className="font-semibold">Scene could not be loaded</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {loadResult.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`}>
                  <strong>{diagnostic.code}</strong> · {diagnostic.path}: {diagnostic.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {inspectorOpen && (
          <div className="absolute inset-y-2 right-2 z-[5] w-[min(17rem,calc(100%-1rem))] overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/95 shadow-xl">
            <SceneInspectionPanel
              selection={selection}
              onEvidenceSelect={handleEvidenceNavigate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
