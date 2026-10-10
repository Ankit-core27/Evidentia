import React, { useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
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
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search every passage in this case's evidence…"
          aria-label="Search passages"
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          autoFocus
        />
      </div>

      {!q && <p className="text-[11px] text-slate-500">Results are ranked by how closely each passage matches.</p>}
      {q && query.isPending && <LoadingState label="Searching…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {q && query.data?.length === 0 && <EmptyState title={`No passages match "${q}"`} />}

      <ol className="space-y-2" data-testid="search-results">
        {query.data?.map((hit, i) => (
          <li key={`${hit.chunk_id}-${i}`}>
            <button
              onClick={() => open(hit.evidence_id, hit.passage)}
              className="w-full text-left p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 min-w-0">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate font-bold">{hit.evidence_title}</span>
                  {hit.page !== null && <span className="text-cyan-400/70 shrink-0">p.{hit.page}</span>}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">Match {hit.score.toFixed(2)}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">{hit.passage}</p>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
};
