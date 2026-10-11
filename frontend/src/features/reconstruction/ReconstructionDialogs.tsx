import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useAddStage, useCreateReconstruction, useGenerateReconstructions } from '@/hooks/useReconstruction';
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
        {create.isError && <p className="text-xs text-danger">{(create.error as Error).message}</p>}
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
              <label key={e.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-raised text-body text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventIds.includes(e.id)}
                  onChange={(ev) => setEventIds(ev.target.checked ? [...eventIds, e.id] : eventIds.filter((id) => id !== e.id))}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-mono text-xs text-ink-muted">{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</span> {e.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {add.isError && <p className="text-xs text-danger">{(add.error as Error).message}</p>}
      </form>
    </Dialog>
  );
};

/**
 * Generates scenarios from the case's evidence (POST /api/cases/{id}/reconstructions/generate):
 * the backend reads every evidence item and record, writes a scene script and builds the 3D
 * scene from it, one scenario per competing account.
 */
export const GenerateDialog: React.FC<{ caseId: Id; onClose: () => void; onCreated: (id: Id) => void }> = ({ caseId, onClose, onCreated }) => {
  const generate = useGenerateReconstructions(caseId);
  const [instructions, setInstructions] = useState('');
  const result = generate.data;

  return (
    <Dialog
      open
      title="Generate from evidence"
      onClose={onClose}
      busy={generate.isPending}
      footer={
        result ? (
          <button
            onClick={() => {
              if (result.reconstructions[0]) onCreated(result.reconstructions[0].id);
              onClose();
            }}
            className={primaryButtonClass}
          >
            Open the scene
          </button>
        ) : (
          <>
            <button onClick={onClose} disabled={generate.isPending} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" form="generate-form" disabled={generate.isPending} className={primaryButtonClass}>
              {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden />}
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          </>
        )
      }
    >
      {!result && (
        <form
          id="generate-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate({ instructions: instructions.trim() });
          }}
        >
          <p className="text-body text-ink-soft">
            Evidentia reads every evidence item and record in this case and writes a scene script: the place, the vehicles,
            people and items, the traces found there, and what happened stage by stage. It then builds the 3D scene from the
            script. Where accounts conflict, you get one scenario per account. Every position it has to estimate is listed in
            the scenario’s assumptions, for you to check.
          </p>
          <div>
            <label htmlFor="generate-instructions" className={labelClass}>
              Instructions (optional)
            </label>
            <textarea
              id="generate-instructions"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Show each driver’s account as its own scenario."
              className={`${inputClass} resize-none`}
              disabled={generate.isPending}
            />
          </div>
          {generate.isPending && (
            <p className="text-xs text-ink-muted" role="status">
              Reading the evidence and writing the scene script. With Gemini this takes up to a minute.
            </p>
          )}
          {generate.isError && <p className="text-xs text-danger">{(generate.error as Error).message}</p>}
        </form>
      )}
      {result && (
        <div className="space-y-3" role="status">
          <p className="text-body text-ink">
            {result.reconstructions.length === 1 ? 'One scenario' : `${result.reconstructions.length} scenarios`} generated{' '}
            {result.generator === 'gemini' ? `by Gemini (${result.model})` : 'from the case records, without AI'}.
          </p>
          <ul className="space-y-1">
            {result.reconstructions.map((r) => (
              <li key={r.id} className="text-body text-ink-soft">
                {r.scenario} <span className="text-2xs text-ink-muted">version {r.version}</span>
              </li>
            ))}
          </ul>
          {result.warnings.length > 0 && (
            <div>
              <div className="text-xs font-medium text-ink-muted">Notes on the script</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-soft">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};
