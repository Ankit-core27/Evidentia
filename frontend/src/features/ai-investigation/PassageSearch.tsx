import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { inputClass } from '@/components/shared/formStyles';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useCaseSearch } from '@/hooks/useSearch';
import { Id } from '@/types/api';

/** Ranked passages across a case's evidence (GET /api/cases/{id}/search?q=). */
export const PassageSearch: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const [term, setTerm] = useState('');
  const q = useDebouncedValue(term.trim(), 300);
  const query = useCaseSearch(caseId, q);
  const { open } = useEvidenceInspector();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" aria-hidden />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search every passage in this case's evidence"
          aria-label="Search passages"
          className={`${inputClass} h-9 pl-8`}
          autoFocus
        />
      </div>

      {!q && <p className="text-xs text-ink-muted">Results are ranked by how closely each passage matches.</p>}
      {q && query.isPending && <LoadingState label="Searching…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {q && query.data?.length === 0 && <EmptyState title={`No passages match “${q}”`} />}

      {!!query.data?.length && (
        <ol className="rounded-md border border-line divide-y divide-line" data-testid="search-results">
          {query.data.map((hit, i) => (
            <li key={`${hit.chunk_id}-${i}`}>
              <button onClick={() => open(hit.evidence_id, hit.passage)} className="group w-full text-left px-3 py-2.5 hover:bg-surface space-y-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-accent-text group-hover:underline underline-offset-2">
                    {hit.evidence_title}
                    {hit.page !== null && <span className="font-mono text-ink-muted"> p.{hit.page}</span>}
                  </span>
                  <span className="font-mono text-2xs text-ink-muted shrink-0">match {hit.score.toFixed(2)}</span>
                </span>
                <p className="text-body text-ink-soft leading-relaxed line-clamp-4">{hit.passage}</p>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
