// Where an alert leads, and how its severity looks; shared by the header bell and the dashboard feed.
import { Alert } from '@/types/api';
import { casePath } from './caseModules';

/** The workspace module an alert opens: the evidence (in the inspector) or the review queue. */
export const alertPath = (alert: Alert): string => {
  if (alert.kind === 'processing') {
    const path = casePath(alert.case_id, 'evidence');
    return alert.record_type === 'evidence' && alert.record_id !== null ? `${path}?evidence=${alert.record_id}` : path;
  }
  if (alert.kind === 'conflict' || alert.kind === 'review') return casePath(alert.case_id, 'review');
  return casePath(alert.case_id);
};

export const ALERT_SEVERITY_DOT: Record<Alert['severity'], string> = {
  info: 'bg-cyan-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-500'
};

export const ALERT_SEVERITY_STYLES: Record<Alert['severity'], string> = {
  info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30'
};
