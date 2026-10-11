import { useEffect } from 'react';
import { useReconstruction, useReconstructions } from '@/hooks/useReconstruction';
import { useStageStore } from '@/stores/stage';
import { Id } from '@/types/api';
import { usePlaybackStore } from './playback';

/** How long playback takes to go from one stage to the next. */
export const PLAYBACK_MS = 2500;

/**
 * The case's active scenario and stage, and the time slider's playback. The stage
 * store and the playhead are shared, so the reconstruction panel, the timeline and the
 * area map all show the same scenario at the same moment. Use it in one view at a time.
 */
export function useCaseScenario(caseId: Id) {
  const listQuery = useReconstructions(caseId);
  const { reconstructionId, stageId, setReconstruction, setStage } = useStageStore();
  const detailQuery = useReconstruction(reconstructionId);
  const { playing, setPlaying, setPosition } = usePlaybackStore();
  const roundedPosition = usePlaybackStore((s) => Math.round(s.position));

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
  // Stop playing when the scenario changes or the view closes.
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
  const chooseScenario = (id: Id) => {
    setPlaying(false);
    setReconstruction(id);
  };

  return { listQuery, detailQuery, scenarios, detail, stages, stageIndex, stage, playing, togglePlay, goToStage, chooseScenario };
}
