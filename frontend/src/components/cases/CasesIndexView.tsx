import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { CaseStatusBadge, PriorityBadge } from '@/components/shared/Badges';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { inputClass, primaryButtonClass, selectClass, smallButtonClass } from '@/components/shared/formStyles';
import { useCases, useInvestigators } from '@/hooks/useCases';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { casePath } from '@/lib/caseModules';
import { formatDate, humanize } from '@/lib/format';
import { CASE_PRIORITIES, CASE_STATUSES } from '@/lib/options';
import { CasePriority, CaseStatus, Id } from '@/types/api';

interface CasesIndexViewProps {
  onSelectCase: (caseId: Id) => void;
  onOpenCreateModal: () => void;
  onNavigateToReports: (caseId: Id) => void;
}

const th = 'px-3 h-9 font-normal whitespace-nowrap';
const td = 'px-3 py-2.5';

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
  const count = casesQuery.data?.length;

  return (
    <div className="space-y-5">
      <PageHeader
        level="page"
        title="Cases"
        description="Every case with its status, lead investigator and evidence. Select a row to open the case workspace."
      />

      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative md:w-80">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Case number, title, person, place or lead"
            className={`${inputClass} pl-8`}
            id="case-search-input"
            aria-label="Search cases"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
            className={`${selectClass} md:w-40`}
            id="status-filter-select"
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as CasePriority | '')}
            className={`${selectClass} md:w-40`}
            id="priority-filter-select"
            aria-label="Filter by priority"
          >
            <option value="">Any priority</option>
            {CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </select>
        </div>
        {count !== undefined && (
          <span className="md:ml-auto text-xs text-ink-muted" role="status">
            {count} case{count === 1 ? '' : 's'}
            {filtersActive && ' match'}
          </span>
        )}
      </div>

      {casesQuery.isPending && <LoadingState label="Loading cases…" />}
      {casesQuery.isError && <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} />}
      {casesQuery.data?.length === 0 && (
        <EmptyState
          title={filtersActive ? 'No cases match these filters' : 'No cases yet'}
          message={filtersActive ? 'Change the search or filters.' : 'Create the first case to start an investigation.'}
          action={
            !filtersActive && (
              <button onClick={onOpenCreateModal} id="cases-create-case-btn" className={primaryButtonClass}>
                New case
              </button>
            )
          }
        />
      )}

      {!!casesQuery.data?.length && (
        <div className="relative rounded-md border border-line bg-surface overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th scope="col" className={th}>Case</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={`${th} hidden sm:table-cell`}>Priority</th>
                <th scope="col" className={`${th} hidden lg:table-cell`}>Lead investigator</th>
                <th scope="col" className={`${th} hidden md:table-cell`}>Opened</th>
                <th scope="col" className={`${th} hidden md:table-cell text-right`}>Evidence</th>
                <th scope="col" className={`${th} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {casesQuery.data.map((c) => {
                const lead = investigatorById(c.lead_investigator_id);
                return (
                  <tr key={c.id} className="group hover:bg-surface transition-colors cursor-pointer" onClick={() => onSelectCase(c.id)}>
                    <td className={`${td} min-w-[16rem]`}>
                      <Link
                        to={casePath(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-body font-medium text-ink group-hover:text-accent-text"
                      >
                        {c.title}
                      </Link>
                      <span className="block text-xs text-ink-muted mt-0.5">
                        <span className="font-mono">{c.case_number}</span> · {humanize(c.incident_type)}
                        {c.incident_at ? ` · ${formatDate(c.incident_at)}` : ''}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <CaseStatusBadge status={c.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap hidden sm:table-cell`}>
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className={`${td} whitespace-nowrap hidden lg:table-cell`}>
                      {lead ? (
                        <>
                          <span className="block text-body text-ink-soft">{lead.name}</span>
                          <span className="block font-mono text-2xs text-ink-muted">{lead.badge_number}</span>
                        </>
                      ) : (
                        <span className="text-xs text-ink-muted">Not assigned</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-body text-ink-muted tabular-nums hidden md:table-cell`}>{formatDate(c.created_at)}</td>
                    <td className={`${td} whitespace-nowrap text-right hidden md:table-cell`}>
                      <span className="font-mono text-body text-ink-soft">{c.evidence_count}</span>
                      <span className="text-xs text-ink-muted"> {c.evidence_count === 1 ? 'file' : 'files'}</span>
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onNavigateToReports(c.id)}
                        className={smallButtonClass}
                        aria-label={`Reports for ${c.case_number}`}
                      >
                        Reports
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
