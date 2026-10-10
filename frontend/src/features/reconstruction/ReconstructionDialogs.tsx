import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useAddStage, useCreateReconstruction } from '@/hooks/useReconstruction';
import { formatTimeRange } from '@/lib/format';
import { CaseEvent, Id, Reconstruction } from '@/types/api';

/** A new competing scenario (POST /api/cases/{id}/reconstructions). */
export const ScenarioDialog: React.FC<{ caseId: Id; onClose: () => void; onCreated: (r: Reconstruction) => void }> = ({
  caseId,
  onClose,
  onCreated
}) => {
  const create = useCreateReconstruction(caseId);
  const [scenario, setScenario] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [sceneFile, setSceneFile] = useState('');

  return (
    <Dialog
      open
      title="New scenario"
      onClose={onClose}
      busy={create.isPending}
      footer={
        <>
          <button onClick={onClose} disabled={create.isPending} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" form="scenario-form" disabled={create.isPending || !scenario.trim()} className={primaryButtonClass}>
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create scenario
          </button>
        </>
      }
    >
      <form
        id="scenario-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!scenario.trim()) return;
          create.mutate(
            { scenario: scenario.trim(), assumptions: assumptions.trim(), scene_file: sceneFile.trim() || null },
            {
              onSuccess: (r) => {
                onCreated(r);
                onClose();
              }
            }
          );
        }}
      >
        <div>
          <label htmlFor="scenario-name" className={labelClass}>
            Scenario *
          </label>
          <input
            id="scenario-name"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="e.g. Van moved off before its green"
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="scenario-assumptions" className={labelClass}>
            Assumptions
          </label>
          <textarea
            id="scenario-assumptions"
            rows={4}
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
            placeholder="What this scenario takes as given, and which evidence supports it."
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label htmlFor="scenario-scene" className={labelClass}>
            Scene layout file
          </label>
          <input
            id="scenario-scene"
            value={sceneFile}
            onChange={(e) => setSceneFile(e.target.value)}
            placeholder="e.g. road-accident/junction.json (from assets/3d/crime-scenes/scenes)"
            className={inputClass}
          />
        </div>
        {create.isError && <p className="text-[11px] text-red-300">{(create.error as Error).message}</p>}
      </form>
    </Dialog>
  );
};

interface StageDialogProps {
  caseId: Id;
  reconstructionId: Id;
  nextOrder: number;
  events: CaseEvent[];
  onClose: () => void;
  onCreated: (stageId: Id) => void;
}

/** A new stage of a scenario, made of timeline events (POST /api/reconstructions/{id}/stages). */
export const StageDialog: React.FC<StageDialogProps> = ({ caseId, reconstructionId, nextOrder, events, onClose, onCreated }) => {
  const add = useAddStage(caseId, reconstructionId);
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState(String(nextOrder));
  const [eventIds, setEventIds] = useState<Id[]>([]);

  return (
    <Dialog
      open
      title="Add stage"
      onClose={onClose}
      busy={add.isPending}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={add.isPending} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" form="stage-form" disabled={add.isPending || !label.trim()} className={primaryButtonClass}>
            {add.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add stage
          </button>
        </>
      }
    >
      <form
        id="stage-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          add.mutate(
            { label: label.trim(), stage_order: Number(order) || nextOrder, event_ids: eventIds },
            {
              onSuccess: (stage) => {
                onCreated(stage.id);
                onClose();
              }
            }
          );
        }}
      >
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <label htmlFor="stage-label" className={labelClass}>
              Label *
            </label>
            <input id="stage-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Approach" className={inputClass} autoFocus />
          </div>
          <div>
            <label htmlFor="stage-order" className={labelClass}>
              Order
            </label>
            <input id="stage-order" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </div>
        </div>
        <fieldset>
          <legend className={labelClass}>Events in this stage ({eventIds.length})</legend>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {events.map((e) => (
              <label key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventIds.includes(e.id)}
                  onChange={(ev) => setEventIds(ev.target.checked ? [...eventIds, e.id] : eventIds.filter((id) => id !== e.id))}
                  className="accent-cyan-500 mt-0.5"
                />
                <span>
                  <span className="text-cyan-300">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span> · {e.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {add.isError && <p className="text-[11px] text-red-300">{(add.error as Error).message}</p>}
      </form>
    </Dialog>
  );
};
