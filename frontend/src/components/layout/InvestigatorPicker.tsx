import React, { useRef, useState } from 'react';
import { Check, ChevronDown, UserCircle } from 'lucide-react';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useInvestigators } from '@/hooks/useCases';
import { useInvestigatorStore } from '@/stores/investigator';

/**
 * Who is using the app. Until access control lands (M8), the choice is sent as
 * X-Investigator-Id so the audit log records who did what.
 */
export const InvestigatorPicker: React.FC = () => {
  const { data: investigators, isPending, isError } = useInvestigators();
  const investigatorId = useInvestigatorStore((s) => s.investigatorId);
  const setInvestigatorId = useInvestigatorStore((s) => s.setInvestigatorId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const current = investigators?.find((i) => i.id === investigatorId) ?? null;

  return (
    <div className="relative pl-2 border-l border-slate-800" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2.5 px-1.5 py-1 rounded-lg transition-colors ${
          current ? 'hover:bg-slate-900' : 'bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        id="investigator-picker"
      >
        {current ? (
          <InitialsAvatar name={current.name} size="sm" />
        ) : (
          <UserCircle className="w-6 h-6 text-amber-300" />
        )}
        <div className="hidden md:flex flex-col text-left max-w-[11rem]">
          <span className={`text-xs font-bold leading-tight truncate ${current ? 'text-slate-100' : 'text-amber-200'}`}>
            {current ? current.name : 'Choose investigator'}
          </span>
          <span className="text-[9px] text-cyan-400 tracking-wider uppercase truncate">
            {current ? `${current.role} · ${current.badge_number}` : 'Recorded in the audit log'}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50"
          role="listbox"
        >
          <span className="text-[10px] text-slate-400 uppercase font-bold block px-2 py-1 border-b border-slate-800">
            Working as
          </span>
          {isPending && <div className="p-2 text-xs text-slate-500">Loading investigators…</div>}
          {isError && <div className="p-2 text-xs text-red-300">Could not load investigators.</div>}
          <div className="mt-1 space-y-1 max-h-72 overflow-y-auto">
            {investigators?.map((inv) => (
              <button
                key={inv.id}
                role="option"
                aria-selected={inv.id === investigatorId}
                onClick={() => {
                  setInvestigatorId(inv.id);
                  setOpen(false);
                }}
                className={`w-full p-2 rounded-lg text-left flex items-center gap-2.5 transition-colors ${
                  inv.id === investigatorId ? 'bg-cyan-500/15' : 'hover:bg-slate-800'
                }`}
              >
                <InitialsAvatar name={inv.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-100 truncate">{inv.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {inv.role} · {inv.badge_number} · {inv.clearance_level}
                  </div>
                </div>
                {inv.id === investigatorId && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
