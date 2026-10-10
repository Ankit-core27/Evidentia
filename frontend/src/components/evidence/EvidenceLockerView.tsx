import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Search } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { EvidenceCard } from '@/features/evidence-management/EvidenceModule';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGlobalEvidence } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { casePath } from '@/lib/caseModules';
import { humanize } from '@/lib/format';
import { EVIDENCE_TYPES } from '@/lib/options';
import { EvidenceType } from '@/types/api';

/** Evidence across every case (GET /api/evidence?q=&type=). */
export const EvidenceLockerView: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<EvidenceType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const q = useDebouncedValue(searchQuery.trim());
  const query = useGlobalEvidence({ q: q || undefined, type: typeFilter || undefined });
  const { open } = useEvidenceInspector();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-cyan-400" />
            GLOBAL EVIDENCE
          </h1>
          <p className="text-xs text-slate-400 mt-1">Evidence from every case, with its hash, processing status and summary.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, summary, case number or case title…"
            aria-label="Search evidence"
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="md:col-span-7 flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
          {(['', ...EVIDENCE_TYPES] as const).map((type) => (
            <button
              key={type || 'all'}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                typeFilter === type ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type ? humanize(type) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {query.isPending && <LoadingState label="Loading evidence…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && (
        <EmptyState
          title={q || typeFilter ? 'No evidence matches these filters' : 'No evidence yet'}
          message={q || typeFilter ? 'Change the search or type.' : 'Evidence uploaded to any case appears here.'}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {query.data?.map((item) => (
          <EvidenceCard
            key={item.id}
            item={item}
            onOpen={() => open(item.id)}
            footer={
              <Link
                to={casePath(item.case_id, 'evidence')}
                className="text-[10px] text-slate-400 hover:text-cyan-300 truncate"
                title={item.case_title}
              >
                {item.case_number} · {item.case_title}
              </Link>
            }
          />
        ))}
      </div>
    </div>
  );
};
