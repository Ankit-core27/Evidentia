import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { EVIDENCE_ICONS } from '@/components/evidence/evidenceIcons';
import { ProcessingBadge } from '@/components/shared/Badges';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, QueryBoundary } from '@/components/shared/QueryState';
import { FilterChips } from '@/components/shared/Segmented';
import { inputClass } from '@/components/shared/formStyles';
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
      <PageHeader title="Evidence" description="Original files with their SHA-256 hashes, processing status and summaries. Open one to see its text, links and custody record." />

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
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <div className="relative md:w-72 shrink-0">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" aria-hidden />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Title, summary or notes"
                    aria-label="Filter evidence"
                    className={`${inputClass} pl-8`}
                  />
                </div>
                {types.length > 1 && (
                  <FilterChips
                    label="Evidence type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[
                      { value: 'all', label: 'All', count: items.length },
                      ...types.map((t) => ({ value: t, label: humanize(t), count: items.filter((e) => e.type === t).length }))
                    ]}
                  />
                )}
              </div>

              {visible.length === 0 ? (
                <EmptyState title="Nothing matches this filter" />
              ) : (
                <ul className="rounded-md border border-line divide-y divide-line">
                  {visible.map((item) => (
                    <li key={item.id}>
                      <EvidenceRow item={item} onOpen={() => open(item.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
};

/** One evidence item in a list: what it is, what it says, and the facts that identify the file. */
export const EvidenceRow: React.FC<{ item: Evidence; onOpen: () => void; footer?: React.ReactNode }> = ({ item, onOpen, footer }) => {
  const Icon = EVIDENCE_ICONS[item.type].icon;
  return (
    <div className="group relative flex gap-3 px-3 py-3 hover:bg-surface transition-colors" data-testid={`evidence-card-${item.id}`}>
      <Icon className="size-4 text-ink-muted shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-3">
          {/* The title button covers the row, so the whole row opens the inspector. */}
          <button
            onClick={onOpen}
            className="text-left text-body font-medium text-ink group-hover:text-accent-text break-words after:absolute after:inset-0 after:content-['']"
          >
            {item.title}
          </button>
          <span className="shrink-0">
            <ProcessingBadge status={item.processing_status} />
          </span>
        </div>
        {item.summary ? (
          <p className="text-body text-ink-soft line-clamp-2 max-w-4xl">{item.summary}</p>
        ) : (
          <p className="text-body text-ink-muted">
            {item.processing_status === 'failed' ? 'Processing failed. Open it to reprocess.' : 'The summary appears when processing finishes.'}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
          <span>{humanize(item.type)}</span>
          <span className="font-mono">{formatBytes(item.size_bytes)}</span>
          <span className="font-mono">{formatDateTime(item.collected_at ?? item.created_at)}</span>
          <span className="font-mono" title={item.sha256}>
            SHA-256 {item.sha256.slice(0, 12)}…
          </span>
        </div>
        {footer && <div className="relative">{footer}</div>}
      </div>
    </div>
  );
};
