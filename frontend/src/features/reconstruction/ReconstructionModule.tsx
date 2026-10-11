import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { PageHeader, SectionHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { Tabs } from '@/components/shared/Segmented';
import { linkClass, primaryButtonClass, secondaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { useReconstruction, useReconstructions } from '@/hooks/useReconstruction';
import { casePath } from '@/lib/caseModules';
import { formatDateTime, formatTimeRange } from '@/lib/format';
import { useFullscreenElement } from '@/hooks/useFullscreen';
import { useStageStore } from '@/stores/stage';
import { CaseWorkspace } from '@/types/api';
import { CompareScenarios } from './CompareScenarios';
import { GenerateDialog, ScenarioDialog, StageDialog } from './ReconstructionDialogs';
import { SceneScriptPanel } from './SceneScriptPanel';
import { SceneObjectPanel } from './SceneObjectPanel';
import { SchematicSceneView } from './SchematicSceneView';
import { SceneFullscreenContext } from './fullscreen';
import { usePlaybackStore } from './playback';
import { StageTimeSlider } from './StageTimeSlider';

/** How long playback takes to go from one stage to the next. */
const PLAYBACK_MS = 2500;
// The 3D viewer loads only when the tab opens, so three.js stays out of the main bundle.
const CaseSceneViewer = React.lazy(() =>
  import('@/features/crime-scene/case-scene/CaseSceneViewer').then((module) => ({ default: module.CaseSceneViewer }))
);

/** Falls back to the 2D plan when WebGL or a 3D asset fails. */
class SceneErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="relative h-full">
        {this.props.fallback}
        <p className="absolute left-2 top-2 rounded bg-canvas/90 px-2 py-1 text-xs text-ink-soft">
          The 3D view couldn’t start ({this.state.error.message}), so this is the plan.
        </p>
      </div>
    );
  }
}

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
  const [dialog, setDialog] = useState<'generate' | 'scenario' | 'stage' | null>(null);
  const [viewerKind, setViewerKind] = useState<'3d' | 'plan'>('3d');
  const { playing, setPlaying, setPosition } = usePlaybackStore();
  const roundedPosition = usePlaybackStore((s) => Math.round(s.position));
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fullscreenElement = useFullscreenElement();
  const isFullscreen = !!fullscreenElement && fullscreenElement === workspaceRef.current;
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void workspaceRef.current?.requestFullscreen?.();
  }, []);
  const fullscreen = useMemo(() => ({ active: isFullscreen, toggle: toggleFullscreen }), [isFullscreen, toggleFullscreen]);

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

  // The slider's playhead and the active stage follow each other: the stage is the one
  // nearest the playhead, and a stage picked elsewhere (the timeline, a stage button)
  // moves the playhead to it.
  useEffect(() => {
    if (stageIndex < 0) return;
    const { position } = usePlaybackStore.getState();
    if (Math.round(position) !== stageIndex) setPosition(stageIndex);
  }, [stageIndex, setPosition]);
  useEffect(() => {
    const next = stages[Math.min(Math.max(roundedPosition, 0), stages.length - 1)];
    if (next && next.id !== useStageStore.getState().stageId) setStage(next.id);
    // Only the playhead drives this; stage changes are synced by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundedPosition]);

  // Playback moves the playhead smoothly through the stages, then stops on the last one.
  useEffect(() => {
    if (!playing) return;
    if (stages.length < 2) {
      setPlaying(false);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const { position } = usePlaybackStore.getState();
      const next = Math.min(position + (now - last) / PLAYBACK_MS, stages.length - 1);
      last = now;
      setPosition(next);
      if (next >= stages.length - 1) setPlaying(false);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, stages.length, setPlaying, setPosition]);
  // Stop playing when the scenario changes or the panel closes.
  useEffect(() => () => setPlaying(false), [reconstructionId, setPlaying]);

  const togglePlay = () => {
    if (!playing && usePlaybackStore.getState().position >= stages.length - 1) setPosition(0);
    setPlaying(!playing);
  };
  const goToStage = (index: number) => {
    setPlaying(false);
    setPosition(index);
    setStage(stages[index].id);
  };

  if (listQuery.isPending) return <LoadingState label="Loading reconstructions…" />;
  if (listQuery.isError) return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />;

  const sceneObject = stage?.scene_objects.find((o) => o.id === sceneObjectId);
  const plan =
    detail && stage ? (
      <SchematicSceneView reconstruction={detail} stageId={stage.id} selectedSceneObjectId={sceneObjectId} onSelectSceneObject={selectSceneObject} />
    ) : null;
  const eventsOf = (ids: number[]) =>
    ids.map((id) => workspace.events.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reconstruction"
        description="Competing scenarios of what happened, stage by stage, with the scene at each stage."
        actions={
          <>
            <button onClick={() => setDialog('scenario')} className={secondaryButtonClass}>
              <Plus className="size-4" aria-hidden /> New scenario
            </button>
            <button onClick={() => setDialog('generate')} className={primaryButtonClass}>
              <Sparkles className="size-4" aria-hidden /> Generate from evidence
            </button>
          </>
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
        <EmptyState
          title="No scenarios yet"
          message="Generate one from the case’s evidence, or create a scenario and add its stages from the timeline’s events."
        />
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
                  <span className="flex items-center gap-1 text-2xs text-ink-muted">
                    {s.origin === 'ai' && <Sparkles className="size-3 text-accent-text" aria-label="Generated from the evidence" />}
                    Version {s.version}
                  </span>
                </button>
              );
            })}
          </div>

          {detailQuery.isPending && <LoadingState label="Loading scenario…" />}
          {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}

          {detail && (
            <div className="space-y-4">
              {!!detail.case_changes_since && (
                <div
                  role="status"
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-body"
                  data-testid="scenario-out-of-date"
                >
                  <RefreshCw className="size-4 shrink-0 text-warn" aria-hidden />
                  <p className="min-w-0 flex-1 text-ink-soft">
                    The case’s evidence and records changed {detail.case_changes_since}{' '}
                    {detail.case_changes_since === 1 ? 'time' : 'times'} since this scenario was{' '}
                    {detail.origin === 'ai' ? 'generated' : 'made'}
                    {detail.last_case_change_at ? ` (latest ${formatDateTime(detail.last_case_change_at)})` : ''}. A scenario is a
                    snapshot, so its scene doesn’t show those changes until it is regenerated.
                  </p>
                  <button onClick={() => setDialog('generate')} className={smallButtonClass}>
                    <Sparkles className="size-3.5" aria-hidden /> Regenerate from evidence
                  </button>
                </div>
              )}
              {detail.scene && <SceneScriptPanel reconstruction={detail} workspace={workspace} />}
              {!detail.scene && detail.assumptions && (
                <div className="pl-3 border-l-2 border-line-strong max-w-4xl">
                  <div className="text-xs font-medium text-ink-muted">Assumptions</div>
                  <p className="text-body text-ink-soft">{detail.assumptions}</p>
                </div>
              )}

              {/* The stage workspace. Full screen takes all of it, so the stage bar, time
                  slider, selected object, events and evidence stay in reach. */}
              <SceneFullscreenContext.Provider value={fullscreen}>
                <div
                  ref={workspaceRef}
                  className={isFullscreen ? 'flex h-full flex-col gap-3 overflow-hidden bg-canvas p-3' : 'space-y-4'}
                  data-testid="stage-workspace"
                >
                  <div className="flex flex-wrap items-center gap-1.5" aria-label="Stages">
                    {isFullscreen && (
                      <span className="mr-2 min-w-0 max-w-xs truncate text-body font-medium text-ink" title={detail.scenario}>
                        {detail.scenario}
                      </span>
                    )}
                    <button
                      onClick={() => stageIndex > 0 && goToStage(stageIndex - 1)}
                      disabled={stageIndex <= 0}
                      className={`${smallButtonClass} px-1.5`}
                      aria-label="Previous stage"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    {stages.map((s, i) => {
                      const active = s.id === stageId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => goToStage(i)}
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
                      onClick={() => stageIndex < stages.length - 1 && goToStage(stageIndex + 1)}
                      disabled={stageIndex < 0 || stageIndex >= stages.length - 1}
                      className={`${smallButtonClass} px-1.5`}
                      aria-label="Next stage"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => setDialog('stage')} className={smallButtonClass}>
                        <Plus className="size-3" aria-hidden /> Add stage
                      </button>
                      {stage && (
                        <button onClick={toggleFullscreen} className={smallButtonClass} aria-pressed={isFullscreen}>
                          {isFullscreen ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
                          {isFullscreen ? 'Exit full screen' : 'Full screen'}
                        </button>
                      )}
                    </div>
                  </div>

                  {stages.length === 0 && <EmptyState title="This scenario has no stages yet" message="Add a stage and choose its events." />}
                  {stage && !isFullscreen && <StageNote reconstruction={detail} stageOrder={stage.stage_order} />}

                  {stage && (
                    <div
                      className={
                        isFullscreen
                          ? 'grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]'
                          : 'grid grid-cols-1 xl:grid-cols-3 gap-4 items-start'
                      }
                    >
                      <div className={isFullscreen ? 'flex min-h-0 flex-col gap-2' : 'xl:col-span-2 space-y-2'}>
                        <Tabs
                          label="Scene viewer"
                          value={viewerKind}
                          onChange={setViewerKind}
                          options={[
                            { value: '3d', label: '3D scene' },
                            { value: 'plan', label: 'Plan' }
                          ]}
                        />
                        <div className={`rounded-md overflow-hidden border border-line ${isFullscreen ? 'min-h-0 flex-1' : 'h-[420px] sm:h-[560px]'}`}>
                          {viewerKind === '3d' && (
                            <SceneErrorBoundary fallback={plan}>
                              <React.Suspense fallback={<LoadingState label="Loading 3D scene…" />}>
                                <CaseSceneViewer
                                  reconstruction={detail}
                                  stageId={stage.id}
                                  selectedSceneObjectId={sceneObjectId}
                                  onSelectSceneObject={selectSceneObject}
                                />
                              </React.Suspense>
                            </SceneErrorBoundary>
                          )}
                          {viewerKind === 'plan' && plan}
                        </div>
                        <StageTimeSlider stages={stages} events={workspace.events} notes={stageNotes(detail)} onTogglePlay={togglePlay} />
                      </div>
                      <div className={isFullscreen ? 'min-h-0 space-y-5 overflow-y-auto pr-1' : 'space-y-5'}>
                        {isFullscreen && <StageNote reconstruction={detail} stageOrder={stage.stage_order} />}
                        {sceneObject && <SceneObjectPanel workspace={workspace} sceneObject={sceneObject} onClose={() => selectSceneObject(null)} />}
                        <section className="space-y-2" aria-label="Stage events">
                          <SectionHeader
                            title={`${stage.label}: events`}
                            count={stage.event_ids.length}
                            action={
                              !isFullscreen && (
                                <Link to={casePath(caseId, 'timeline')} className={`text-xs ${linkClass}`}>
                                  Show in timeline
                                </Link>
                              )
                            }
                          />
                          <ul className="rounded-md border border-line divide-y divide-line">
                            {eventsOf(stage.event_ids).map((e) => (
                              <li key={e.id} className="px-3 py-2 text-body">
                                <span className="block font-mono text-2xs text-ink-muted">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span>
                                <span className="text-ink">{e.description}</span>
                              </li>
                            ))}
                            {stage.event_ids.length === 0 && <li className="px-3 py-2 text-body text-ink-muted">No events linked to this stage.</li>}
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
              </SceneFullscreenContext.Provider>
            </div>
          )}
        </>
      )}

      {dialog === 'generate' && (
        <GenerateDialog
          caseId={caseId}
          onClose={() => setDialog(null)}
          onCreated={(id) => {
            setMode('stages');
            setReconstruction(id);
          }}
        />
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

type StageNotes = { stage_order: number; time: string; description: string }[] | undefined;
const stageNotes = (reconstruction: { scene?: unknown }): StageNotes =>
  (reconstruction.scene as { stages?: StageNotes } | null)?.stages;

/** What happens at a generated stage, and when, from its scene script. */
const StageNote: React.FC<{ reconstruction: { scene?: unknown }; stageOrder: number }> = ({ reconstruction, stageOrder }) => {
  const note = stageNotes(reconstruction)?.find((s) => s.stage_order === stageOrder);
  if (!note?.description) return null;
  return (
    <p className="max-w-4xl text-body text-ink-soft">
      {note.time && <span className="mr-2 font-mono text-2xs text-ink-muted">{note.time}</span>}
      {note.description}
    </p>
  );
};
