import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { FilterChips } from '@/components/shared/Segmented';
import { inputClass } from '@/components/shared/formStyles';
import { EvidenceRow } from '@/features/evidence-management/EvidenceModule';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGlobalEvidence } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { casePath } from '@/lib/caseModules';
import { humanize } from '@/lib/format';
import { EVIDENCE_TYPES } from '@/lib/options';
import { EvidenceType } from '@/types/api';

/** Evidence across every case (GET /api/evidence?q=&type=). */
export const EvidenceLockerView: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<EvidenceType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const q = useDebouncedValue(searchQuery.trim());
  const type = typeFilter === 'all' ? undefined : typeFilter;
  const query = useGlobalEvidence({ q: q || undefined, type });
  const { open } = useEvidenceInspector();

  return (
    <div className="space-y-5">
      <PageHeader
        level="page"
        title="Evidence"
        description="Every file in every case, with its hash, processing status and summary."
      />

      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative md:w-80 shrink-0">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Title, summary, case number or case title"
            aria-label="Search evidence"
            className={`${inputClass} pl-8`}
          />
        </div>
        <FilterChips
          label="Evidence type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ value: 'all', label: 'All' }, ...EVIDENCE_TYPES.map((t) => ({ value: t, label: humanize(t) }))]}
        />
      </div>

      {query.isPending && <LoadingState label="Loading evidence…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && (
        <EmptyState
          title={q || type ? 'No evidence matches these filters' : 'No evidence yet'}
          message={q || type ? 'Change the search or type.' : 'Evidence uploaded to any case appears here.'}
        />
      )}

      {!!query.data?.length && (
        <ul className="rounded-md border border-line divide-y divide-line">
          {query.data.map((item) => (
            <li key={item.id}>
              <EvidenceRow
                item={item}
                onOpen={() => open(item.id)}
                footer={
                  <Link
                    to={casePath(item.case_id, 'evidence')}
                    className="text-xs text-ink-muted hover:text-accent-text"
                    title={`Open ${item.case_title}`}
                  >
                    <span className="font-mono">{item.case_number}</span> · {item.case_title}
                  </Link>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
