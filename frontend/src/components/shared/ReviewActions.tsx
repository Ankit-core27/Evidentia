import React from 'react';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { Origin, ReviewStatus } from '@/types/api';
import { ReviewBadge } from './Badges';
import { iconButtonClass } from './formStyles';

interface ReviewActionsProps {
  origin: Origin;
  status: ReviewStatus;
  onChange: (status: ReviewStatus) => void;
  busy?: boolean;
}

const action = 'h-6 px-2 rounded border text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50';

/**
 * Confirm or reject an AI proposal. Anything the AI creates stays a proposal until an
 * investigator confirms it (docs/PLAN.md); a decision can be undone back to pending.
 * Renders nothing for records an investigator entered.
 */
export const ReviewActions: React.FC<ReviewActionsProps> = ({ origin, status, onChange, busy = false }) => {
  if (origin !== 'ai') return null;
  if (status !== 'pending') {
    return (
      <span className="inline-flex items-center gap-1">
        <ReviewBadge status={status} origin={origin} />
        <button
          onClick={() => onChange('pending')}
          disabled={busy}
          className={`${iconButtonClass} size-6`}
          title="Undo review"
          aria-label="Undo review"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Undo2 className="size-3" />}
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <ReviewBadge status="pending" origin="ai" />
      <button
        onClick={() => onChange('confirmed')}
        disabled={busy}
        className={`${action} border-ok/50 text-ok hover:bg-ok/10`}
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Confirm
      </button>
      <button
        onClick={() => onChange('rejected')}
        disabled={busy}
        className={`${action} border-line-strong text-ink-soft hover:text-danger hover:border-danger/50`}
      >
        <X className="size-3" /> Reject
      </button>
    </span>
  );
};
