import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { humanize } from '@/lib/format';
import { CasePriority, CaseStatus, Certainty, ProcessingStatus, ReviewStatus } from '@/types/api';

/** A small bordered label. Colour only where the value needs attention. */
export const tagClass =
  'inline-flex items-center gap-1 h-5 px-1.5 rounded border text-2xs font-medium leading-none whitespace-nowrap';

export const CASE_STATUS_DOT: Record<CaseStatus, string> = {
  open: 'bg-warn',
  in_progress: 'bg-accent',
  under_review: 'bg-info',
  closed: 'bg-ink-faint'
};

/** Status reads as a dot and a word, so a column of them stays quiet. */
export const CaseStatusBadge: React.FC<{ status: CaseStatus }> = ({ status }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft whitespace-nowrap">
    <span className={`size-1.5 rounded-full shrink-0 ${CASE_STATUS_DOT[status]}`} aria-hidden />
    {humanize(status)}
  </span>
);

const PRIORITY_STYLES: Record<CasePriority, string> = {
  critical: 'text-danger border-danger/50',
  high: 'text-warn border-warn/40',
  medium: 'text-ink-soft border-line-strong',
  low: 'text-ink-muted border-line'
};

export const PriorityBadge: React.FC<{ priority: CasePriority }> = ({ priority }) => (
  <span className={`${tagClass} ${PRIORITY_STYLES[priority]}`} title="Priority">
    {humanize(priority)}
  </span>
);

/**
 * AI proposals carry a dashed edge everywhere they appear (tags, canvas nodes and links),
 * so "not yet confirmed" looks the same across the app.
 * Shows nothing for investigator-entered records, which are confirmed by definition.
 */
export const ReviewBadge: React.FC<{ status: ReviewStatus; origin?: 'ai' | 'investigator' }> = ({ status, origin }) => {
  if (origin === 'investigator' && status === 'confirmed') return null;
  if (status === 'pending') {
    return <span className={`${tagClass} border-dashed border-pending/60 text-pending bg-pending/5`}>AI proposal</span>;
  }
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-ok whitespace-nowrap">
        <Check className="size-3" aria-hidden /> {origin === 'ai' ? 'Confirmed AI proposal' : 'Confirmed'}
      </span>
    );
  }
  return (
    <span className="text-2xs text-ink-muted line-through whitespace-nowrap">{origin === 'ai' ? 'Rejected AI proposal' : 'Rejected'}</span>
  );
};

/** Processing is only loud while it is running or when it failed. */
export const ProcessingBadge: React.FC<{ status: ProcessingStatus }> = ({ status }) => {
  switch (status) {
    case 'done':
      return (
        <span className="inline-flex items-center gap-1 text-2xs text-ink-muted whitespace-nowrap">
          <Check className="size-3 text-ok" aria-hidden /> Processed
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 text-2xs text-accent-text whitespace-nowrap">
          <Loader2 className="size-3 animate-spin" aria-hidden /> Processing
        </span>
      );
    case 'queued':
      return <span className="text-2xs text-ink-muted whitespace-nowrap">Queued</span>;
    case 'failed':
      return <span className={`${tagClass} text-danger border-danger/50`}>Failed</span>;
  }
};

const CERTAINTY_STYLES: Record<Certainty, string> = {
  established: 'text-ink-muted border-line-strong',
  hypothesis: 'text-info border-info/40',
  disputed: 'text-warn border-warn/50 bg-warn/5'
};

export const CertaintyBadge: React.FC<{ certainty: Certainty }> = ({ certainty }) => (
  <span className={`${tagClass} ${CERTAINTY_STYLES[certainty]}`}>{humanize(certainty)}</span>
);
