import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, RotateCcw } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { PageHeader, SectionHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { Tabs } from '@/components/shared/Segmented';
import { iconButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useUpdateRelationship } from '@/hooks/useGraph';
import { useAnatomyFindings, useReviewAnatomyFinding } from '@/hooks/useAnatomy';
import { useUpdateInjury } from '@/hooks/useInjuries';
import { useUpdateLocation, useUpdateObject, useUpdatePerson } from '@/hooks/usePeople';
import { useConflicts, useObservations, useUpdateConflict, useUpdateObservation } from '@/hooks/useReview';
import { useUpdateEvent } from '@/hooks/useTimeline';
import { formatDateTime, formatTimeRange, humanize } from '@/lib/format';
import { recordLabel } from '@/lib/recordNames';
import { CaseWorkspace, Conflict, Id, Observation, Origin, RecordType, ReviewStatus } from '@/types/api';

type Tab = 'pending' | 'conflicts' | 'reviewed';
const isTab = (value: string | null): value is Tab => value === 'pending' || value === 'conflicts' || value === 'reviewed';

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
  { type: 'injury', label: 'Injuries' },
  { type: 'anatomy_finding', label: 'Anatomical findings' }
];

/**
 * The AI review queue. Everything the AI proposes stays pending until an investigator
 * confirms or rejects it (docs/PLAN.md); conflicting statements are resolved here too.
 */
