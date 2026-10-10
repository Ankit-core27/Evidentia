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
      // Flat objects, such as an integrity check's counts, read as "checked 7, mismatches 0".
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
          `${humanize(k).toLowerCase()} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`
        );
        return `${humanize(key)}: ${parts.join(', ')}`;
      }
      return `${humanize(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
    })
    .join(' · ');
};

/** Ledger verbs, set in mono like the rest of the custody record; colour marks the ones that change something. */
export const AUDIT_ACTION_STYLES: Record<AuditEntry['action'], string> = {
  uploaded: 'text-ok',
  viewed: 'text-ink-muted',
  modified: 'text-warn',
  reviewed: 'text-pending',
  exported: 'text-info'
};
