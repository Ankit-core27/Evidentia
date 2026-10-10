import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import { PriorityBadge } from '@/components/shared/Badges';
import { inlineSelectClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useInvestigators, useUpdateCase } from '@/hooks/useCases';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { CASE_STATUSES } from '@/lib/options';
import { casePath } from '@/lib/caseModules';
import { CaseStatus, CaseWorkspace } from '@/types/api';
import { EditCaseDialog } from './EditCaseDialog';

/** Case number, status, priority and review progress, at the top of every workspace module. */
export const CaseWorkspaceBanner: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const { case: c, counts, locations } = workspace;
  const updateCase = useUpdateCase(c.id);
  const [editing, setEditing] = useState(false);
  const { data: investigators } = useInvestigators();
  const lead = investigators?.find((i) => i.id === c.lead_investigator_id);
  const site = locations.find((l) => l.kind === 'incident_site');
  // Progress is reviewed AI items over all AI items; there is nothing to show before the AI has proposed anything.
  const progress = counts.ai_items_total ? Math.round((counts.ai_items_reviewed / counts.ai_items_total) * 100) : null;

  const facts: [string, string][] = [
    ...(c.incident_at ? [['Incident', formatDateTime(c.incident_at)] as [string, string]] : []),
    ...(site ? [['Location', site.address] as [string, string]] : []),
    ['Lead', lead?.name ?? 'Not assigned'],
    ['Opened', formatDate(c.created_at)]
  ];

  return (
    <header className="pb-5 border-b border-line space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-muted">
            <span className="font-mono text-ink-soft">{c.case_number}</span>
            <span aria-hidden>·</span>
            <span>{humanize(c.incident_type)}</span>
            <PriorityBadge priority={c.priority} />
          </div>
          <h1 className="text-xl font-semibold text-ink tracking-tight text-pretty">{c.title}</h1>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {facts.map(([label, value]) => (
              <div key={label} className="flex gap-1.5 min-w-0">
                <dt className="text-ink-muted shrink-0">{label}</dt>
                <dd className="text-ink-soft tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {updateCase.isError && (
            <p className="text-xs text-danger" role="alert">
              Status not saved: {(updateCase.error as Error).message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="sr-only" htmlFor="case-status">
            Case status
          </label>
          <div className="relative">
            <select
              id="case-status"
              value={c.status}
              onChange={(e) => updateCase.mutate({ status: e.target.value as CaseStatus })}
              disabled={updateCase.isPending}
              className={`${inlineSelectClass} h-8 py-0 font-medium`}
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
            {updateCase.isPending && (
              <Loader2 className="size-3.5 text-accent-text animate-spin absolute -left-5 top-1/2 -translate-y-1/2" aria-label="Saving status" />
            )}
          </div>
          <button onClick={() => setEditing(true)} className={secondaryButtonClass}>
            <Pencil className="size-3.5" aria-hidden /> Edit case
          </button>
        </div>
      </div>

      {progress !== null && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-ink-muted">AI proposals reviewed</span>
            <div
              className="w-28 h-1.5 rounded-full bg-raised overflow-hidden"
              role="progressbar"
              aria-label="AI proposals reviewed"
              aria-valuemin={0}
              aria-valuemax={counts.ai_items_total}
              aria-valuenow={counts.ai_items_reviewed}
            >
              <div className="h-full bg-ok rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-mono text-ink-soft">
              {counts.ai_items_reviewed}/{counts.ai_items_total}
            </span>
          </div>
          {counts.pending_reviews > 0 && (
            <Link to={casePath(c.id, 'review')} className="text-pending hover:underline underline-offset-2">
              {counts.pending_reviews} waiting for review
            </Link>
          )}
          {counts.open_conflicts > 0 && (
            <Link to={`${casePath(c.id, 'review')}?view=conflicts`} className="text-warn hover:underline underline-offset-2">
              {counts.open_conflicts} open conflict{counts.open_conflicts === 1 ? '' : 's'} between statements
            </Link>
          )}
        </div>
      )}

      {editing && <EditCaseDialog caseRecord={c} onClose={() => setEditing(false)} />}
    </header>
  );
};
