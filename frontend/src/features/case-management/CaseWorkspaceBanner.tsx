import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Brain, Loader2, Pencil } from 'lucide-react';
import { PriorityBadge } from '@/components/shared/Badges';
import { useInvestigators, useUpdateCase } from '@/hooks/useCases';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { CASE_STATUSES } from '@/lib/options';
import { casePath } from '@/lib/caseModules';
import { CaseStatus, CaseWorkspace } from '@/types/api';
import { EditCaseDialog } from './EditCaseDialog';

/** Case number, status, priority and progress, at the top of every workspace module. */
export const CaseWorkspaceBanner: React.FC<{ workspace: CaseWorkspace; compact?: boolean }> = ({ workspace, compact = false }) => {
  const { case: c, counts, locations } = workspace;
  const updateCase = useUpdateCase(c.id);
  const [editing, setEditing] = useState(false);
  const { data: investigators } = useInvestigators();
  const lead = investigators?.find((i) => i.id === c.lead_investigator_id);
  const site = locations.find((l) => l.kind === 'incident_site');
  // Progress is reviewed AI items over all AI items; there is nothing to show before the AI has proposed anything.
  const progress = counts.ai_items_total ? Math.round((counts.ai_items_reviewed / counts.ai_items_total) * 100) : null;

  return (
    <div className={`bg-slate-900/90 border border-slate-800 ${compact ? 'px-3 py-2 rounded-lg' : 'p-5 rounded-2xl'} flex flex-col lg:flex-row items-start lg:items-center justify-between ${compact ? 'gap-2' : 'gap-4'} backdrop-blur-md`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-cyan-400 rounded bg-cyan-500/10 border border-cyan-500/30 ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'}`}>
            {c.case_number}
          </span>

          <select
            value={c.status}
            onChange={(e) => updateCase.mutate({ status: e.target.value as CaseStatus })}
            disabled={updateCase.isPending}
            aria-label="Case status"
            className={`bg-slate-950 border border-slate-800 rounded-lg font-bold text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-60 ${compact ? 'py-0.5 px-2 text-[10px]' : 'py-1 px-3 text-xs rounded-xl'}`}
          >
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          {updateCase.isPending && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}

          <PriorityBadge priority={c.priority} />
          <span className={`text-slate-400 rounded bg-slate-950 border border-slate-800 ${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}>
            {humanize(c.incident_type)}
          </span>
          <button
            onClick={() => setEditing(true)}
            className={`rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 flex items-center gap-1 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
          >
            <Pencil className="w-3 h-3" /> Edit case
          </button>
        </div>

        <h1 className={`font-bold text-slate-100 ${compact ? 'truncate text-sm mt-1' : 'text-xl mt-2'}`}>{c.title}</h1>

        {compact ? (
          <details className="mt-1 text-[10px] text-slate-400">
            <summary className="w-fit cursor-pointer hover:text-slate-200">Case details</summary>
            <p className="mt-1">
              {[
                c.incident_at && `Incident: ${formatDateTime(c.incident_at)}`,
                site && `Location: ${site.address}`,
                `Lead: ${lead?.name ?? 'not assigned'}`,
                `Opened ${formatDate(c.created_at)}`
              ]
                .filter(Boolean)
                .join(' • ')}
            </p>
          </details>
        ) : (
          <p className="text-xs text-slate-400 mt-1">
            {[
              c.incident_at && `Incident: ${formatDateTime(c.incident_at)}`,
              site && `Location: ${site.address}`,
              `Lead: ${lead?.name ?? 'not assigned'}`,
              `Opened ${formatDate(c.created_at)}`
            ]
              .filter(Boolean)
              .join(' • ')}
          </p>
        )}
        {updateCase.isError && (
          <p className="text-[11px] text-red-300 mt-1" role="alert">
            Status not saved: {(updateCase.error as Error).message}
          </p>
        )}
      </div>

      <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-3'} shrink-0 font-mono`}>
        {progress !== null && (
          <div className={`${compact ? 'w-32 px-2 py-1 rounded-lg' : 'p-3 rounded-xl'} bg-slate-950 border border-slate-800 ${compact ? '' : 'space-y-1'}`}>
            <div className={`flex items-center justify-between text-[10px] text-slate-400 font-bold ${compact ? 'gap-2' : 'gap-4'}`}>
              <span>AI ITEMS REVIEWED</span>
              <span className="text-cyan-400">
                {counts.ai_items_reviewed}/{counts.ai_items_total}
              </span>
            </div>
            <div className={`${compact ? 'w-full mt-1' : 'w-40'} h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800`}>
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {counts.pending_reviews > 0 && (
          <Link
            to={casePath(c.id, 'review')}
            aria-label={`${counts.pending_reviews} items to review`}
            className={`${compact ? 'px-2 py-1 rounded-lg' : 'p-3 rounded-xl'} bg-purple-950/40 border border-purple-500/30 text-purple-200 flex items-center gap-1.5 hover:border-purple-400/60`}
          >
            <Brain className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-purple-300`} />
            <span className={compact ? 'text-[10px]' : 'text-xs'}>
              <strong>{counts.pending_reviews}</strong> {compact ? 'review' : 'to review'}
            </span>
          </Link>
        )}

        {counts.open_conflicts > 0 && (
          <Link
            to={casePath(c.id, 'review')}
            aria-label={`${counts.open_conflicts} open conflicts`}
            className={`${compact ? 'px-2 py-1 rounded-lg' : 'p-3 rounded-xl'} bg-amber-950/40 border border-amber-500/30 text-amber-200 flex items-center gap-1.5 hover:border-amber-400/60`}
          >
            <AlertTriangle className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-300`} />
            <span className={compact ? 'text-[10px]' : 'text-xs'}>
              <strong>{counts.open_conflicts}</strong> {compact ? 'conflicts' : `open conflict${counts.open_conflicts === 1 ? '' : 's'}`}
            </span>
          </Link>
        )}
      </div>

      {editing && <EditCaseDialog caseRecord={c} onClose={() => setEditing(false)} />}
    </div>
  );
};
