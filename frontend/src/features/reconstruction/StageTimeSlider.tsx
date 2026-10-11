import React, { useMemo } from 'react';
import { Pause, Play } from 'lucide-react';
import { CaseEvent, ReconstructionStage } from '@/types/api';
import { between, usePlaybackStore } from './playback';

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Scene-script notes carry each generated stage's local time, such as "21:40:12". */
type StageNotes = { stage_order: number; time: string }[] | undefined;

/**
 * The moment a stage shows: its collision if it has one, else its first event recorded
 * to the second, else its first event at all.
 */
export function stageMoment(stage: ReconstructionStage, events: CaseEvent[]): number | null {
  const own = stage.event_ids
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is CaseEvent => !!e?.time_start)
    .sort((a, b) => Date.parse(a.time_start!) - Date.parse(b.time_start!));
  const pick = own.find((e) => e.category === 'collision') ?? own.find((e) => e.time_precision === 'exact') ?? own[0];
  const t = pick ? Date.parse(pick.time_start!) : NaN;
  return Number.isNaN(t) ? null : t;
}

/**
 * The time slider under the scene: drag it to move every object between its stage
 * placements, play it to watch the stages run, or click a stage or event mark to jump.
 */
export const StageTimeSlider: React.FC<{
  stages: ReconstructionStage[];
  events: CaseEvent[];
  notes: StageNotes;
  onTogglePlay: () => void;
}> = ({ stages, events, notes, onTogglePlay }) => {
  const { position, playing, setPosition, setPlaying, setScrubbing } = usePlaybackStore();
  const count = stages.length;
  const moments = useMemo(() => stages.map((s) => stageMoment(s, events)), [stages, events]);
  // Times only interpolate when they run forward stage by stage.
  const ordered = moments.every((t, i) => t !== null && (i === 0 || t >= moments[i - 1]!));

  // Event marks: each stage's events, spread across that stage's tick.
  const marks = useMemo(() => {
    const list: { key: string; at: number; event: CaseEvent; stage: number }[] = [];
    stages.forEach((s, i) => {
      const own = s.event_ids.map((id) => events.find((e) => e.id === id)).filter((e): e is CaseEvent => !!e);
      own.forEach((event, k) => {
        const spread = own.length > 1 ? (k / (own.length - 1) - 0.5) * 0.3 : 0;
        list.push({ key: `${s.id}-${event.id}`, at: Math.min(Math.max(i + spread, 0), count - 1), event, stage: i });
      });
    });
    return list;
  }, [stages, events, count]);

  if (count === 0) return null;
  const { from, to, progress } = between(position, count);
  let label: string;
  if (ordered && count > 1) label = clock.format(new Date(moments[from]! + (moments[to]! - moments[from]!) * progress));
  else if (ordered) label = clock.format(new Date(moments[0]!));
  else {
    const near = Math.round(Math.min(Math.max(position, 0), count - 1));
    const note = notes?.find((n) => n.stage_order === stages[near].stage_order)?.time;
    label = note || `Stage ${stages[near].stage_order}`;
  }
  const pct = (at: number) => (count > 1 ? (at / (count - 1)) * 100 : 50);
  const currentStage = stages[Math.round(Math.min(Math.max(position, 0), count - 1))];

  return (
    <div className="rounded-md border border-line bg-surface/80 px-3 pt-2 pb-1.5 space-y-1" data-testid="stage-time-slider">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={count < 2}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-raised disabled:opacity-40"
          aria-label={playing ? 'Pause' : 'Play the stages'}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-mono text-sm text-ink" aria-live="off">
              {label}
            </span>
            <span className="truncate text-ink-muted">
              {count > 1 && progress > 0.02 && progress < 0.98
                ? `${stages[from].label} → ${stages[to].label}`
                : currentStage.label}
            </span>
          </div>
          <div className="relative h-7">
            {/* Event marks sit behind the range input and take clicks through gaps in it. */}
            <div className="pointer-events-none absolute inset-x-2 top-0 h-2">
              {marks.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  title={m.event.description}
                  aria-label={`Jump to ${m.event.description}`}
                  onClick={() => {
                    setPlaying(false);
                    setPosition(m.stage);
                  }}
                  className={`pointer-events-auto absolute top-0 size-2 -translate-x-1/2 rounded-full ${
                    m.event.category === 'collision' ? 'bg-danger' : m.event.certainty === 'disputed' ? 'bg-warn' : 'bg-ink-muted'
                  }`}
                  style={{ left: `${pct(m.at)}%` }}
                />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(count - 1, 0)}
              step={0.01}
              value={Math.min(Math.max(position, 0), count - 1)}
              disabled={count < 2}
              onPointerDown={() => {
                setPlaying(false);
                setScrubbing(true);
              }}
              onPointerUp={() => setScrubbing(false)}
              onBlur={() => setScrubbing(false)}
              onChange={(e) => {
                setPlaying(false);
                setPosition(Number(e.target.value));
              }}
              aria-label="Time in the reconstruction"
              aria-valuetext={`${label}, ${currentStage.label}`}
              className="absolute inset-x-0 bottom-0 w-full"
            />
          </div>
          <div className="relative mx-2 h-4 text-2xs text-ink-muted">
            {stages.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setPosition(i);
                }}
                className={`absolute -translate-x-1/2 whitespace-nowrap hover:text-ink ${
                  i === 0 ? 'translate-x-0' : i === count - 1 && count > 1 ? '-translate-x-full' : ''
                } ${s.id === currentStage.id ? 'text-ink font-medium' : ''}`}
                style={{ left: `${pct(i)}%` }}
              >
                {s.stage_order} {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
