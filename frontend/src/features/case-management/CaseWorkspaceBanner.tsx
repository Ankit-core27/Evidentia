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
export const CaseWorkspaceBanner: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const { case: c, counts, locations } = workspace;
  const updateCase = useUpdateCase(c.id);
  const [editing, setEditing] = useState(false);
  const { data: investigators } = useInvestigators();
  const lead = investigators?.find((i) => i.id === c.lead_investigator_id);
  const site = locations.find((l) => l.kind === 'incident_site');
  // Progress is reviewed AI items over all AI items; there is nothing to show before the AI has proposed anything.
  const progress = counts.ai_items_total ? Math.round((counts.ai_items_reviewed / counts.ai_items_total) * 100) : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 backdrop-blur-md">
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-cyan-400 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
            {c.case_number}
          </span>

          <select
            value={c.status}
            onChange={(e) => updateCase.mutate({ status: e.target.value as CaseStatus })}
            disabled={updateCase.isPending}
            aria-label="Case status"
            className="py-1 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
          >
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          {updateCase.isPending && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}

          <PriorityBadge priority={c.priority} />
          <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
            {humanize(c.incident_type)}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 text-[11px] flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> Edit case
          </button>
        </div>

        <h1 className="text-xl font-bold text-slate-100 mt-2">{c.title}</h1>

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
        {updateCase.isError && (
          <p className="text-[11px] text-red-300 mt-1" role="alert">
            Status not saved: {(updateCase.error as Error).message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 font-mono">
        {progress !== null && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold gap-4">
              <span>AI ITEMS REVIEWED</span>
              <span className="text-cyan-400">
                {counts.ai_items_reviewed}/{counts.ai_items_total}
              </span>
            </div>
            <div className="w-40 h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
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
            className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 flex items-center gap-2 hover:border-purple-400/60"
          >
            <Brain className="w-4 h-4 text-purple-300" />
            <span className="text-xs">
              <strong>{counts.pending_reviews}</strong> to review
            </span>
          </Link>
        )}

        {counts.open_conflicts > 0 && (
          <Link
            to={casePath(c.id, 'review')}
            className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 flex items-center gap-2 hover:border-amber-400/60"
          >
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span className="text-xs">
              <strong>{counts.open_conflicts}</strong> open conflict{counts.open_conflicts === 1 ? '' : 's'}
            </span>
          </Link>
        )}
      </div>

      {editing && <EditCaseDialog caseRecord={c} onClose={() => setEditing(false)} />}
    </div>
  );
};
