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
  import('@/features/crime-scene/CrimeSceneDemo').then((module) => ({ default: module.CrimeSceneDemo }))
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
  const [viewerKind, setViewerKind] = useState<'demo' | 'stage'>('demo');

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
      <PageHeader
        title="Reconstruction"
        description="Competing scenarios of what happened, stage by stage, with the scene at each stage."
        actions={
          <button onClick={() => setDialog('scenario')} className={primaryButtonClass}>
            <Plus className="size-4" aria-hidden /> New scenario
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
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Scenarios">
            {scenarios.map((s) => {
              const active = s.id === reconstructionId;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setPlaying(false);
                    setReconstruction(s.id);
                  }}
                  className={`px-3 py-1.5 rounded border text-left shrink-0 transition-colors ${
                    active ? 'border-accent/60 bg-accent/10' : 'border-line-strong hover:border-control'
                  }`}
                >
                  <span className={`block text-body ${active ? 'text-ink font-medium' : 'text-ink-soft'}`}>{s.scenario}</span>
                  <span className="block text-2xs text-ink-muted">Version {s.version}</span>
                </button>
              );
            })}
          </div>

          {detailQuery.isPending && <LoadingState label="Loading scenario…" />}
          {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}

          {detail && (
            <div className="space-y-4">
              {detail.assumptions && (
                <div className="pl-3 border-l-2 border-line-strong max-w-4xl">
                  <div className="text-xs font-medium text-ink-muted">Assumptions</div>
                  <p className="text-body text-ink-soft">{detail.assumptions}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5" aria-label="Stages">
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
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                  {/* Scene host: the 3D track's viewer mounts here (see sceneViewer.ts). */}
                  <div className="xl:col-span-2 space-y-2">
                    <Tabs
                      label="Scene viewer"
                      value={viewerKind}
                      onChange={setViewerKind}
                      options={[
                        { value: 'demo', label: '3D' },
                        { value: 'stage', label: 'Schematic' }
                      ]}
                    />
                    <div className="h-[340px] sm:h-[460px] rounded-md overflow-hidden border border-line">
                      {viewerKind === 'demo' ? (
                        <React.Suspense fallback={<LoadingState label="Loading 3D scene…" />}>
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
                  <div className="space-y-5">
                    {sceneObject && <SceneObjectPanel workspace={workspace} sceneObject={sceneObject} onClose={() => selectSceneObject(null)} />}
                    <section className="space-y-2" aria-label="Stage events">
                      <SectionHeader
                        title={`${stage.label}: events`}
                        count={stage.event_ids.length}
                        action={
                          <Link to={casePath(caseId, 'timeline')} className={`text-xs ${linkClass}`}>
                            Show in timeline
                          </Link>
                        }
                      />
                      <ul className="rounded-md border border-line divide-y divide-line">
                        {eventsOf(stage.event_ids).map((e) => (
                          <li key={e.id} className="px-3 py-2 text-body">
                            <span className="block font-mono text-2xs text-ink-muted">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span>
                            <span className="text-ink">{e.description}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="space-y-2" aria-label="Scene objects">
                      <SectionHeader title="Scene objects" count={stage.scene_objects.length} />
                      <ul className="rounded-md border border-line divide-y divide-line">
                        {stage.scene_objects.map((o) => (
                          <li key={o.id}>
                            <button
                              onClick={() => selectSceneObject(o.id)}
                              aria-pressed={o.id === sceneObjectId}
                              className={`w-full text-left px-3 py-2 text-body transition-colors ${
                                o.id === sceneObjectId ? 'bg-accent/10 text-ink' : 'text-ink-soft hover:bg-surface'
                              }`}
                            >
                              {o.label}
                            </button>
                          </li>
                        ))}
                      </ul>
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
