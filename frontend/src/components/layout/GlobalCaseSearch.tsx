import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { CASE_STATUS_DOT } from '@/components/shared/Badges';
import { useCases } from '@/hooks/useCases';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { casePath } from '@/lib/caseModules';
import { humanize } from '@/lib/format';

/** Header search over every case: number, title, people, places and lead (GET /api/cases?q=). */
export const GlobalCaseSearch: React.FC = () => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const q = useDebouncedValue(term.trim());
  const enabled = q.length >= 2;
  const { data, isFetching, isError } = useCases({ q }, { enabled });

  const openCase = (id: number) => {
    navigate(casePath(id));
    setTerm('');
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={ref}>
      <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" aria-hidden />
      <input
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && data?.[0]) openCase(data[0].id);
        }}
        placeholder="Find a case: number, name, place…"
        className="w-full h-8 pl-8 pr-7 bg-surface border border-line-strong rounded text-body text-ink placeholder:text-ink-faint hover:border-control focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
        id="global-search-input"
        aria-label="Search cases"
      />
      {term && (
        <button
          onClick={() => setTerm('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-ink-muted hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && enabled && (
        <div className="absolute right-0 z-50 mt-1.5 w-[min(26rem,calc(100vw-2rem))] bg-raised border border-line-strong rounded-lg shadow-overlay p-1 max-h-80 overflow-y-auto">
          {isError && <div className="px-2 py-2 text-body text-danger">Search failed.</div>}
          {!data && isFetching && (
            <div className="px-2 py-2 text-body text-ink-muted flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Searching…
            </div>
          )}
          {data?.length === 0 && <div className="px-2 py-2 text-body text-ink-muted">No cases match “{q}”.</div>}
          {data?.map((c) => (
            <button
              key={c.id}
              onClick={() => openCase(c.id)}
              className="w-full px-2 py-1.5 rounded text-left hover:bg-hover flex items-start gap-2.5"
            >
              <span className={`mt-1.5 size-1.5 rounded-full shrink-0 ${CASE_STATUS_DOT[c.status]}`} title={humanize(c.status)} />
              <span className="min-w-0">
                <span className="block text-body text-ink truncate">{c.title}</span>
                <span className="block text-2xs text-ink-muted">
                  <span className="font-mono">{c.case_number}</span> · {humanize(c.incident_type)} · {humanize(c.status)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