export const ReviewModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const anatomyQuery = useAnatomyFindings(caseId);
  const observationsQuery = useObservations(caseId);
  const conflictsQuery = useConflicts(caseId);
  // ?view=conflicts opens a tab directly, as the case banner's conflict link does.
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const [tab, setTab] = useState<Tab>(isTab(view) ? view : 'pending');
  useEffect(() => {
    if (isTab(view)) setTab(view);
  }, [view]);
  const { open: openEvidence } = useEvidenceInspector();

  const updates: Record<string, { mutate: (v: { id: Id; input: { review_status: ReviewStatus } }) => void; isPending: boolean; variables?: { id: Id } }> = {
    observation: useUpdateObservation(caseId),
    person: useUpdatePerson(caseId),
    object: useUpdateObject(caseId),
    location: useUpdateLocation(caseId),
    event: useUpdateEvent(caseId),
    relationship: useUpdateRelationship(caseId),
    injury: useUpdateInjury(caseId),
    anatomy_finding: useReviewAnatomyFinding(caseId)
  };
  const updateConflict = useUpdateConflict(caseId);

  if (observationsQuery.isPending || conflictsQuery.isPending || anatomyQuery.isPending) return <LoadingState label="Loading the review queue…" />;
  if (observationsQuery.isError) return <ErrorState error={observationsQuery.error} onRetry={() => observationsQuery.refetch()} />;
  if (conflictsQuery.isError) return <ErrorState error={conflictsQuery.error} onRetry={() => conflictsQuery.refetch()} />;

  if (anatomyQuery.isError) return <ErrorState error={anatomyQuery.error} onRetry={() => anatomyQuery.refetch()} />;

  const observations = observationsQuery.data;
  const conflicts = conflictsQuery.data;
  const conflictOf = (observationId: Id) => conflicts.find((c) => c.status === 'open' && c.observation_ids.includes(observationId));

  const items: ReviewItem[] = [
    ...(anatomyQuery.data ?? []).map(f => ({
      key: `anatomy_finding:${f.id}`, type: 'anatomy_finding' as const, id: f.id,
      title: f.description, detail: `${humanize(f.finding_type)} · ${f.body_region}`,
      origin: f.origin, status: f.review_status
    })),
    ...observations.map((o) => ({
      key: `observation:${o.id}`,
      type: 'observation' as const,
      id: o.id,
      title: o.statement,
      detail: `About ${recordLabel(workspace, o.subject_type, o.subject_id, observations)}${o.observed_at ? ` · ${formatDateTime(o.observed_at)}` : ''}`,
      origin: o.origin,
      status: o.review_status
    })),
    ...workspace.persons.map((p) => ({
      key: `person:${p.id}`,
      type: 'person' as const,
      id: p.id,
      title: p.name,
      detail: [humanize(p.role), p.condition && humanize(p.condition), p.notes].filter(Boolean).join(' · '),
      origin: p.origin,
      status: p.review_status
    })),
    ...workspace.objects.map((o) => ({
      key: `object:${o.id}`,
      type: 'object' as const,
      id: o.id,
      title: o.label,
      detail: [humanize(o.kind), o.details.plate, o.details.number, o.details.make, o.details.colour].filter(Boolean).join(' · '),
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
      detail: [formatTimeRange(e.time_start, e.time_end, e.time_precision), humanize(e.certainty), e.ai_note].filter(Boolean).join(' · '),
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
        .join(' · '),
      origin: r.origin,
      status: r.review_status
    })),
    ...workspace.injuries.map((i) => ({
      key: `injury:${i.id}`,
      type: 'injury' as const,
      id: i.id,
      title: recordLabel(workspace, 'injury', i.id),
      detail: [humanize(i.severity), i.description].filter(Boolean).join(' · '),
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

  const renderItem = (item: ReviewItem, inConflict = false) => {
    const conflict = item.type === 'observation' && !inConflict ? conflictOf(item.id) : undefined;
    return (
      <div key={item.key} className="px-4 py-3 space-y-2" data-testid={`review-${item.key}`}>
        {item.type === 'observation' ? (
          <ObservationText observation={observations.find((o) => o.id === item.id)!} caseId={caseId} />
        ) : (
          <div className="text-body font-medium text-ink">{item.title}</div>
        )}
        {item.detail && <div className="text-xs text-ink-muted -mt-1">{item.detail}</div>}
        {conflict && (
          <button onClick={() => setTab('conflicts')} className="text-xs text-warn hover:underline underline-offset-2">
            Disputed by another statement: see Conflicts
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
          <SectionHeader title={section.label} count={section.items.length} />
          <div className="rounded-md border border-line bg-surface divide-y divide-line">{section.items.map((item) => renderItem(item))}</div>
        </section>
      ));

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title="AI review"
        description="What the AI proposed from the evidence. Nothing here counts as a finding until an investigator confirms it."
      />

      <Tabs
        label="Review queue"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Pending', count: pending.length },
          { value: 'conflicts', label: 'Conflicts', count: openConflicts.length },
          { value: 'reviewed', label: 'Reviewed', count: reviewed.length }
        ]}
      />

      {mutationError && <ErrorState error={mutationError.error} />}

      {tab === 'pending' &&
        (pending.length ? (
          <div className="space-y-6">{grouped(pending)}</div>
        ) : (
          <EmptyState title="Nothing waiting for review" message="New proposals appear here when uploaded evidence finishes processing." />
        ))}

      {tab === 'reviewed' &&
        (reviewed.length ? (
          <div className="space-y-6">{grouped(reviewed)}</div>
        ) : (
          <EmptyState title="No AI proposals reviewed yet" />
        ))}

      {tab === 'conflicts' &&
        (conflicts.length ? (
          <div className="space-y-5">
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
                  .map((item) => renderItem(item, true))}
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

/** Statements that disagree, set side by side so they can be weighed against each other. */
const ConflictCard: React.FC<{ conflict: Conflict; busy: boolean; onToggle: () => void; children: React.ReactNode }> = ({
  conflict,
  busy,
  onToggle,
  children
}) => {
  const open = conflict.status === 'open';
  return (
    <section
      className={`rounded-md border ${open ? 'border-warn/40' : 'border-line opacity-80'}`}
      data-testid={`conflict-${conflict.id}`}
      aria-label={`Conflict ${conflict.id}`}
    >
      <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 py-3 border-b ${open ? 'border-warn/30 bg-warn/5' : 'border-line'}`}>
        <div className="min-w-0">
          <div className={`text-xs font-medium ${open ? 'text-warn' : 'text-ok'}`}>{open ? 'Open conflict' : 'Resolved'}</div>
          <h3 className="text-body font-medium text-ink mt-0.5">{conflict.description}</h3>
        </div>
        <button onClick={onToggle} disabled={busy} className={`${open ? primaryButtonClass : secondaryButtonClass} shrink-0`}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : open ? null : <RotateCcw className="size-3.5" />}
          {open ? 'Mark resolved' : 'Reopen'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">{children}</div>
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
        <p className="text-body font-medium text-ink">{observation.statement}</p>
        <button
          onClick={() => {
            setText(observation.statement);
            setEditing(true);
          }}
          className={`${iconButtonClass} shrink-0 -mt-1 -mr-1.5`}
          aria-label="Edit statement"
        >
          <Pencil className="size-3.5" />
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
          {update.isPending && <Loader2 className="size-3.5 animate-spin" />} Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
      {update.isError && <p className="text-xs text-danger">{(update.error as Error).message}</p>}
    </form>
  );
};
