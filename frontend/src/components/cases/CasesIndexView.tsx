import React, { useState } from 'react';
import { FolderSearch, Plus, Filter, Search, Eye, FileText, Flame } from 'lucide-react';
import { CaseStatusBadge, PriorityBadge } from '@/components/shared/Badges';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { useCases, useInvestigators } from '@/hooks/useCases';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate, humanize } from '@/lib/format';
import { CASE_PRIORITIES, CASE_STATUSES } from '@/lib/options';
import { CasePriority, CaseStatus, Id } from '@/types/api';

interface CasesIndexViewProps {
  onSelectCase: (caseId: Id) => void;
  onOpenCreateModal: () => void;
  onNavigateToReports: (caseId: Id) => void;
}

export const CasesIndexView: React.FC<CasesIndexViewProps> = ({
  onSelectCase,
  onOpenCreateModal,
  onNavigateToReports
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<CasePriority | ''>('');
  const q = useDebouncedValue(searchQuery.trim());

  const casesQuery = useCases({ q: q || undefined, status: statusFilter || undefined, priority: priorityFilter || undefined });
  const { data: investigators } = useInvestigators();
  const investigatorById = (id: Id | null) => investigators?.find((i) => i.id === id);
  const filtersActive = Boolean(q || statusFilter || priorityFilter);

  return (
    <div className="p-6 space-y-6">
      {/* Top Header & New Case Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-cyan-400" />
            CASES DIRECTORY
          </h1>
          <p className="text-xs text-slate-400 mt-1">Every case, with its status, lead and evidence.</p>
        </div>

        <button
          onClick={onOpenCreateModal}
          id="cases-create-case-btn"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
          <span>CREATE NEW CASE</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case number, title, person, place or lead…"
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            id="case-search-input"
            aria-label="Search cases"
          />
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
            className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            id="status-filter-select"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as CasePriority | '')}
            className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            id="priority-filter-select"
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            {CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1 flex items-center justify-end font-mono text-[11px] text-slate-500">
          {casesQuery.data ? `${casesQuery.data.length} case${casesQuery.data.length === 1 ? '' : 's'}` : ''}
        </div>
      </div>

      {casesQuery.isPending && <LoadingState label="Loading cases…" />}
      {casesQuery.isError && <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} />}
      {casesQuery.data?.length === 0 && (
        <EmptyState
          title={filtersActive ? 'No cases match these filters' : 'No cases yet'}
          message={filtersActive ? 'Change the search or filters.' : 'Create the first case to start an investigation.'}
        />
      )}

      {/* Cases Data Table */}
      {!!casesQuery.data?.length && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Case</th>
                  <th className="py-3.5 px-4 font-semibold">Title & Incident</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Priority</th>
                  <th className="py-3.5 px-4 font-semibold">Lead Investigator</th>
                  <th className="py-3.5 px-4 font-semibold">Created</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Evidence</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {casesQuery.data.map((c) => {
                  const lead = investigatorById(c.lead_investigator_id);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => onSelectCase(c.id)}
                    >
                      <td className="py-4 px-4 font-mono font-bold text-cyan-400 whitespace-nowrap">{c.case_number}</td>

                      <td className="py-4 px-4 max-w-xs">
                        <span className="font-bold text-slate-200 block group-hover:text-cyan-300 transition-colors">
                          {c.title}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5 truncate">
                          {humanize(c.incident_type)}
                          {c.incident_at ? ` • ${formatDate(c.incident_at)}` : ''}
                        </span>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <CaseStatusBadge status={c.status} />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <PriorityBadge priority={c.priority} />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {lead ? (
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar name={lead.name} size="sm" />
                            <div>
                              <span className="text-xs text-slate-200 block font-medium">{lead.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono block">{lead.badge_number}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Not assigned</span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono text-slate-400 whitespace-nowrap">{formatDate(c.created_at)}</td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-mono text-[11px]">
                          {c.evidence_count} {c.evidence_count === 1 ? 'File' : 'Files'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectCase(c.id)}
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1 transition-colors"
                            title="Open case workspace"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">OPEN</span>
                          </button>
                          <button
                            onClick={() => onNavigateToReports(c.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1 transition-colors"
                            title="Case report"
                            aria-label={`Report for ${c.case_number}`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
