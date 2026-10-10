import React, { useState } from 'react';
import { Clock, Layers, MapPin, Pencil, Plus, X } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { CertaintyBadge } from '@/components/shared/Badges';
import { DeleteButton } from '@/components/shared/DeleteButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { primaryButtonClass } from '@/components/shared/formStyles';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useReconstruction } from '@/hooks/useReconstruction';
import { useDeleteEvent, useEvents, useUpdateEvent } from '@/hooks/useTimeline';
import { formatDate, formatTimeRange, humanize } from '@/lib/format';
import { CERTAINTIES } from '@/lib/options';
import { useStageStore } from '@/stores/stage';
import { CaseEvent, CaseWorkspace, Certainty, EventCategory } from '@/types/api';
import { EventDialog } from './EventDialog';

const CATEGORY_COLOURS: Partial<Record<EventCategory, string>> = {
  collision: 'bg-red-500 shadow-[0_0_10px_#ef4444]',
  movement: 'bg-cyan-400',
  witness: 'bg-emerald-400',
  emergency: 'bg-amber-400',
  medical: 'bg-pink-400',
  investigation: 'bg-blue-400'
};

const byTime = (a: CaseEvent, b: CaseEvent) => {
  if (!a.time_start && !b.time_start) return a.id - b.id;
  if (!a.time_start) return 1;
  if (!b.time_start) return -1;
  return a.time_start.localeCompare(b.time_start) || a.id - b.id;
};

/** The source-linked incident timeline (GET/POST /api/cases/{id}/events). */
export const IncidentTimeline: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const [category, setCategory] = useState<EventCategory | undefined>(undefined);
  const [certainty, setCertainty] = useState<Certainty | ''>('');
  const [showRejected, setShowRejected] = useState(false);
  const [editing, setEditing] = useState<CaseEvent | null | 'new'>(null);
  const eventsQuery = useEvents(caseId, category);
  const update = useUpdateEvent(caseId);
  const remove = useDeleteEvent(caseId);
  const { open: openEvidence } = useEvidenceInspector();

  // The stage picked in the Reconstruction module highlights its events here.
  const { reconstructionId, stageId, setStage } = useStageStore();
  const { data: reconstruction } = useReconstruction(reconstructionId);
  const stage = reconstruction?.case_id === caseId ? reconstruction.stages.find((s) => s.id === stageId) : undefined;
  const stageEvents = new Set(stage?.event_ids ?? []);

  const counts = workspace.events.reduce<Record<string, number>>((acc, e) => {
    if (e.review_status !== 'rejected') acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.keys(counts) as EventCategory[];
  const location = (id: number | null) => workspace.locations.find((l) => l.id === id)?.address;

  const events = (eventsQuery.data ?? [])
    .filter((e) => showRejected || e.review_status !== 'rejected')
    .filter((e) => !certainty || e.certainty === certainty)
    .sort(byTime);
  const rejectedCount = workspace.events.filter((e) => e.review_status === 'rejected').length;

  let lastDay = '';

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Incident Timeline
          </h2>
          <p className="text-xs text-slate-400">
            Events in order, each at the precision and certainty the evidence supports, with the passages it rests on.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className={primaryButtonClass}>
          <Plus className="w-3.5 h-3.5" /> Add event
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800" role="group" aria-label="Category">
          <button
            onClick={() => setCategory(undefined)}
            className={`px-3 py-1 rounded-lg whitespace-nowrap ${!category ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap ${category === c ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {humanize(c)} ({counts[c]})
            </button>
          ))}
        </div>
        <select
          value={certainty}
          onChange={(e) => setCertainty(e.target.value as Certainty | '')}
          aria-label="Certainty"
          className="py-1.5 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">Any certainty</option>
          {CERTAINTIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </select>
        {rejectedCount > 0 && (
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="accent-cyan-500" />
            Show {rejectedCount} rejected
          </label>
        )}
      </div>

      {stage && reconstruction && (
        <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-300" />
          Highlighting the {stage.event_ids.length} events of stage <strong>{stage.label}</strong> in "{reconstruction.scenario}".
          <button onClick={() => setStage(null)} className="ml-auto p-1 rounded hover:bg-purple-500/20" aria-label="Stop highlighting">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {eventsQuery.isPending && <LoadingState label="Loading events…" />}
      {eventsQuery.isError && <ErrorState error={eventsQuery.error} onRetry={() => eventsQuery.refetch()} />}
      {eventsQuery.data && events.length === 0 && (
        <EmptyState title="No events" message={category || certainty ? 'Nothing matches these filters.' : 'Add the first event, or let processing propose them.'} />
      )}

      <ol className="relative pl-8 space-y-3 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-blue-500 before:to-slate-800">
        {events.map((event) => {
          const day = event.time_start ? formatDate(event.time_start) : 'Time unknown';
          const showDay = day !== lastDay;
          lastDay = day;
          const highlighted = stageEvents.has(event.id);
          return (
            <React.Fragment key={event.id}>
              {showDay && <li className="text-[10px] text-slate-500 uppercase font-bold -ml-8 pl-8 pt-1">{day}</li>}
              <li className="relative" data-testid={`event-${event.id}`} data-highlighted={highlighted || undefined}>
                <span
                  className={`absolute -left-[26px] top-4 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${CATEGORY_COLOURS[event.category] ?? 'bg-slate-500'}`}
                  aria-hidden
                />
                <div
                  className={`p-4 rounded-2xl border space-y-2 transition-colors ${
                    highlighted ? 'bg-purple-950/30 border-purple-400/60' : 'bg-slate-900/80 border-slate-800'
                  } ${event.review_status === 'rejected' ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-cyan-300 font-bold">{formatTimeRange(event.time_start, event.time_end, event.time_precision)}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{humanize(event.category)}</span>
                      <CertaintyBadge certainty={event.certainty} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing(event)} className="p-1 rounded text-slate-500 hover:text-cyan-300" aria-label="Edit event">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <DeleteButton
                        label="event"
                        busy={remove.isPending && remove.variables === event.id}
                        onDelete={() => remove.mutate(event.id)}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-100">{event.description}</p>
                  {event.location_id && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {location(event.location_id)}
                    </p>
                  )}
                  {event.ai_note && (
                    <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-[11px] text-cyan-100">
                      <strong className="text-cyan-300">AI note:</strong> {event.ai_note}
                    </div>
                  )}
                  <SourcePassages
                    links={workspace.links}
                    evidence={workspace.evidence}
                    targetType="event"
                    targetId={event.id}
                    onOpenEvidence={openEvidence}
                  />
                  <ReviewActions
                    origin={event.origin}
                    status={event.review_status}
                    busy={update.isPending && update.variables?.id === event.id}
                    onChange={(review_status) => update.mutate({ id: event.id, input: { review_status } })}
                  />
                </div>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {editing !== null && (
        <EventDialog
          key={editing === 'new' ? 'new' : editing.id}
          workspace={workspace}
          event={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
