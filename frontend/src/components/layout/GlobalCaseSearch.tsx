import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { CaseStatusBadge } from '@/components/shared/Badges';
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
      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
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
        placeholder="Search cases by number, title, person or place…"
        className="w-full pl-10 pr-8 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
        id="global-search-input"
        aria-label="Search cases"
      />
      {term && (
        <button
          onClick={() => setTerm('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && enabled && (
        <div className="absolute left-0 mt-2 w-full min-w-[22rem] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 max-h-80 overflow-y-auto">
          {isError && <div className="p-2 text-xs text-red-300">Search failed.</div>}
          {!data && isFetching && (
            <div className="p-2 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          )}
          {data?.length === 0 && <div className="p-2 text-xs text-slate-500">No cases match "{q}".</div>}
          {data?.map((c) => (
            <button
              key={c.id}
              onClick={() => openCase(c.id)}
              className="w-full p-2 rounded-lg text-left hover:bg-slate-800 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-[10px] text-cyan-400 font-bold">{c.case_number}</div>
                <div className="text-xs text-slate-200 truncate">{c.title}</div>
                <div className="text-[10px] text-slate-500">{humanize(c.incident_type)}</div>
              </div>
              <CaseStatusBadge status={c.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
