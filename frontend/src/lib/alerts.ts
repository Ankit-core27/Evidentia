// Where an alert leads, and how its severity looks; shared by the header bell and the dashboard feed.
import { Alert } from '@/types/api';
import { casePath } from './caseModules';

/** The workspace module an alert opens: the evidence (in the inspector) or the review queue. */
export const alertPath = (alert: Alert): string => {
  if (alert.kind === 'processing') {
    const path = casePath(alert.case_id, 'evidence');
    return alert.record_type === 'evidence' && alert.record_id !== null ? `${path}?evidence=${alert.record_id}` : path;
  }
  if (alert.kind === 'conflict') return `${casePath(alert.case_id, 'review')}?view=conflicts`;
  if (alert.kind === 'review') return casePath(alert.case_id, 'review');
  return casePath(alert.case_id);
};

export const ALERT_SEVERITY_DOT: Record<Alert['severity'], string> = {
  info: 'bg-info',
  warning: 'bg-warn',
  critical: 'bg-danger'
};
