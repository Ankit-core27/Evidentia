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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`h-8 flex items-center gap-2 pl-1 pr-1.5 rounded transition-colors ${
          current ? 'hover:bg-raised' : 'border border-dashed border-warn/60 text-warn hover:bg-warn/10'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `Working as ${current.name}. Change investigator` : 'Choose investigator'}
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
          <span className="text-2xs text-ink-muted truncate">
            {current ? current.role : 'Recorded in the audit log'}
          </span>
        </span>
        <ChevronDown className="size-3.5 text-ink-muted" aria-hidden />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-[min(18rem,calc(100vw-2rem))] bg-raised border border-line-strong rounded-lg shadow-overlay p-1"
          role="listbox"
          aria-label="Working as"
        >
          <div className="px-2 pt-1.5 pb-1 text-2xs font-medium text-ink-muted">Working as · recorded in the audit log</div>
          {isPending && <div className="px-2 py-2 text-body text-ink-muted">Loading investigators…</div>}
          {isError && <div className="px-2 py-2 text-body text-danger">Could not load investigators.</div>}
          <div className="max-h-72 overflow-y-auto">
            {investigators?.map((inv) => (
              <button
                key={inv.id}
                role="option"
                aria-selected={inv.id === investigatorId}
                onClick={() => {
                  setInvestigatorId(inv.id);
                  setOpen(false);
                }}
                className={`w-full px-2 py-1.5 rounded text-left flex items-center gap-2.5 ${
                  inv.id === investigatorId ? 'bg-hover' : 'hover:bg-hover'
                }`}
              >
                <InitialsAvatar name={inv.name} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-body text-ink truncate">{inv.name}</span>
                  <span className="block text-2xs text-ink-muted truncate">
                    {inv.role} · <span className="font-mono">{inv.badge_number}</span> · {inv.clearance_level}
                  </span>
                </span>
                {inv.id === investigatorId && <Check className="size-3.5 text-accent-text" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
