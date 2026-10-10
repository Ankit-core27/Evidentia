import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { primaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { useReconstruction, useReconstructions } from '@/hooks/useReconstruction';
import { casePath } from '@/lib/caseModules';
import { formatTimeRange } from '@/lib/format';
import { useStageStore } from '@/stores/stage';
import { CaseWorkspace } from '@/types/api';
import { CompareScenarios } from './CompareScenarios';
import { ScenarioDialog, StageDialog } from './ReconstructionDialogs';
import { SceneObjectPanel } from './SceneObjectPanel';
import { SchematicSceneView } from './SchematicSceneView';

const PLAYBACK_MS = 2500;
const CrimeSceneDemo = React.lazy(() =>
  import('@/features/crime-scene/CrimeSceneDemo').then((module) => ({
    default: module.CrimeSceneDemo,
  })),
);

/**
 * Reconstruction scenarios and their stages. The active scenario, stage and scene object
 * live in the stage store, shared with the timeline and the 3D viewer.
 */
export const ReconstructionModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const listQuery = useReconstructions(caseId);
  const { reconstructionId, stageId, sceneObjectId, setReconstruction, setStage, selectSceneObject } = useStageStore();
  const detailQuery = useReconstruction(reconstructionId);
  const [mode, setMode] = useState<'stages' | 'compare'>('stages');
  const [dialog, setDialog] = useState<'scenario' | 'stage' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [viewerKind, setViewerKind] = useState<'stage' | 'demo'>('demo');

  const scenarios = listQuery.data ?? [];
  const detail = detailQuery.data?.case_id === caseId ? detailQuery.data : undefined;
  const stages = detail?.stages ?? [];
  const stageIndex = stages.findIndex((s) => s.id === stageId);
  const stage = stageIndex >= 0 ? stages[stageIndex] : undefined;

  // Keep the store pointing at a scenario and stage of this case.
  useEffect(() => {
    if (listQuery.data && !listQuery.data.some((r) => r.id === reconstructionId)) {
      setReconstruction(listQuery.data[0]?.id ?? null);
    }
  }, [listQuery.data, reconstructionId, setReconstruction]);
  useEffect(() => {
    if (detail && !detail.stages.some((s) => s.id === stageId)) setStage(detail.stages[0]?.id ?? null);
  }, [detail, stageId, setStage]);

  // Playback steps through the stages, then stops on the last one.
  useEffect(() => {
    if (!playing) return;
    if (stageIndex < 0 || stageIndex >= stages.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStage(stages[stageIndex + 1].id), PLAYBACK_MS);
    return () => clearTimeout(timer);
  }, [playing, stageIndex, stages, setStage]);

  if (listQuery.isPending) return <LoadingState label="Loading reconstructions…" />;
  if (listQuery.isError) return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />;

  const sceneObject = stage?.scene_objects.find((o) => o.id === sceneObjectId);
  const eventsOf = (ids: number[]) =>
    ids.map((id) => workspace.events.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Box className="w-5 h-5 text-cyan-400" />
            Reconstruction
          </h2>
          <p className="text-xs text-slate-400">Competing scenarios of what happened, stage by stage, with the scene at each stage.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs" role="tablist">
            {(['stages', 'compare'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-lg whitespace-nowrap ${mode === m ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {m === 'stages' ? 'Stages' : 'Compare scenarios'}
              </button>
            ))}
          </div>
          <button onClick={() => setDialog('scenario')} className={primaryButtonClass}>
            <Plus className="w-3.5 h-3.5" /> New scenario
          </button>
        </div>
      </div>

      {scenarios.length === 0 && (
        <EmptyState title="No scenarios yet" message="Create a scenario, then add its stages from the timeline's events." />
      )}

      {mode === 'compare' && scenarios.length > 0 && <CompareScenarios workspace={workspace} scenarios={scenarios} />}

      {mode === 'stages' && scenarios.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Scenarios">
            {scenarios.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={s.id === reconstructionId}
                onClick={() => {
                  setPlaying(false);
                  setReconstruction(s.id);
                }}
                className={`px-3 py-2 rounded-xl border text-left text-xs shrink-0 ${
                  s.id === reconstructionId ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-bold">{s.scenario}</div>
                <div className="text-[10px] text-slate-400">Version {s.version}</div>
              </button>
            ))}
          </div>

          {detailQuery.isPending && <LoadingState label="Loading scenario…" />}
          {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}

          {detail && (
            <div className="space-y-3">
              {detail.assumptions && (
                <p className="text-xs text-slate-300 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Assumptions</span>
                  {detail.assumptions}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2" aria-label="Stages">
                <button
                  onClick={() => stageIndex > 0 && setStage(stages[stageIndex - 1].id)}
                  disabled={stageIndex <= 0}
                  className={smallButtonClass}
                  aria-label="Previous stage"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {stages.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setPlaying(false);
                      setStage(s.id);
                    }}
                    aria-pressed={s.id === stageId}
                    className={`px-3 py-1.5 rounded-lg border text-xs ${
                      s.id === stageId ? 'bg-purple-500/20 border-purple-400/60 text-purple-100 font-bold' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {s.stage_order}. {s.label}
                  </button>
                ))}
                <button
                  onClick={() => stageIndex < stages.length - 1 && setStage(stages[stageIndex + 1].id)}
                  disabled={stageIndex < 0 || stageIndex >= stages.length - 1}
                  className={smallButtonClass}
                  aria-label="Next stage"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (!playing && stageIndex === stages.length - 1 && stages.length) setStage(stages[0].id);
                    setPlaying(!playing);
                  }}
                  disabled={stages.length < 2}
                  className={smallButtonClass}
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {playing ? 'Pause' : 'Play'}
                </button>
                <button onClick={() => setDialog('stage')} className={`${smallButtonClass} ml-auto`}>
                  <Plus className="w-3 h-3" /> Add stage
                </button>
              </div>

              {stages.length === 0 && <EmptyState title="This scenario has no stages yet" message="Add a stage and choose its events." />}

              {stage && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                  <div className="xl:col-span-2 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-800">
                      <span className="text-xs text-slate-300">
                        {viewerKind === 'demo' ? '3D engine preview · synthetic scene' : `${stage.label} · stage schematic`}
                      </span>
                      <div className="flex gap-1" aria-label="Scene viewer mode">
                        <button
                          type="button"
                          aria-pressed={viewerKind === 'demo'}
                          onClick={() => setViewerKind('demo')}
                          className={`px-2 py-1 rounded-md text-[11px] ${viewerKind === 'demo' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          3D demo
                        </button>
                        <button
                          type="button"
                          aria-pressed={viewerKind === 'stage'}
                          onClick={() => setViewerKind('stage')}
                          className={`px-2 py-1 rounded-md text-[11px] ${viewerKind === 'stage' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Stage schematic
                        </button>
                      </div>
                    </div>
                    <div className="h-[460px]">
                      {viewerKind === 'demo' ? (
                        <React.Suspense
                          fallback={<div className="p-4 text-xs text-slate-400">Loading 3D scene…</div>}
                        >
                          <CrimeSceneDemo />
                        </React.Suspense>
                      ) : (
                        <SchematicSceneView
                          reconstruction={detail}
                          stageId={stage.id}
                          selectedSceneObjectId={sceneObjectId}
                          onSelectSceneObject={selectSceneObject}
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {sceneObject && <SceneObjectPanel workspace={workspace} sceneObject={sceneObject} onClose={() => selectSceneObject(null)} />}
                    <section className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2" aria-label="Stage events">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-200 uppercase">
                          {stage.label}: events ({stage.event_ids.length})
                        </h3>
                        <Link to={casePath(caseId, 'timeline')} className="text-[10px] text-cyan-400 hover:underline">
                          Show in timeline
                        </Link>
                      </div>
                      {eventsOf(stage.event_ids).map((e) => (
                        <div key={e.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                          <span className="text-cyan-300">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span>{' '}
                          <span className="text-slate-200">{e.description}</span>
                        </div>
                      ))}
                      <h3 className="text-xs font-bold text-slate-200 uppercase pt-2">Scene objects ({stage.scene_objects.length})</h3>
                      {stage.scene_objects.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => selectSceneObject(o.id)}
                          className={`w-full text-left p-2 rounded-lg border text-[11px] ${
                            o.id === sceneObjectId ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </section>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {dialog === 'scenario' && (
        <ScenarioDialog caseId={caseId} onClose={() => setDialog(null)} onCreated={(r) => setReconstruction(r.id)} />
      )}
      {dialog === 'stage' && detail && (
        <StageDialog
          caseId={caseId}
          reconstructionId={detail.id}
          nextOrder={stages.length + 1}
          events={workspace.events.filter((e) => e.review_status !== 'rejected')}
          onClose={() => setDialog(null)}
          onCreated={(id) => setStage(id)}
        />
      )}
    </div>
  );
};
