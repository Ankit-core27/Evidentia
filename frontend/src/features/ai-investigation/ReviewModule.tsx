import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Pencil, RotateCcw } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useUpdateRelationship } from '@/hooks/useGraph';
import { useUpdateInjury } from '@/hooks/useInjuries';
import { useUpdateLocation, useUpdateObject, useUpdatePerson } from '@/hooks/usePeople';
import { useConflicts, useObservations, useUpdateConflict, useUpdateObservation } from '@/hooks/useReview';
import { useUpdateEvent } from '@/hooks/useTimeline';
import { formatDateTime, formatTimeRange, humanize } from '@/lib/format';
import { recordLabel } from '@/lib/recordNames';
import { CaseWorkspace, Conflict, Id, Observation, Origin, RecordType, ReviewStatus } from '@/types/api';

type Tab = 'pending' | 'conflicts' | 'reviewed';

interface ReviewItem {
  key: string;
  type: RecordType;
  id: Id;
  title: string;
  detail?: string;
  origin: Origin;
  status: ReviewStatus;
}

const SECTIONS: { type: RecordType; label: string }[] = [
  { type: 'observation', label: 'Statements' },
  { type: 'person', label: 'People' },
  { type: 'object', label: 'Vehicles & objects' },
  { type: 'location', label: 'Locations' },
  { type: 'event', label: 'Timeline events' },
  { type: 'relationship', label: 'Links' },
  { type: 'injury', label: 'Injuries' }
];

/**
 * The AI review queue. Everything the AI proposes stays pending until an investigator
 * confirms or rejects it (docs/PLAN.md); conflicting statements are resolved here too.
 */
