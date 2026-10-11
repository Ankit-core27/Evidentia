import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPen,
  FileCheck2,
  FileWarning,
  Hand,
  Inbox,
  Loader2,
  Send,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  Undo2,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import { tagClass } from '@/components/shared/Badges';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, selectClass, smallButtonClass } from '@/components/shared/formStyles';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { useCaseWorkspace, useInvestigators } from '@/hooks/useCases';
import { useCustody, useRecordAnalysis, useResolveTransfer, useStartTransfer, useVerifyIntegrity } from '@/hooks/useCustody';
import { isMockMode } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useInvestigatorStore } from '@/stores/investigator';
import { CustodyAction, CustodyEvent, CustodyHistory, CustodyTransfer, EvidenceDetail, Id, IntegrityCheck, IntegrityResult, TransferStatus } from '@/types/api';

const ACTIONS: Record<CustodyAction, { label: string; icon: LucideIcon; tone: string }> = {
  REGISTERED: { label: 'Registered', icon: Inbox, tone: 'text-accent-text' },
  COLLECTED: { label: 'Collected', icon: Inbox, tone: 'text-accent-text' },
  TRANSFERRED: { label: 'Transfer started', icon: Send, tone: 'text-info' },
  RECEIVED: { label: 'Received', icon: Hand, tone: 'text-ok' },
  TRANSFER_REJECTED: { label: 'Transfer rejected', icon: XCircle, tone: 'text-warn' },
  TRANSFER_CANCELLED: { label: 'Transfer cancelled', icon: Undo2, tone: 'text-ink-muted' },
  ANALYSED: { label: 'Analysed', icon: ClipboardPen, tone: 'text-pending' },
  INTEGRITY_CHECKED: { label: 'Integrity checked', icon: FileCheck2, tone: 'text-ink-soft' }
};

const TRANSFER_STATUS: Record<TransferStatus, string> = {
  PENDING: 'border-warn/50 bg-warn/10 text-warn',
  ACCEPTED: 'border-ok/50 bg-ok/10 text-ok',
  REJECTED: 'border-danger/50 bg-danger/10 text-danger',
  CANCELLED: 'border-line-strong text-ink-muted'
};

const RESULT: Record<IntegrityResult, { label: string; icon: LucideIcon; box: string; tone: string }> = {
  MATCH: { label: 'Match', icon: ShieldCheck, box: 'border-ok/50 bg-ok/10', tone: 'text-ok' },
  MISMATCH: { label: 'Mismatch', icon: ShieldX, box: 'border-danger/50 bg-danger/10', tone: 'text-danger' },
  FILE_MISSING: { label: 'File missing', icon: FileWarning, box: 'border-warn/50 bg-warn/10', tone: 'text-warn' },
  STORAGE_ERROR: { label: 'Storage error', icon: ShieldQuestion, box: 'border-warn/50 bg-warn/10', tone: 'text-warn' }
};

/** A name from the history; the record keeps it even if the investigator is removed. */
const who = (id: Id | null, name: string) => (name ? (id === null ? `${name} (no longer listed)` : name) : 'No investigator recorded');

/**
 * The chain of custody of one evidence item: who holds it, every handover, analysis
 * and integrity check, and the actions the chosen investigator may take.
 */
