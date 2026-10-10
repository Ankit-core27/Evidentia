import React, { useState } from 'react';
import { LoadingState } from '@/components/shared/QueryState';
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
    return <p className="text-xs text-slate-400">Add a second scenario to compare competing sequences.</p>;
  }

  const select = (value: Id | null, onChange: (id: Id) => void, label: string) => (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="w-full py-1.5 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
    >
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
    if (!stage) return <div className="p-3 rounded-xl border border-dashed border-slate-800 text-[11px] text-slate-600">No stage</div>;
    const otherEvents = new Set(other?.stages[index]?.event_ids ?? []);
    return (
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
        <div className="text-xs font-bold text-slate-100">
          {stage.stage_order}. {stage.label}
        </div>
        {stage.event_ids.length === 0 && <p className="text-[11px] text-slate-500">No events.</p>}
        {stage.event_ids.map((id) => {
          const e = event(id);
          const differs = !otherEvents.has(id);
          return (
            <div
              key={id}
              className={`text-[11px] p-1.5 rounded-lg ${differs ? 'bg-amber-500/10 border border-amber-500/30 text-amber-100' : 'text-slate-300'}`}
              data-differs={differs || undefined}
            >
              {e ? (
                <>
                  <span className="text-cyan-300">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span> {e.description}
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
          <div key={side.label} className="space-y-2">
            {select(side.value, side.set, side.label)}
            {side.detail?.assumptions && (
              <p className="text-[11px] text-slate-400 p-2.5 rounded-lg bg-slate-950 border border-slate-800">{side.detail.assumptions}</p>
            )}
          </div>
        ))}
      </div>
      {(left.isPending || right.isPending) && <LoadingState />}
      <p className="text-[10px] text-slate-500">Highlighted events appear at this stage in one scenario but not the other.</p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-2 gap-4">
          {cell(left.data, right.data, i)}
          {cell(right.data, left.data, i)}
        </div>
      ))}
    </div>
  );
};
