import React from 'react';
import { humanize } from '@/lib/format';
import { CasePriority, CaseStatus, Certainty, ProcessingStatus, ReviewStatus } from '@/types/api';

const base = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border whitespace-nowrap';

const STATUS_STYLES: Record<CaseStatus, string> = {
  open: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  in_progress: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  under_review: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  closed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
};

export const CaseStatusBadge: React.FC<{ status: CaseStatus }> = ({ status }) => (
  <span className={`${base} ${STATUS_STYLES[status]}`}>{humanize(status)}</span>
);

const PRIORITY_STYLES: Record<CasePriority, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-slate-800 text-slate-400 border-slate-700'
};

export const PriorityBadge: React.FC<{ priority: CasePriority }> = ({ priority }) => (
  <span className={`${base} uppercase ${PRIORITY_STYLES[priority]}`}>{priority}</span>
);

const REVIEW_STYLES: Record<ReviewStatus, string> = {
  pending: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  confirmed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-slate-800 text-slate-500 border-slate-700 line-through'
};

/** Shows nothing for investigator-entered records, which are confirmed by definition. */
export const ReviewBadge: React.FC<{ status: ReviewStatus; origin?: 'ai' | 'investigator' }> = ({ status, origin }) => {
  if (origin === 'investigator' && status === 'confirmed') return null;
  const label = status === 'pending' ? 'AI proposal' : origin === 'ai' ? `AI, ${status}` : humanize(status);
  return <span className={`${base} ${REVIEW_STYLES[status]}`}>{label}</span>;
};

const PROCESSING_STYLES: Record<ProcessingStatus, string> = {
  queued: 'bg-slate-800 text-slate-300 border-slate-700',
  processing: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 animate-pulse',
  done: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/40'
};

export const ProcessingBadge: React.FC<{ status: ProcessingStatus }> = ({ status }) => (
  <span className={`${base} ${PROCESSING_STYLES[status]}`}>{status === 'done' ? 'Processed' : humanize(status)}</span>
);

const CERTAINTY_STYLES: Record<Certainty, string> = {
  established: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  hypothesis: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  disputed: 'bg-amber-500/15 text-amber-300 border-amber-500/40'
};

export const CertaintyBadge: React.FC<{ certainty: Certainty }> = ({ certainty }) => (
  <span className={`${base} ${CERTAINTY_STYLES[certainty]}`}>{humanize(certainty)}</span>
);
