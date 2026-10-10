import React, { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { CertaintyBadge } from '@/components/shared/Badges';
import { DeleteButton } from '@/components/shared/DeleteButton';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { FilterChips } from '@/components/shared/Segmented';
import { iconButtonClass, inlineSelectClass, primaryButtonClass } from '@/components/shared/formStyles';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useReconstruction } from '@/hooks/useReconstruction';
import { useDeleteEvent, useEvents, useUpdateEvent } from '@/hooks/useTimeline';
import { formatDate, formatTimeRange, humanize } from '@/lib/format';
import { CERTAINTIES } from '@/lib/options';
import { useStageStore } from '@/stores/stage';
import { CaseEvent, CaseWorkspace, Certainty, EventCategory } from '@/types/api';
import { EventDialog } from './EventDialog';


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

  /** The marker on the rail: the impact stands out, AI proposals keep their dashed edge, the stage's events take the accent. */
  const marker = (event: CaseEvent, highlighted: boolean) => {
    if (highlighted) return 'bg-accent border-accent';
    if (event.review_status === 'pending') return 'bg-canvas border-pending border-dashed';
    if (event.category === 'collision') return 'bg-danger border-danger';
    return 'bg-canvas border-ink-muted';
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title="Incident timeline"
        description="Events in order, each at the precision and certainty the evidence supports, with the passages it rests on."
        actions={
          <button onClick={() => setEditing('new')} className={primaryButtonClass}>
            <Plus className="size-4" aria-hidden /> Add event
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          label="Category"
          value={category ?? 'all'}
          onChange={(v) => setCategory(v === 'all' ? undefined : v)}
          options={[
            { value: 'all', label: 'All' },
            ...categories.map((c) => ({ value: c, label: humanize(c), count: counts[c] }))
          ]}
        />
        <select
          value={certainty}
          onChange={(e) => setCertainty(e.target.value as Certainty | '')}
          aria-label="Certainty"
          className={`${inlineSelectClass} h-7 py-0 text-xs`}
        >
          <option value="">Any certainty</option>
          {CERTAINTIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </select>
        {rejectedCount > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer">
            <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
            Show {rejectedCount} rejected
          </label>
        )}
      </div>

      {stage && reconstruction && (
        <div className="pl-3 pr-1.5 py-1.5 rounded-md border border-accent/40 bg-accent/5 text-body text-ink-soft flex items-center gap-2" role="status">
          <span className="size-2 rounded-full bg-accent shrink-0" aria-hidden />
          <span>
            Highlighting the {stage.event_ids.length} events of stage <strong className="font-medium text-ink">{stage.label}</strong> in “
            {reconstruction.scenario}”.
          </span>
          <button onClick={() => setStage(null)} className={`${iconButtonClass} ml-auto`} aria-label="Stop highlighting">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {eventsQuery.isPending && <LoadingState label="Loading events…" />}
      {eventsQuery.isError && <ErrorState error={eventsQuery.error} onRetry={() => eventsQuery.refetch()} />}
      {eventsQuery.data && events.length === 0 && (
        <EmptyState title="No events" message={category || certainty ? 'Nothing matches these filters.' : 'Add the first event, or let processing propose them.'} />
      )}

      {/* Times sit in a gutter left of the rail, like a log; below sm they move above each event. */}
      <ol className="relative">
        <span className="absolute top-2 bottom-2 left-[5px] sm:left-[calc(10rem+5px)] w-px bg-line-strong" aria-hidden />
        {events.map((event) => {
          const day = event.time_start ? formatDate(event.time_start) : 'Time unknown';
          const showDay = day !== lastDay;
          lastDay = day;
          const highlighted = stageEvents.has(event.id);
          const place = event.location_id ? location(event.location_id) : undefined;
          return (
            <React.Fragment key={event.id}>
              {showDay && (
                <li className="relative pl-6 sm:pl-[calc(10rem+1.5rem)] pt-1 pb-3 text-xs font-medium text-ink-muted">
                  {day}
                </li>
              )}
              <li
                className={`relative grid sm:grid-cols-[10rem_1fr] pb-5 ${event.review_status === 'rejected' ? 'opacity-50' : ''}`}
                data-testid={`event-${event.id}`}
                data-highlighted={highlighted || undefined}
              >
                <div className="pl-6 sm:pl-0 sm:pr-5 sm:text-right font-mono text-xs leading-5 text-ink-soft tabular-nums">
                  {formatTimeRange(event.time_start, event.time_end, event.time_precision)}
                </div>
                <span
                  className={`absolute left-0 sm:left-40 top-1 size-[11px] rounded-full border-2 ${marker(event, highlighted)}`}
                  aria-hidden
                />
                <div
                  className={`pl-6 min-w-0 space-y-2 ${highlighted ? 'sm:-my-2 sm:py-2 sm:pr-3 rounded-md bg-accent/5 ring-1 ring-accent/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink leading-5">{event.description}</p>
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs text-ink-muted mt-1">
                        <span>{humanize(event.category)}</span>
                        <CertaintyBadge certainty={event.certainty} />
                        {place && <span>· {place}</span>}
                      </div>
                    </div>
                    <div className="flex items-center shrink-0 -mt-1">
                      <button onClick={() => setEditing(event)} className={iconButtonClass} aria-label="Edit event">
                        <Pencil className="size-3.5" />
                      </button>
                      <DeleteButton
                        label="event"
                        busy={remove.isPending && remove.variables === event.id}
                        onDelete={() => remove.mutate(event.id)}
                      />
                    </div>
                  </div>
                  {event.ai_note && (
                    <p className="pl-3 border-l-2 border-dashed border-pending/60 text-body text-ink-soft">
                      <span className="text-xs font-medium text-pending mr-1.5">AI note</span>
                      {event.ai_note}
                    </p>
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