export const ChainOfCustody: React.FC<{ evidence: EvidenceDetail }> = ({ evidence }) => {
  const query = useCustody(evidence.id);
  const workspace = useCaseWorkspace(evidence.case_id);
  const actorId = useInvestigatorStore((s) => s.investigatorId);
  const verify = useVerifyIntegrity(evidence.id, evidence.case_id);
  const [dialog, setDialog] = useState<'transfer' | 'analysis' | null>(null);

  if (isMockMode) {
    return (
      <EmptyState
        title="Chain of custody needs the backend"
        message="Custody transfers and integrity checks run on the server. Start the API and use `npm run dev` to see them."
      />
    );
  }
  if (query.isPending) return <LoadingState label="Loading the chain of custody…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const history = query.data;
  const theCase = workspace.data?.case;
  const assigned = !!theCase && actorId !== null && (actorId === theCase.lead_investigator_id || theCase.investigator_ids.includes(actorId));
  const isLead = !!theCase && actorId === theCase.lead_investigator_id;
  const isCustodian = actorId !== null && history.custodian?.id === actorId;
  const canTransfer = assigned && !history.pending_transfer && (isCustodian || isLead);
  const why =
    actorId === null
      ? 'Choose an investigator in the header to transfer custody or verify integrity.'
      : !assigned
        ? 'You aren’t assigned to this case, so you can view its custody but not change it.'
        : history.pending_transfer
          ? null
          : !isCustodian && !isLead
            ? 'Only the current custodian or the case lead can transfer custody.'
            : null;

  return (
    <section className="space-y-4" aria-label="Chain of custody" data-testid="chain-of-custody">
      <div className="rounded-md border border-line p-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xs font-medium uppercase tracking-wider text-ink-muted">Current custodian</div>
            <div className="text-sm font-semibold text-ink" data-testid="current-custodian">
              {history.custodian?.name ?? 'Nobody holds this evidence'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButtonClass} onClick={() => setDialog('transfer')} disabled={!canTransfer}>
              <Send className="size-3.5" aria-hidden /> Transfer custody
            </button>
            {isCustodian && (
              <button className={secondaryButtonClass} onClick={() => setDialog('analysis')}>
                <ClipboardPen className="size-3.5" aria-hidden /> Record analysis
              </button>
            )}
            <button className={primaryButtonClass} onClick={() => verify.mutate(undefined)} disabled={!assigned || verify.isPending}>
              {verify.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
              Verify integrity
            </button>
          </div>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wider text-ink-muted">Baseline SHA-256, recorded at registration</div>
          <div className="font-mono text-2xs text-ink-soft break-all">{history.baseline_sha256 || 'None recorded'}</div>
        </div>
        {why && <p className="text-xs text-ink-muted">{why}</p>}
      </div>

      {verify.isError && <ErrorState error={verify.error} />}
      {verify.data && <IntegrityResultCard check={verify.data} />}

      {history.pending_transfer && (
        <PendingTransfer
          transfer={history.pending_transfer}
          evidence={evidence}
          actorId={actorId}
          isLead={isLead}
        />
      )}

      <Timeline history={history} />

      {dialog === 'transfer' && theCase && (
        <TransferDialog
          evidence={evidence}
          history={history}
          eligibleIds={[...new Set([theCase.lead_investigator_id, ...theCase.investigator_ids])].filter(
            (id): id is Id => id !== null && id !== history.custodian?.id
          )}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'analysis' && <AnalysisDialog evidence={evidence} onClose={() => setDialog(null)} />}
    </section>
  );
};

const IntegrityResultCard: React.FC<{ check: IntegrityCheck }> = ({ check }) => {
  const r = RESULT[check.result];
  const Icon = r.icon;
  return (
    <div className={`rounded-md border p-3 space-y-1.5 ${r.box}`} role="status" data-testid="integrity-result">
      <div className={`flex items-center gap-2 text-sm font-semibold ${r.tone}`}>
        <Icon className="size-4" aria-hidden /> {r.label}
        <span className="ml-auto font-mono text-2xs font-normal text-ink-muted">{formatDateTime(check.event.at)}</span>
      </div>
      <p className="text-body text-ink-soft">{check.detail}</p>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 font-mono text-2xs">
        <dt className="text-ink-muted">Recorded</dt>
        <dd className="break-all text-ink-soft">{check.expected_sha256}</dd>
        <dt className="text-ink-muted">Computed</dt>
        <dd className="break-all text-ink-soft">{check.actual_sha256 ?? '—'}</dd>
      </dl>
    </div>
  );
};

const PendingTransfer: React.FC<{ transfer: CustodyTransfer; evidence: EvidenceDetail; actorId: Id | null; isLead: boolean }> = ({
  transfer,
  evidence,
  actorId,
  isLead
}) => {
  const resolve = useResolveTransfer(evidence.id, evidence.case_id);
  const [note, setNote] = useState('');
  const isRecipient = actorId !== null && actorId === transfer.to_investigator_id;
  const canCancel = actorId !== null && (actorId === transfer.initiated_by_id || isLead);
  const act = (verb: 'accept' | 'reject' | 'cancel') => resolve.mutate({ id: transfer.id, verb, note: note.trim() });
  return (
    <div className="rounded-md border border-warn/50 bg-warn/5 p-3 space-y-2" data-testid="pending-transfer">
      <div className="flex flex-wrap items-center gap-2 text-body">
        <span className={`${tagClass} ${TRANSFER_STATUS.PENDING}`}>Pending</span>
        <span className="text-ink">
          {who(transfer.from_investigator_id, transfer.from_name)} <ArrowRight className="inline size-3.5 text-ink-muted" aria-label="to" />{' '}
          {who(transfer.to_investigator_id, transfer.to_name)}
        </span>
        <span className="ml-auto font-mono text-2xs text-ink-muted">{formatDateTime(transfer.created_at)}</span>
      </div>
      <p className="text-xs text-ink-muted">
        Started by {who(transfer.initiated_by_id, transfer.initiated_by_name)}. Custody moves only when the recipient accepts.
        {transfer.reason && <> Reason: “{transfer.reason}”</>}
      </p>
      {(isRecipient || canCancel) && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} !w-auto min-w-48 flex-1`}
            placeholder="Note (optional)"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note for this transfer"
          />
          {isRecipient && (
            <>
              <button className={smallButtonClass} onClick={() => act('accept')} disabled={resolve.isPending}>
                <CheckCircle2 className="size-3.5" aria-hidden /> Accept receipt
              </button>
              <button className={smallButtonClass} onClick={() => act('reject')} disabled={resolve.isPending}>
                <XCircle className="size-3.5" aria-hidden /> Reject
              </button>
            </>
          )}
          {canCancel && !isRecipient && (
            <button className={smallButtonClass} onClick={() => act('cancel')} disabled={resolve.isPending}>
              <Undo2 className="size-3.5" aria-hidden /> Cancel transfer
            </button>
          )}
        </div>
      )}
      {resolve.isError && <ErrorState error={resolve.error} />}
    </div>
  );
};

const Timeline: React.FC<{ history: CustodyHistory }> = ({ history }) => {
  if (!history.events.length) {
    return <EmptyState title="No custody events" message="This item has no recorded custody history." />;
  }
  return (
    <section className="space-y-2" aria-label="Custody timeline">
      <h3 className="text-xs font-medium uppercase tracking-wider text-ink-muted">Timeline · oldest first</h3>
      <ol className="relative space-y-3 border-l border-line pl-5">
        {history.events.map((e) => (
          <TimelineEvent key={e.id} event={e} />
        ))}
      </ol>
    </section>
  );
};

const TimelineEvent: React.FC<{ event: CustodyEvent }> = ({ event: e }) => {
  const a = ACTIONS[e.action];
  const Icon = a.icon;
  const parties = e.action === 'TRANSFERRED' || e.action === 'RECEIVED' || e.action.startsWith('TRANSFER_');
  const result = e.integrity_result ? RESULT[e.integrity_result] : null;
  return (
    <li className="relative" data-testid="custody-event">
      <span className="absolute -left-[1.85rem] top-0.5 grid size-5 place-items-center rounded-full border border-line-strong bg-surface">
        <Icon className={`size-3 ${a.tone}`} aria-hidden />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`text-body font-medium ${a.tone}`}>{a.label}</span>
        {e.transfer_status && <span className={`${tagClass} ${TRANSFER_STATUS[e.transfer_status]}`}>{e.transfer_status.toLowerCase()}</span>}
        {result && <span className={`${tagClass} border-current ${result.tone}`}>{result.label}</span>}
        <time className="ml-auto font-mono text-2xs text-ink-muted" dateTime={e.at}>
          {formatDateTime(e.at)}
        </time>
      </div>
      <p className="text-xs text-ink-soft">By {who(e.actor_id, e.actor_name)}</p>
      {parties && (
        <p className="text-xs text-ink-soft">
          {who(e.from_custodian_id, e.from_custodian_name)} <ArrowRight className="inline size-3 text-ink-muted" aria-label="to" />{' '}
          {who(e.to_custodian_id, e.to_custodian_name)}
        </p>
      )}
      {e.action === 'REGISTERED' && e.to_custodian_name && <p className="text-xs text-ink-soft">Custodian: {e.to_custodian_name}</p>}
      {e.note && <p className="mt-0.5 text-xs text-ink-muted">“{e.note}”</p>}
      {(e.action === 'REGISTERED' || e.action === 'INTEGRITY_CHECKED') && (
        <p className="mt-0.5 font-mono text-2xs text-ink-faint break-all">
          {e.action === 'REGISTERED' ? 'SHA-256 ' : 'Computed '}
          {e.sha256 ?? '—'}
        </p>
      )}
    </li>
  );
};

const TransferDialog: React.FC<{ evidence: EvidenceDetail; history: CustodyHistory; eligibleIds: Id[]; onClose: () => void }> = ({
  evidence,
  history,
  eligibleIds,
  onClose
}) => {
  const investigators = useInvestigators();
  const start = useStartTransfer(evidence.id, evidence.case_id);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [recipientId, setRecipientId] = useState<Id | ''>('');
  const [reason, setReason] = useState('');
  const eligible = (investigators.data ?? []).filter((i) => eligibleIds.includes(i.id));
  const recipient = eligible.find((i) => i.id === recipientId);

  const footer =
    step === 'form' ? (
      <>
        <button className={secondaryButtonClass} onClick={onClose}>
          Cancel
        </button>
        <button className={primaryButtonClass} disabled={!recipient} onClick={() => setStep('review')}>
          Review transfer
        </button>
      </>
    ) : (
      <>
        <button className={secondaryButtonClass} onClick={() => setStep('form')} disabled={start.isPending}>
          Back
        </button>
        <button
          className={primaryButtonClass}
          disabled={start.isPending || !recipient}
          onClick={() => start.mutate({ to_investigator_id: recipient!.id, reason: reason.trim() }, { onSuccess: onClose })}
        >
          {start.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Confirm transfer
        </button>
      </>
    );

  return (
    <Dialog open title="Transfer custody" onClose={onClose} busy={start.isPending} footer={footer}>
      {step === 'form' ? (
        <div className="space-y-3">
          <p className="text-body text-ink-soft">
            The recipient must accept before custody moves. Until then {history.custodian?.name ?? 'nobody'} remains the custodian.
          </p>
          {investigators.isPending && <LoadingState label="Loading investigators…" />}
          {investigators.isError && <ErrorState error={investigators.error} onRetry={() => investigators.refetch()} />}
          {investigators.data && (
            <div>
              <label htmlFor="transfer-recipient" className={labelClass}>
                Recipient
              </label>
              <select
                id="transfer-recipient"
                className={selectClass}
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Choose an investigator on this case…</option>
                {eligible.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.role ? ` · ${i.role}` : ''}
                  </option>
                ))}
              </select>
              {eligible.length === 0 && <p className="mt-1 text-xs text-warn">No other investigator is assigned to this case.</p>}
            </div>
          )}
          <div>
            <label htmlFor="transfer-reason" className={labelClass}>
              Reason (optional)
            </label>
            <textarea
              id="transfer-reason"
              className={`${inputClass} min-h-20`}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Such as: for speed analysis by the reconstruction team"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-body">
            <dt className="text-ink-muted">Evidence</dt>
            <dd className="text-ink">{evidence.title}</dd>
            <dt className="text-ink-muted">From</dt>
            <dd className="text-ink">{history.custodian?.name ?? 'Nobody (assigning custody)'}</dd>
            <dt className="text-ink-muted">To</dt>
            <dd className="text-ink">{recipient?.name}</dd>
            <dt className="text-ink-muted">Reason</dt>
            <dd className="text-ink-soft">{reason.trim() || '—'}</dd>
          </dl>
          <p className="text-xs text-ink-muted">This is recorded in the chain of custody with your name and the server’s time, and can’t be edited later.</p>
          {start.isError && <ErrorState error={start.error} />}
        </div>
      )}
    </Dialog>
  );
};

const AnalysisDialog: React.FC<{ evidence: EvidenceDetail; onClose: () => void }> = ({ evidence, onClose }) => {
  const record = useRecordAnalysis(evidence.id, evidence.case_id);
  const [note, setNote] = useState('');
  return (
    <Dialog
      open
      title="Record analysis"
      onClose={onClose}
      busy={record.isPending}
      footer={
        <>
          <button className={secondaryButtonClass} onClick={onClose} disabled={record.isPending}>
            Cancel
          </button>
          <button className={primaryButtonClass} disabled={record.isPending || !note.trim()} onClick={() => record.mutate(note.trim(), { onSuccess: onClose })}>
            {record.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Record
          </button>
        </>
      }
    >
      <label htmlFor="analysis-note" className={labelClass}>
        What was examined, and what was found
      </label>
      <textarea id="analysis-note" className={`${inputClass} min-h-24`} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      {record.isError && <ErrorState error={record.error} />}
    </Dialog>
  );
};
