import React from 'react';
import { AlertTriangle, Loader2, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { NotWiredYet } from '@/components/shared/NotWiredYet';
import { primaryButtonClass } from '@/components/shared/formStyles';
import { useVerifyCase } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { formatDateTime } from '@/lib/format';
import { Id } from '@/types/api';

/** Case settings: the file integrity check (POST /api/cases/{id}/verify); the audit trail arrives in T11. */
export const SettingsModule: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const verify = useVerifyCase(caseId);
  const { open } = useEvidenceInspector();
  const result = verify.data;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="pb-3 border-b border-slate-800">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          Case Settings
        </h2>
        <p className="text-xs text-slate-400">Chain of custody checks for this case.</p>
      </div>

      <section className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4 text-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-200">File integrity check</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Recomputes the SHA-256 of every stored original and compares it with the hash recorded at upload. The check
              itself is written to the audit log.
            </p>
          </div>
          <button onClick={() => verify.mutate()} disabled={verify.isPending} className={`${primaryButtonClass} shrink-0`}>
            {verify.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Verify integrity
          </button>
        </div>

        {verify.isError && <p className="text-red-300">{(verify.error as Error).message}</p>}

        {result && result.mismatches.length === 0 && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 flex items-center gap-2" role="status">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            All {result.checked} files match their recorded hashes. Checked {formatDateTime(result.verified_at)}.
          </div>
        )}

        {result && result.mismatches.length > 0 && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 space-y-2" role="alert">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              {result.mismatches.length} of {result.checked} files no longer match their recorded hash.
            </div>
            <ul className="space-y-1.5">
              {result.mismatches.map((m) => (
                <li key={m.evidence_id} className="p-2 rounded-lg bg-slate-950/60 border border-red-500/20">
                  <button onClick={() => open(m.evidence_id)} className="text-red-100 font-bold hover:underline">
                    {m.title}
                  </button>
                  <div className="text-[10px] text-red-300/80 break-all">Recorded: {m.expected}</div>
                  <div className="text-[10px] text-red-300/80 break-all">Now: {m.actual ?? 'file missing'}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <NotWiredYet module="The case audit trail" task="T11" />
    </div>
  );
};