export const ReviewModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const observationsQuery = useObservations(caseId);
  const conflictsQuery = useConflicts(caseId);
  const [tab, setTab] = useState<Tab>('pending');
  const { open: openEvidence } = useEvidenceInspector();

  const updates: Record<string, { mutate: (v: { id: Id; input: { review_status: ReviewStatus } }) => void; isPending: boolean; variables?: { id: Id } }> = {
    observation: useUpdateObservation(caseId),
    person: useUpdatePerson(caseId),
    object: useUpdateObject(caseId),
    location: useUpdateLocation(caseId),
    event: useUpdateEvent(caseId),
    relationship: useUpdateRelationship(caseId),
    injury: useUpdateInjury(caseId)
  };
  const updateConflict = useUpdateConflict(caseId);

  if (observationsQuery.isPending || conflictsQuery.isPending) return <LoadingState label="Loading the review queue…" />;
  if (observationsQuery.isError) return <ErrorState error={observationsQuery.error} onRetry={() => observationsQuery.refetch()} />;
  if (conflictsQuery.isError) return <ErrorState error={conflictsQuery.error} onRetry={() => conflictsQuery.refetch()} />;

  const observations = observationsQuery.data;
  const conflicts = conflictsQuery.data;
  const conflictOf = (observationId: Id) => conflicts.find((c) => c.status === 'open' && c.observation_ids.includes(observationId));

  const items: ReviewItem[] = [
    ...observations.map((o) => ({
      key: `observation:${o.id}`,
      type: 'observation' as const,
      id: o.id,
      title: o.statement,
      detail: `About ${recordLabel(workspace, o.subject_type, o.subject_id, observations)}${o.observed_at ? ` • ${formatDateTime(o.observed_at)}` : ''}`,
      origin: o.origin,
      status: o.review_status
    })),
    ...workspace.persons.map((p) => ({
      key: `person:${p.id}`,
      type: 'person' as const,
      id: p.id,
      title: p.name,
      detail: [humanize(p.role), p.condition && humanize(p.condition), p.notes].filter(Boolean).join(' • '),
      origin: p.origin,
      status: p.review_status
    })),
    ...workspace.objects.map((o) => ({
      key: `object:${o.id}`,
      type: 'object' as const,
      id: o.id,
      title: o.label,
      detail: [humanize(o.kind), o.details.plate, o.details.number, o.details.make, o.details.colour].filter(Boolean).join(' • '),
      origin: o.origin,
      status: o.review_status
    })),
    ...workspace.locations.map((l) => ({
      key: `location:${l.id}`,
      type: 'location' as const,
      id: l.id,
      title: l.address,
      detail: humanize(l.kind),
      origin: l.origin,
      status: l.review_status
    })),
    ...workspace.events.map((e) => ({
      key: `event:${e.id}`,
      type: 'event' as const,
      id: e.id,
      title: e.description,
      detail: [formatTimeRange(e.time_start, e.time_end, e.time_precision), humanize(e.certainty), e.ai_note].filter(Boolean).join(' • '),
      origin: e.origin,
      status: e.review_status
    })),
    ...workspace.relationships.map((r) => ({
      key: `relationship:${r.id}`,
      type: 'relationship' as const,
      id: r.id,
      title: recordLabel(workspace, 'relationship', r.id),
      detail: [humanize(r.kind), r.confidence !== null && `confidence ${Math.round(r.confidence * 100)}%`, r.flagged && 'flagged', r.notes]
        .filter(Boolean)
        .join(' • '),
      origin: r.origin,
      status: r.review_status
    })),
    ...workspace.injuries.map((i) => ({
      key: `injury:${i.id}`,
      type: 'injury' as const,
      id: i.id,
      title: recordLabel(workspace, 'injury', i.id),
      detail: [humanize(i.severity), i.description].filter(Boolean).join(' • '),
      origin: i.origin,
      status: i.review_status
    }))
  ].filter((item) => item.origin === 'ai');

  const pending = items.filter((i) => i.status === 'pending');
  const reviewed = items.filter((i) => i.status !== 'pending');
  const openConflicts = conflicts.filter((c) => c.status === 'open');

  const review = (item: Pick<ReviewItem, 'type' | 'id'>, status: ReviewStatus) =>
    updates[item.type].mutate({ id: item.id, input: { review_status: status } });
  const busy = (item: Pick<ReviewItem, 'type' | 'id'>) =>
    updates[item.type].isPending && updates[item.type].variables?.id === item.id;
  const mutationError = Object.values(updates).find((u) => (u as unknown as { isError: boolean }).isError) as unknown as
    | { error: unknown }
    | undefined;

  const renderItem = (item: ReviewItem) => {
    const conflict = item.type === 'observation' ? conflictOf(item.id) : undefined;
    return (
      <div key={item.key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2" data-testid={`review-${item.key}`}>
        {item.type === 'observation' ? (
          <ObservationText observation={observations.find((o) => o.id === item.id)!} caseId={caseId} />
        ) : (
          <div className="text-slate-100 font-bold">{item.title}</div>
        )}
        {item.detail && <div className="text-[11px] text-slate-400">{item.detail}</div>}
        {conflict && (
          <button
            onClick={() => setTab('conflicts')}
            className="text-[10px] text-amber-300 flex items-center gap-1 hover:underline"
          >
            <AlertTriangle className="w-3 h-3" /> Part of an open conflict
          </button>
        )}
        <SourcePassages
          links={workspace.links}
          evidence={workspace.evidence}
          targetType={item.type}
          targetId={item.id}
          onOpenEvidence={openEvidence}
        />
        <ReviewActions origin={item.origin} status={item.status} busy={busy(item)} onChange={(s) => review(item, s)} />
      </div>
    );
  };

  const grouped = (list: ReviewItem[]) =>
    SECTIONS.map((section) => ({ ...section, items: list.filter((i) => i.type === section.type) }))
      .filter((section) => section.items.length)
      .map((section) => (
        <section key={section.type} className="space-y-2" aria-label={section.label}>
          <h3 className="text-[11px] font-bold text-slate-300 uppercase">
            {section.label} ({section.items.length})
          </h3>
          {section.items.map(renderItem)}
        </section>
      ));

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-cyan-400" />
            AI Review
          </h2>
          <p className="text-xs text-slate-400">
            What the AI proposed from the evidence. Nothing here counts as a finding until an investigator confirms it.
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs" role="tablist">
          {(
            [
              ['pending', `Pending (${pending.length})`],
              ['conflicts', `Conflicts (${openConflicts.length} open)`],
              ['reviewed', `Reviewed (${reviewed.length})`]
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap ${
                tab === id ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mutationError && <ErrorState error={mutationError.error} />}

      {tab === 'pending' &&
        (pending.length ? (
          <div className="space-y-5">{grouped(pending)}</div>
        ) : (
          <EmptyState title="Nothing waiting for review" message="New proposals appear here when uploaded evidence finishes processing." />
        ))}

      {tab === 'reviewed' &&
        (reviewed.length ? (
          <div className="space-y-5">{grouped(reviewed)}</div>
        ) : (
          <EmptyState title="No AI proposals reviewed yet" />
        ))}

      {tab === 'conflicts' &&
        (conflicts.length ? (
          <div className="space-y-4">
            {[...openConflicts, ...conflicts.filter((c) => c.status === 'resolved')].map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                busy={updateConflict.isPending && updateConflict.variables?.id === conflict.id}
                onToggle={() =>
                  updateConflict.mutate({ id: conflict.id, input: { status: conflict.status === 'open' ? 'resolved' : 'open' } })
                }
              >
                {conflict.observation_ids
                  .map((id) => items.find((i) => i.key === `observation:${id}`))
                  .filter((i): i is ReviewItem => !!i)
                  .map(renderItem)}
              </ConflictCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No conflicting statements" message="The AI flags statements about the same subject, place or time that disagree." />
        ))}
    </div>
  );
};

// ---------------------------------------------------------------------------

const ConflictCard: React.FC<{ conflict: Conflict; busy: boolean; onToggle: () => void; children: React.ReactNode }> = ({
  conflict,
  busy,
  onToggle,
  children
}) => {
  const open = conflict.status === 'open';
  return (
    <section
      className={`p-4 rounded-2xl border space-y-3 ${open ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-900/60 border-slate-800 opacity-75'}`}
      data-testid={`conflict-${conflict.id}`}
      aria-label={`Conflict ${conflict.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-xs">
          {open ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <div>
            <div className="font-bold text-slate-100">{conflict.description}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{open ? 'Open' : 'Resolved'}</div>
          </div>
        </div>
        <button onClick={onToggle} disabled={busy} className={open ? primaryButtonClass : secondaryButtonClass}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : open ? <CheckCircle2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
          {open ? 'Mark resolved' : 'Reopen'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>
    </section>
  );
};

/** An observation's statement, editable in place (PATCH /api/observations/{id}). */
const ObservationText: React.FC<{ observation: Observation; caseId: Id }> = ({ observation, caseId }) => {
  const update = useUpdateObservation(caseId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(observation.statement);

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <p className="text-slate-100 font-bold leading-relaxed">{observation.statement}</p>
        <button
          onClick={() => {
            setText(observation.statement);
            setEditing(true);
          }}
          className="p-1 rounded text-slate-500 hover:text-cyan-300 shrink-0"
          aria-label="Edit statement"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        update.mutate({ id: observation.id, input: { statement: text.trim() } }, { onSuccess: () => setEditing(false) });
      }}
    >
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} resize-none`} aria-label="Statement" autoFocus />
      <div className="flex gap-2">
        <button type="submit" disabled={update.isPending || !text.trim()} className={primaryButtonClass}>
          {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
      {update.isError && <p className="text-[11px] text-red-300">{(update.error as Error).message}</p>}
    </form>
  );
};
