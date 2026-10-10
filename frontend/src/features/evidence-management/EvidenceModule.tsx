import React, { useState } from 'react';
import { Folder, Search } from 'lucide-react';
import { EVIDENCE_ICONS } from '@/components/evidence/evidenceIcons';
import { ProcessingBadge } from '@/components/shared/Badges';
import { EmptyState, QueryBoundary } from '@/components/shared/QueryState';
import { useCaseEvidence } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { formatBytes, formatDateTime, humanize } from '@/lib/format';
import { Evidence, EvidenceType, Id } from '@/types/api';
import { EvidenceUploader } from './EvidenceUploader';

/** A case's evidence: upload, processing status, and the way into the inspector. */
export const EvidenceModule: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const query = useCaseEvidence(caseId);
  const { open } = useEvidenceInspector();
  const [typeFilter, setTypeFilter] = useState<EvidenceType | 'all'>('all');
  const [search, setSearch] = useState('');

  const matches = (e: Evidence) => {
    const q = search.trim().toLowerCase();
    return (
      (typeFilter === 'all' || e.type === typeFilter) &&
      (!q || [e.title, e.description, e.summary, e.notes].some((t) => t?.toLowerCase().includes(q)))
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Folder className="w-5 h-5 text-cyan-400" />
            Evidence
          </h2>
          <p className="text-xs text-slate-400">Originals with their SHA-256 hashes, processing status and AI summaries.</p>
        </div>
      </div>

      <EvidenceUploader caseId={caseId} />

      <QueryBoundary
        query={query}
        loadingLabel="Loading evidence…"
        empty={<EmptyState title="No evidence yet" message="Upload the first files above." />}
      >
        {(items) => {
          const types = [...new Set(items.map((e) => e.type))];
          const visible = items.filter(matches);
          return (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by title, summary or notes…"
                    aria-label="Filter evidence"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  {(['all', ...types] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`px-3 py-1 rounded-lg whitespace-nowrap ${
                        typeFilter === t ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t === 'all' ? `All (${items.length})` : `${humanize(t)} (${items.filter((e) => e.type === t).length})`}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length === 0 && <EmptyState title="Nothing matches this filter" />}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visible.map((item) => (
                  <EvidenceCard key={item.id} item={item} onOpen={() => open(item.id)} />
                ))}
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
};

export const EvidenceCard: React.FC<{ item: Evidence; onOpen: () => void; footer?: React.ReactNode }> = ({ item, onOpen, footer }) => {
  const { icon: Icon, colour } = EVIDENCE_ICONS[item.type];
  return (
    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col gap-3" data-testid={`evidence-card-${item.id}`}>
      <button onClick={onOpen} className="text-left space-y-2 flex-1 group">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
            <Icon className={`w-3.5 h-3.5 ${colour}`} /> {humanize(item.type)}
          </span>
          <ProcessingBadge status={item.processing_status} />
        </div>
        <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors break-words">{item.title}</h3>
        {item.summary ? (
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{item.summary}</p>
        ) : (
          <p className="text-xs text-slate-500 italic">
            {item.processing_status === 'failed' ? 'Processing failed. Open it to reprocess.' : 'Summary appears when processing finishes.'}
          </p>
        )}
      </button>
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 gap-2">
        <span>
          {formatBytes(item.size_bytes)} • {formatDateTime(item.collected_at ?? item.created_at)}
        </span>
        <span title={item.sha256}>SHA-256 {item.sha256.slice(0, 8)}…</span>
      </div>
      {footer}
    </div>
  );
};
