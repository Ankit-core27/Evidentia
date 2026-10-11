import React, { useState } from 'react';
import { SectionHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { FilterChips } from '@/components/shared/Segmented';
import { smallButtonClass } from '@/components/shared/formStyles';
import { useAudit } from '@/hooks/useReports';
import { useObservations } from '@/hooks/useReview';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { AUDIT_ACTION_STYLES, describeAuditDetail } from '@/lib/audit';
import { formatDateTime, humanize } from '@/lib/format';
import { recordLabel } from '@/lib/recordNames';
import { AuditAction, CaseWorkspace } from '@/types/api';

const ACTIONS: AuditAction[] = ['uploaded', 'viewed', 'modified', 'reviewed', 'exported'];
const PAGE = 50;

/** Every audited action on this case's records (GET /api/cases/{id}/audit), newest first. */
export const AuditTrail: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const audit = useAudit(caseId);
  const observations = useObservations(caseId);
  const { open: openEvidence } = useEvidenceInspector();
  const [action, setAction] = useState<AuditAction | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const entries = audit.data ?? [];
  const shown = action ? entries.filter((e) => e.action === action) : entries;
  const count = (a: AuditAction) => entries.filter((e) => e.action === a).length;

  return (
    <section className="space-y-3" aria-label="Audit trail">
      <div>
        <SectionHeader title="Audit trail" as="h3" />
        <p className="text-body text-ink-muted">Who uploaded, viewed, changed, reviewed or exported each record of this case, and when.</p>
      </div>

      {audit.isPending && <LoadingState label="Loading audit trail…" />}
      {audit.isError && <ErrorState error={audit.error} onRetry={() => audit.refetch()} />}

      {audit.data && (
        <>
          <FilterChips
            label="Filter by action"
            value={action ?? 'all'}
            onChange={(v) => {
              setAction(v === 'all' ? null : v);
              setLimit(PAGE);
            }}
            options={[{ value: 'all', label: 'All', count: entries.length }, ...ACTIONS.map((a) => ({ value: a, label: humanize(a), count: count(a) }))]}
            className="flex-wrap"
          />

          {shown.length === 0 ? (
            <EmptyState title="No audit entries" message={action ? `Nothing was ${action} yet.` : undefined} />
          ) : (
            <ol className="rounded-md border border-line bg-surface divide-y divide-line" data-testid="audit-entries">
              {shown.slice(0, limit).map((entry) => {
                const label = recordLabel(workspace, entry.record_type, entry.record_id, observations.data);
                const detail = describeAuditDetail(entry);
                return (
                  <li key={entry.id} className="px-3 py-2.5 grid grid-cols-[5.5rem_1fr] sm:grid-cols-[10rem_5.5rem_1fr] gap-x-3 gap-y-0.5">
                    <span className="font-mono text-2xs text-ink-muted pt-0.5 col-span-2 sm:col-span-1">{formatDateTime(entry.at)}</span>
                    <span className={`font-mono text-xs ${AUDIT_ACTION_STYLES[entry.action]}`}>{entry.action}</span>
                    <div className="min-w-0 text-body">
                      <div className="text-ink">
                        <span className="font-medium">{entry.actor_name ?? 'Unknown investigator'}</span>
                        <span className="text-ink-muted"> · {humanize(entry.record_type)} </span>
                        {entry.record_type === 'evidence' ? (
                          <button onClick={() => openEvidence(entry.record_id)} className="text-accent-text hover:underline text-left">
                            {label}
                          </button>
                        ) : (
                          <span className="text-ink-soft">{label}</span>
                        )}
                      </div>
                      {detail && <div className="text-xs text-ink-muted break-words">{detail}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {shown.length > limit && (
            <button onClick={() => setLimit(limit + PAGE)} className={smallButtonClass}>
              Show {Math.min(PAGE, shown.length - limit)} more of {shown.length - limit}
            </button>
          )}
        </>
      )}
    </section>
  );
};
