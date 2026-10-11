import React from 'react';
import { humanize } from '@/lib/format';
import { FindingState, SEVERITY_SCALE, StructureStatus } from './anatomyEngine';

const STATE_STYLES: Record<FindingState, { label: string; tone: string; dot: string; note: string }> = {
  injury_documented: { label: 'Injury documented', tone: 'border-danger/50 bg-danger/5 text-danger', dot: 'bg-danger',
    note: 'Damage to this structure is recorded in the selected sources.' },
  abnormality_documented: { label: 'Abnormality documented', tone: 'border-warn/50 bg-warn/5 text-warn', dot: 'bg-warn',
    note: 'A non-traumatic abnormality is recorded for this structure.' },
  explicitly_normal: { label: 'Explicitly normal', tone: 'border-ok/40 bg-ok/5 text-ok', dot: 'bg-ok',
    note: 'A cited source states this structure is normal.' },
  uncertain: { label: 'Uncertain', tone: 'border-warn/50 bg-warn/5 text-warn', dot: 'bg-warn',
    note: 'Records for this structure are uncertain or contradictory. Check the cited sources.' },
  not_documented: { label: 'Not documented', tone: 'border-line-strong text-ink-soft', dot: 'bg-ink-faint',
    note: 'No finding is recorded. That does not establish a healthy organ.' }
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Health or damage status of the selected structure, derived only from recorded findings. */
export const OrganStatus: React.FC<{ status: StructureStatus }> = ({ status }) => {
  const style = STATE_STYLES[status.state];
  const rank = status.worstSeverity && status.worstSeverity !== 'unknown' ? SEVERITY_SCALE.indexOf(status.worstSeverity) + 1 : 0;
  const counts = [
    status.injuries && plural(status.injuries, 'injury', 'injuries'),
    status.abnormalities && plural(status.abnormalities, 'abnormality', 'abnormalities'),
    status.normal && plural(status.normal, 'normal statement'),
    status.uncertain && plural(status.uncertain, 'uncertain statement')
  ].filter(Boolean);
  return <section aria-label="Organ status" data-testid="organ-status" className={`mt-3 space-y-2 rounded border p-3 ${style.tone}`}>
    <p className="flex items-center gap-2 font-medium"><span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />{style.label}</p>
    {status.worstSeverity && <div>
      <p className="text-xs text-ink-soft">Damage: <span className="font-medium text-ink">{status.worstSeverity === 'unknown' ? 'Severity not documented' : humanize(status.worstSeverity)}</span></p>
      <div className="mt-1 flex gap-1" role="meter" aria-label="Recorded damage severity" aria-valuemin={0} aria-valuemax={SEVERITY_SCALE.length} aria-valuenow={rank}
        aria-valuetext={status.worstSeverity === 'unknown' ? 'Severity not documented' : humanize(status.worstSeverity)}>
        {SEVERITY_SCALE.map((level, i) => <span key={level} title={humanize(level)} className={`h-1.5 flex-1 rounded-sm ${i < rank ? 'bg-danger' : 'bg-line-strong'}`} />)}
      </div>
    </div>}
    <p className="text-xs text-ink-soft">{style.note}</p>
    {counts.length > 0 && <p className="text-xs text-ink-muted">{counts.join(' · ')}</p>}
    {status.pending > 0 && <p className="text-xs text-pending">Includes {plural(status.pending, 'AI proposal')} pending review.</p>}
  </section>;
};
