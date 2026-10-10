import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EvidenceLinkPicker } from '@/components/evidence/EvidenceLinkPicker';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useCreateEvent, useUpdateEvent } from '@/hooks/useTimeline';
import { fromLocalInput, toLocalInput } from '@/lib/datetime';
import { humanize } from '@/lib/format';
import { CERTAINTIES, EVENT_CATEGORIES, TIME_PRECISIONS } from '@/lib/options';
import { CaseEvent, CaseWorkspace, Certainty, EventCategory, Id, TimePrecision } from '@/types/api';

interface EventDialogProps {
  workspace: CaseWorkspace;
  /** The event to edit, or null to add one. */
  event: CaseEvent | null;
  onClose: () => void;
}

/**
 * Adds or edits a timeline event: a time range at a stated precision and certainty, so
 * approximate or disputed accounts don't need a fake exact time (docs/PLAN.md).
 */
export const EventDialog: React.FC<EventDialogProps> = ({ workspace, event, onClose }) => {
  const caseId = workspace.case.id;
  const create = useCreateEvent(caseId);
  const update = useUpdateEvent(caseId);
  // Once a new event is saved, the dialog edits it, so evidence can be linked.
  const [savedId, setSavedId] = useState<Id | null>(event?.id ?? null);
  const [description, setDescription] = useState(event?.description ?? '');
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'other');
  const [start, setStart] = useState(toLocalInput(event?.time_start, true));
  const [end, setEnd] = useState(toLocalInput(event?.time_end, true));
  const [precision, setPrecision] = useState<TimePrecision>(event?.time_precision ?? 'minute');
  const [certainty, setCertainty] = useState<Certainty>(event?.certainty ?? 'established');
  const [locationId, setLocationId] = useState<Id | ''>(event?.location_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const saving = create.isPending || update.isPending;

  const save = async () => {
    if (!description.trim()) return setError('Describe what happened.');
    if (start && end && new Date(end) < new Date(start)) return setError('The end of the range is before its start.');
    setError(null);
    const input = {
      description: description.trim(),
      category,
      time_start: fromLocalInput(start),
      time_end: fromLocalInput(end),
      time_precision: precision,
      certainty,
      location_id: locationId === '' ? null : locationId
    };
    try {
      if (savedId === null) {
        const created = await create.mutateAsync(input);
        setSavedId(created.id);
        setJustCreated(true);
      } else {
        await update.mutateAsync({ id: savedId, input });
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    }
  };

  return (
    <Dialog
      open
      title={savedId === null ? 'Add timeline event' : 'Edit timeline event'}
      onClose={onClose}
      busy={saving}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={secondaryButtonClass}>
            {justCreated ? 'Done' : 'Cancel'}
          </button>
          <button type="submit" form="event-form" disabled={saving} className={primaryButtonClass}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {savedId === null ? 'Add event' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id="event-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor="event-description" className={labelClass}>
            What happened *
          </label>
          <textarea
            id="event-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-none`}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="event-category" className={labelClass}>
              Category
            </label>
            <select id="event-category" value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} className={inputClass}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="event-certainty" className={labelClass}>
              Certainty
            </label>
            <select id="event-certainty" value={certainty} onChange={(e) => setCertainty(e.target.value as Certainty)} className={inputClass}>
              {CERTAINTIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="event-location" className={labelClass}>
              Location
            </label>
            <select
              id="event-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')}
              className={inputClass}
            >
              <option value="">Not set</option>
              {workspace.locations
                .filter((l) => l.review_status !== 'rejected')
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.address}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="event-start" className={labelClass}>
              From
            </label>
            <input
              id="event-start"
              type="datetime-local"
              step={1}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label htmlFor="event-end" className={labelClass}>
              To (for a range)
            </label>
            <input
              id="event-end"
              type="datetime-local"
              step={1}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label htmlFor="event-precision" className={labelClass}>
              Precision
            </label>
            <select id="event-precision" value={precision} onChange={(e) => setPrecision(e.target.value as TimePrecision)} className={inputClass}>
              {TIME_PRECISIONS.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {event?.ai_note && (
          <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-[11px] text-cyan-100">
            <span className="text-[10px] text-cyan-400 font-bold uppercase block">AI note</span>
            {event.ai_note}
          </div>
        )}
        {error && (
          <p className="text-[11px] text-red-300" role="alert">
            {error}
          </p>
        )}
        {justCreated && <p className="text-[11px] text-emerald-300">Event added. Link the evidence it rests on below.</p>}
      </form>

      {savedId !== null && (
        <EvidenceLinkPicker
          caseId={caseId}
          targetType="event"
          targetId={savedId}
          links={workspace.links}
          evidence={workspace.evidence}
        />
      )}
    </Dialog>
  );
};
