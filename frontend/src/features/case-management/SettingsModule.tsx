import React from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { PageHeader, SectionHeader } from '@/components/shared/PageHeader';
import { primaryButtonClass } from '@/components/shared/formStyles';
import { useVerifyCase } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { formatDateTime } from '@/lib/format';
import { CaseWorkspace } from '@/types/api';
import { AuditTrail } from './AuditTrail';

/** Custody and audit: the file integrity check (POST /api/cases/{id}/verify) and the case audit trail. */
export const SettingsModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const verify = useVerifyCase(caseId);
  const { open } = useEvidenceInspector();
  const result = verify.data;

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader title="Custody & audit" description="Chain of custody for this case: check that every stored original is unchanged, and see who did what." />

      <section className="space-y-3" aria-label="File integrity check">
        <SectionHeader title="File integrity check" as="h3" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-body text-ink-soft max-w-2xl">
            Recomputes the SHA-256 of every stored original and compares it with the hash recorded at upload. The check itself is written
            to the audit log.
          </p>
          <button onClick={() => verify.mutate()} disabled={verify.isPending} className={`${primaryButtonClass} shrink-0`}>
            {verify.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" aria-hidden />}
            Verify integrity
          </button>
        </div>

        {verify.isError && <p className="text-body text-danger">{(verify.error as Error).message}</p>}

        {result && result.mismatches.length === 0 && (
          <p className="px-3 py-2.5 rounded-md border border-ok/40 bg-ok/5 text-body text-ink flex items-center gap-2" role="status">
            <ShieldCheck className="size-4 text-ok shrink-0" aria-hidden />
            <span>
              All <span className="font-mono">{result.checked}</span> files match their recorded hashes. Checked{' '}
              <span className="font-mono">{formatDateTime(result.verified_at)}</span>.
            </span>
          </p>
        )}

        {result && result.mismatches.length > 0 && (
          <div className="rounded-md border border-danger/50" role="alert">
            <div className="px-3 py-2.5 bg-danger/10 text-body text-ink font-medium flex items-center gap-2 border-b border-danger/30">
              <AlertTriangle className="size-4 text-danger shrink-0" aria-hidden />
              {result.mismatches.length} of {result.checked} files no longer match their recorded hash.
            </div>
            <ul className="divide-y divide-line">
              {result.mismatches.map((m) => (
                <li key={m.evidence_id} className="px-3 py-2.5 space-y-0.5">
                  <button onClick={() => open(m.evidence_id)} className="text-body font-medium text-ink hover:underline">
                    {m.title}
                  </button>
                  <div className="font-mono text-2xs text-ink-muted break-all">Recorded {m.expected}</div>
                  <div className="font-mono text-2xs text-danger break-all">Now&nbsp;&nbsp;&nbsp;&nbsp; {m.actual ?? 'file missing'}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <AuditTrail workspace={workspace} />
    </div>
  );
};
