import React from 'react';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { Origin, ReviewStatus } from '@/types/api';
import { ReviewBadge } from './Badges';

interface ReviewActionsProps {
  origin: Origin;
  status: ReviewStatus;
  onChange: (status: ReviewStatus) => void;
  busy?: boolean;
}

/**
 * Confirm or reject an AI proposal. Anything the AI creates stays a proposal until an
 * investigator confirms it (docs/PLAN.md); a decision can be undone back to pending.
 * Renders nothing for records an investigator entered.
 */
export const ReviewActions: React.FC<ReviewActionsProps> = ({ origin, status, onChange, busy = false }) => {
  if (origin !== 'ai') return null;
  if (status !== 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <ReviewBadge status={status} origin={origin} />
        <button
          onClick={() => onChange('pending')}
          disabled={busy}
          className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-50"
          title="Undo review"
          aria-label="Undo review"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <ReviewBadge status="pending" origin="ai" />
      <button
        onClick={() => onChange('confirmed')}
        disabled={busy}
        className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Confirm
      </button>
      <button
        onClick={() => onChange('rejected')}
        disabled={busy}
        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-red-300 hover:border-red-500/40 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
      >
        <X className="w-3 h-3" /> Reject
      </button>
    </span>
  );
};
