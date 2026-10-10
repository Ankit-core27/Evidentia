import React, { useState } from 'react';
import { LoadingState } from '@/components/shared/QueryState';
import { selectClass } from '@/components/shared/formStyles';
import { useReconstruction } from '@/hooks/useReconstruction';
import { formatTimeRange } from '@/lib/format';
import { CaseWorkspace, Id, Reconstruction, ReconstructionDetail } from '@/types/api';

/** Two scenarios side by side, stage by stage, with the events each places in that stage. */
export const CompareScenarios: React.FC<{ workspace: CaseWorkspace; scenarios: Reconstruction[] }> = ({ workspace, scenarios }) => {
  const [leftId, setLeftId] = useState<Id | null>(scenarios[0]?.id ?? null);
  const [rightId, setRightId] = useState<Id | null>(scenarios[1]?.id ?? scenarios[0]?.id ?? null);
  const left = useReconstruction(leftId);
  const right = useReconstruction(rightId);

  if (scenarios.length < 2) {
    return <p className="text-body text-ink-muted">Add a second scenario to compare competing sequences.</p>;
  }

  const select = (value: Id | null, onChange: (id: Id) => void, label: string) => (
    <select value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className={selectClass}>
      {scenarios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.scenario} (v{s.version})
        </option>
      ))}
    </select>
  );

  const rows = Math.max(left.data?.stages.length ?? 0, right.data?.stages.length ?? 0);
  const event = (id: Id) => workspace.events.find((e) => e.id === id);

  const cell = (detail: ReconstructionDetail | undefined, other: ReconstructionDetail | undefined, index: number) => {
    const stage = detail?.stages[index];
    if (!stage) return <div className="px-3 py-2.5 text-xs text-ink-faint">No stage</div>;
    const otherEvents = new Set(other?.stages[index]?.event_ids ?? []);
    return (
      <div className="px-3 py-2.5 space-y-1.5 min-w-0">
        <div className="text-body font-medium text-ink">
          <span className="font-mono text-2xs text-ink-muted mr-1.5">{stage.stage_order}</span>
          {stage.label}
        </div>
        {stage.event_ids.length === 0 && <p className="text-xs text-ink-muted">No events.</p>}
        {stage.event_ids.map((id) => {
          const e = event(id);
          const differs = !otherEvents.has(id);
          return (
            <div
              key={id}
              className={`text-xs pl-2 border-l-2 ${differs ? 'border-warn text-ink' : 'border-transparent text-ink-soft'}`}
              data-differs={differs || undefined}
            >
              {e ? (
                <>
                  <span className="font-mono text-ink-muted">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span> {e.description}
                </>
              ) : (
                `Event #${id}`
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="compare-scenarios">
      <div className="grid grid-cols-2 gap-4">
        {[
          { value: leftId, set: setLeftId, detail: left.data, label: 'First scenario' },
          { value: rightId, set: setRightId, detail: right.data, label: 'Second scenario' }
        ].map((side) => (
          <div key={side.label} className="space-y-2 min-w-0">
            {select(side.value, side.set, side.label)}
            {side.detail?.assumptions && <p className="text-xs text-ink-soft pl-3 border-l-2 border-line-strong">{side.detail.assumptions}</p>}
          </div>
        ))}
      </div>
      {(left.isPending || right.isPending) && <LoadingState />}
      <p className="text-xs text-ink-muted flex items-center gap-2">
        <span className="w-0.5 h-3 bg-warn" aria-hidden /> Marked events sit at this stage in one scenario but not the other.
      </p>
      <div className="rounded-md border border-line divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-2 divide-x divide-line">
            {cell(left.data, right.data, i)}
            {cell(right.data, left.data, i)}
          </div>
        ))}
      </div>
    </div>
  );
};
