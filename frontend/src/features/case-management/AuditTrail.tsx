import React, { useState } from 'react';
import { History } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
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

  const filterButton = (value: AuditAction | null, label: string, n: number) => (
    <button
      key={label}
      onClick={() => {
        setAction(value);
        setLimit(PAGE);
      }}
      aria-pressed={action === value}
      className={`px-2.5 py-1 rounded-lg border text-[11px] ${
        action === value ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label} ({n})
    </button>
  );

  return (
    <section className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4 text-xs" aria-label="Audit trail">
      <div>
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          Audit trail
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">Who uploaded, viewed, changed, reviewed or exported each record of this case, and when.</p>
      </div>

      {audit.isPending && <LoadingState label="Loading audit trail…" />}
      {audit.isError && <ErrorState error={audit.error} onRetry={() => audit.refetch()} />}

      {audit.data && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by action">
            {filterButton(null, 'All', entries.length)}
            {ACTIONS.map((a) => filterButton(a, humanize(a), count(a)))}
          </div>

          {shown.length === 0 ? (
            <EmptyState title="No audit entries" message={action ? `Nothing was ${action} yet.` : undefined} />
          ) : (
            <ol className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden" data-testid="audit-entries">
              {shown.slice(0, limit).map((entry) => {
                const label = recordLabel(workspace, entry.record_type, entry.record_id, observations.data);
                const detail = describeAuditDetail(entry);
                return (
                  <li key={entry.id} className="p-3 bg-slate-950/60 grid grid-cols-[9rem_1fr] gap-3">
                    <div className="text-[10px] text-slate-500 space-y-1">
                      <div>{formatDateTime(entry.at)}</div>
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${AUDIT_ACTION_STYLES[entry.action]}`}>
                        {entry.action}
                      </span>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-slate-200">
                        <span className="font-bold">{entry.actor_name ?? 'Unknown investigator'}</span>
                        <span className="text-slate-500"> · {humanize(entry.record_type)} </span>
                        {entry.record_type === 'evidence' ? (
                          <button onClick={() => openEvidence(entry.record_id)} className="text-cyan-300 hover:underline text-left">
                            {label}
                          </button>
                        ) : (
                          <span className="text-slate-300">{label}</span>
                        )}
                      </div>
                      {detail && <div className="text-[11px] text-slate-400 break-words">{detail}</div>}
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
