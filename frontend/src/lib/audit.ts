// Display helpers for audit-log entries (custody ledgers and the case audit trail).
import { AuditEntry } from '@/types/api';
import { humanize } from './format';

/** One line describing an entry's detail, such as "Status: open → in_progress". */
export const describeAuditDetail = (entry: AuditEntry): string => {
  const detail = entry.detail;
  if (!detail) return '';
  return Object.entries(detail)
    .filter(([key]) => key !== 'case_id')
    .map(([key, value]) => {
      if (value && typeof value === 'object' && 'before' in value && 'after' in value) {
        const v = value as { before: unknown; after: unknown };
        const show = (x: unknown) => {
          if (x === null || x === undefined || x === '') return '—';
          if (typeof x === 'object') return JSON.stringify(x);
          // Enum values such as "in_progress" read as "In progress".
          return typeof x === 'string' && /^[a-z]+(_[a-z]+)*$/.test(x) ? humanize(x) : String(x);
        };
        return `${humanize(key)}: ${show(v.before)} → ${show(v.after)}`;
      }
      if (key === 'sha256') return `SHA-256 ${String(value).slice(0, 12)}…`;
      if (value === true) return humanize(key);
      return `${humanize(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
    })
    .join(' • ');
};

export const AUDIT_ACTION_STYLES: Record<AuditEntry['action'], string> = {
  uploaded: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  viewed: 'bg-slate-800 text-slate-300 border-slate-700',
  modified: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  reviewed: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  exported: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
};
