import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react';
import { PageHeader, SectionHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { Tabs } from '@/components/shared/Segmented';
import { linkClass, primaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Box className="w-4 h-4 text-cyan-400" />
          Reconstruction
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]" role="tablist">
            {(['stages', 'compare'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap ${mode === m ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {m === 'stages' ? 'Stages' : 'Compare scenarios'}
              </button>
            ))}
          </div>
          <button onClick={() => setDialog('scenario')} className={`${primaryButtonClass} !px-2.5 !py-1.5 !text-xs`}>
            <Plus className="w-3.5 h-3.5" /> Scenario
          </button>
        }
      />

      <Tabs
        label="Reconstruction views"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'stages', label: 'Stages' },
          { value: 'compare', label: 'Compare scenarios' }
        ]}
      />

      {scenarios.length === 0 && (
        <EmptyState title="No scenarios yet" message="Create a scenario, then add its stages from the timeline's events." />
      )}

      {mode === 'compare' && scenarios.length > 0 && <CompareScenarios workspace={workspace} scenarios={scenarios} />}

      {mode === 'stages' && scenarios.length > 0 && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Scenarios">
            {scenarios.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={s.id === reconstructionId}
                onClick={() => {
                  setPlaying(false);
                  setReconstruction(s.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-left text-xs shrink-0 ${
                  s.id === reconstructionId ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-bold">{s.scenario}</div>
                <div className="text-[9px] text-slate-400">Version {s.version}</div>
              </button>
            ))}
          </div>

          {detailQuery.isPending && <LoadingState label="Loading scenario…" />}
          {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}

          {detail && (
            <div className="space-y-2">
              {detail.assumptions && (
                <details className="rounded-lg bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300">
                  <summary className="cursor-pointer text-[10px] text-slate-400 uppercase font-bold">Scenario assumptions</summary>
                  <p className="pt-1.5">{detail.assumptions}</p>
                </details>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label="Stages">
                <button
                  onClick={() => stageIndex > 0 && setStage(stages[stageIndex - 1].id)}
                  disabled={stageIndex <= 0}
                  className={`${smallButtonClass} px-1.5`}
                  aria-label="Previous stage"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                {stages.map((s) => {
                  const active = s.id === stageId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setPlaying(false);
                        setStage(s.id);
                      }}
                      aria-pressed={active}
                      className={`h-7 px-2.5 rounded border text-xs whitespace-nowrap transition-colors ${
                        active ? 'border-accent bg-accent/15 text-ink font-medium' : 'border-line-strong text-ink-muted hover:text-ink'
                      }`}
                    >
                      <span className="font-mono text-2xs mr-1.5 opacity-70">{s.stage_order}</span>
                      {s.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => stageIndex < stages.length - 1 && setStage(stages[stageIndex + 1].id)}
                  disabled={stageIndex < 0 || stageIndex >= stages.length - 1}
                  className={`${smallButtonClass} px-1.5`}
                  aria-label="Next stage"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (!playing && stageIndex === stages.length - 1 && stages.length) setStage(stages[0].id);
                    setPlaying(!playing);
                  }}
                  disabled={stages.length < 2}
                  className={smallButtonClass}
                >
                  {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? 'Pause' : 'Play stages'}
                </button>
                <button onClick={() => setDialog('stage')} className={`${smallButtonClass} ml-auto`}>
                  <Plus className="size-3" aria-hidden /> Add stage
                </button>
              </div>

              {stages.length === 0 && <EmptyState title="This scenario has no stages yet" message="Add a stage and choose its events." />}

              {stage && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem] gap-2 xl:h-[min(72vh,900px)] xl:min-h-[34rem]">
                  <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-2.5 py-1.5">
                      <span className="text-[11px] text-slate-300">
                        {viewerKind === 'demo' ? '3D crime-scene viewer' : `${stage.label} · stage schematic`}
                      </span>
                      <div className="flex gap-1" aria-label="Scene viewer mode">
                        <button
                          type="button"
                          aria-pressed={viewerKind === 'demo'}
                          onClick={() => setViewerKind('demo')}
                          className={`px-2 py-1 rounded-md text-[10px] ${viewerKind === 'demo' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          3D
                        </button>
                        <button
                          type="button"
                          aria-pressed={viewerKind === 'stage'}
                          onClick={() => setViewerKind('stage')}
                          className={`px-2 py-1 rounded-md text-[10px] ${viewerKind === 'stage' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Schematic
                        </button>
                      </div>
                    </div>
                    <div className="h-[65vh] min-h-[28rem] xl:h-auto xl:min-h-0 xl:flex-1">
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
                  </section>
                  <aside className="min-w-0 space-y-2 xl:h-full xl:overflow-y-auto" aria-label="Stage details">
                    {sceneObject && <SceneObjectPanel workspace={workspace} sceneObject={sceneObject} onClose={() => selectSceneObject(null)} />}
                    <section className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2" aria-label="Stage events">
                      <details open>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-200">
                          <span>{stage.label}: events ({stage.event_ids.length})</span>
                          <Link to={casePath(caseId, 'timeline')} onClick={(event) => event.stopPropagation()} className="text-[9px] font-normal normal-case text-cyan-400 hover:underline">
                            Timeline
                          </Link>
                        </summary>
                        <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                          {eventsOf(stage.event_ids).map((e) => (
                            <div key={e.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px]">
                              <span className="text-cyan-300">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span>{' '}
                              <span className="text-slate-200">{e.description}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                      <details open className="mt-2 border-t border-slate-800 pt-2">
                        <summary className="cursor-pointer text-[10px] font-bold uppercase text-slate-200">
                          Scene objects ({stage.scene_objects.length})
                        </summary>
                        <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto">
                          {stage.scene_objects.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => selectSceneObject(o.id)}
                              className={`w-full text-left px-2 py-1.5 rounded-md border text-[10px] ${
                                o.id === sceneObjectId ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </details>
                    </section>
                  </aside>
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
