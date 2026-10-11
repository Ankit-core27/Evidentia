import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, RotateCcw, X } from 'lucide-react';
import { ProcessingBadge } from '@/components/shared/Badges';
import { useFocusTrap } from '@/components/shared/Dialog';
import {
  iconButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass
} from '@/components/shared/formStyles';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { Tabs } from '@/components/shared/Segmented';
import { useCaseWorkspace } from '@/hooks/useCases';
import { useEvidenceDetail, useReprocessEvidence, useUpdateEvidence } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useObservations } from '@/hooks/useReview';
import { fileUrl } from '@/lib/api';
import { CaseModule, casePath } from '@/lib/caseModules';
import { recordLabel } from '@/lib/recordNames';
import { AUDIT_ACTION_STYLES, describeAuditDetail } from '@/lib/audit';
import { formatBytes, formatDateTime, humanize } from '@/lib/format';
import { EVIDENCE_TYPES } from '@/lib/options';
import { AuditEntry, EvidenceDetail, EvidenceLink, EvidenceType, RecordType } from '@/types/api';
import { EVIDENCE_ICONS } from './evidenceIcons';
import { EvidencePreview } from './EvidencePreview';

type Tab = 'preview' | 'text' | 'details' | 'links' | 'custody';

/**
 * The evidence inspector: a side drawer opened by ?evidence=<id> anywhere in the app.
 * Mounted once in AppLayout.
 */
export const EvidenceInspector: React.FC = () => {
  const { evidenceId, passage, close } = useEvidenceInspector();
  const query = useEvidenceDetail(evidenceId);
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, evidenceId !== null);

  useEffect(() => {
    if (evidenceId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [evidenceId, close]);

  if (evidenceId === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Evidence inspector"
        className="w-full max-w-3xl h-full bg-surface border-l border-line-strong shadow-overlay flex flex-col focus:outline-none"
      >
        {query.data ? (
          // Keyed so tabs and forms reset when another item opens.
          <InspectorBody key={query.data.id} evidence={query.data} passage={passage} onClose={close} />
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex justify-end">
              <button onClick={close} className={iconButtonClass} aria-label="Close inspector">
                <X className="size-4" />
              </button>
            </div>
            {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <LoadingState label="Loading evidence…" />}
          </div>
        )}
      </aside>
    </div>
  );
};

const InspectorBody: React.FC<{ evidence: EvidenceDetail; passage: string | null; onClose: () => void }> = ({
  evidence,
  passage,
  onClose
}) => {
  const [tab, setTab] = useState<Tab>(passage && evidence.extracted_text ? 'text' : 'preview');
  const reprocess = useReprocessEvidence();
  const Icon = EVIDENCE_ICONS[evidence.type].icon;
  const downloadUrl = fileUrl(evidence.id, { download: true });
  const canReprocess = evidence.processing_status === 'failed' || evidence.processing_status === 'done';

  const tabs = [
    { value: 'preview' as const, label: 'Preview' },
    { value: 'text' as const, label: 'Text' },
    { value: 'details' as const, label: 'Details' },
    { value: 'links' as const, label: 'Linked records', count: evidence.links.length },
    { value: 'custody' as const, label: 'Custody', count: evidence.custody.length }
  ];

  return (
    <>
      <div className="px-5 pt-4 border-b border-line space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Icon className="size-5 text-ink-muted shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink break-words">{evidence.title}</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                <span className="font-mono">{evidence.case_number}</span> · {humanize(evidence.type)} ·{' '}
                <span className="font-mono">{formatBytes(evidence.size_bytes)}</span> · {evidence.mime_type}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`${iconButtonClass} shrink-0`} aria-label="Close inspector">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <ProcessingBadge status={evidence.processing_status} />
          <span className="font-mono text-2xs text-ink-muted" title={evidence.sha256}>
            SHA-256 {evidence.sha256.slice(0, 16)}…
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canReprocess && (
              <button onClick={() => reprocess.mutate(evidence.id)} disabled={reprocess.isPending} className={secondaryButtonClass}>
                {reprocess.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reprocess
              </button>
            )}
            {downloadUrl && (
              <a href={downloadUrl} download={evidence.title} className={primaryButtonClass}>
                <Download className="size-3.5" aria-hidden /> Download
              </a>
            )}
          </div>
        </div>
        {reprocess.isError && <p className="text-xs text-danger">{(reprocess.error as Error).message}</p>}

        <Tabs label="Evidence views" options={tabs} value={tab} onChange={setTab} className="border-b-0 -mb-px" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4" role="tabpanel">
        {evidence.summary && tab !== 'details' && (
          <div className="pl-3 border-l-2 border-accent/60">
            <div className="text-xs font-medium text-ink-muted mb-0.5">Summary</div>
            <p className="text-body text-ink-soft">{evidence.summary}</p>
          </div>
        )}
        {tab === 'preview' && <EvidencePreview evidence={evidence} />}
        {tab === 'text' && <HighlightedText text={evidence.extracted_text} passage={passage} />}
        {tab === 'details' && <DetailsForm evidence={evidence} />}
        {tab === 'links' && <LinkedRecords evidence={evidence} />}
        {tab === 'custody' && <CustodyLedger entries={evidence.custody} />}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------

/** Finds the passage in the text, ignoring differences in whitespace and case. */
const findPassage = (text: string, passage: string): [number, number] | null => {
  const exact = text.indexOf(passage);
  if (exact >= 0) return [exact, exact + passage.length];
  const words = passage.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return null;
  const match = new RegExp(words.join('\\s+'), 'i').exec(text);
  return match ? [match.index, match.index + match[0].length] : null;
};

const HighlightedText: React.FC<{ text: string | null; passage: string | null }> = ({ text, passage }) => {
  const markRef = useRef<HTMLElement>(null);
  const range = text && passage ? findPassage(text, passage) : null;
  useEffect(() => {
    // Modern browsers may return a Promise; React only accepts a cleanup function.
    void markRef.current?.scrollIntoView({ block: 'center' });
  }, [range?.[0]]);

  if (!text) {
    return <p className="text-body text-ink-muted">No text has been extracted from this file.</p>;
  }
  return (
    <div className="space-y-2">
      {passage && !range && <p className="text-xs text-warn">The cited passage was not found in the extracted text.</p>}
      <pre className="whitespace-pre-wrap font-mono text-xs text-ink-soft leading-relaxed p-4 rounded-md border border-line bg-well">
        {range ? (
          <>
            {text.slice(0, range[0])}
            <mark ref={markRef} className="bg-warn/25 text-ink rounded-sm px-0.5 outline outline-1 outline-warn/50" data-testid="cited-passage">
              {text.slice(range[0], range[1])}
            </mark>
            {text.slice(range[1])}
          </>
        ) : (
          text
        )}
      </pre>
    </div>
  );
};

// ---------------------------------------------------------------------------

const DetailsForm: React.FC<{ evidence: EvidenceDetail }> = ({ evidence }) => {
  const update = useUpdateEvidence(evidence.id);
  const [type, setType] = useState<EvidenceType>(evidence.type);
  const [title, setTitle] = useState(evidence.title);
  const [description, setDescription] = useState(evidence.description);
  const [notes, setNotes] = useState(evidence.notes);
  const changes = Object.fromEntries(
    Object.entries({ type, title: title.trim(), description, notes }).filter(
      ([key, value]) => value !== evidence[key as keyof EvidenceDetail]
    )
  );
  const dirty = Object.keys(changes).length > 0;

  return (
    <div className="space-y-4">
      <dl className="rounded-md border border-line divide-y divide-line text-body">
        {(
          [
            ['Case', <><span className="font-mono">{evidence.case_number}</span> · {evidence.case_title}</>],
            ['Collected', <span className="font-mono">{formatDateTime(evidence.collected_at)}</span>],
            ['Uploaded', <span className="font-mono">{formatDateTime(evidence.created_at)}</span>],
            ['Source', evidence.source || '—'],
            ['Size', <span className="font-mono">{formatBytes(evidence.size_bytes)} ({evidence.size_bytes.toLocaleString()} bytes)</span>],
            ['Type of file', <span className="font-mono">{evidence.mime_type}</span>]
          ] as [string, React.ReactNode][]
        ).map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-ink break-words">{value}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2">
          <dt className="text-ink-muted">SHA-256</dt>
          <dd className="font-mono text-ink break-all text-xs" data-testid="evidence-sha256">
            {evidence.sha256}
          </dd>
        </div>
      </dl>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && title.trim()) update.mutate(changes);
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="evidence-type" className={labelClass}>
              Type
            </label>
            <select id="evidence-type" value={type} onChange={(e) => setType(e.target.value as EvidenceType)} className={selectClass}>
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="evidence-title" className={labelClass}>
              Title
            </label>
            <input id="evidence-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="evidence-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="evidence-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label htmlFor="evidence-notes" className={labelClass}>
            Investigator notes
          </label>
          <textarea
            id="evidence-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={!dirty || update.isPending || !title.trim()} className={primaryButtonClass}>
            {update.isPending && <Loader2 className="size-3.5 animate-spin" />} Save details
          </button>
          {update.isSuccess && !dirty && <span className="text-xs text-ok">Saved.</span>}
          {update.isError && <span className="text-xs text-danger">{(update.error as Error).message}</span>}
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------

const MODULE_FOR: Partial<Record<RecordType, CaseModule>> = {
  person: 'people',
  object: 'people',
  location: 'people',
  event: 'timeline',
  observation: 'review',
  conflict: 'review',
  relationship: 'canvas',
  injury: 'autopsy'
};

const LinkedRecords: React.FC<{ evidence: EvidenceDetail }> = ({ evidence }) => {
  const navigate = useNavigate();
  const { data: workspace } = useCaseWorkspace(evidence.links.length ? evidence.case_id : undefined);
  const needsObservations = evidence.links.some((l) => l.target_type === 'observation');
  const { data: observations } = useObservations(needsObservations ? evidence.case_id : undefined);

  if (!evidence.links.length) {
    return <p className="text-body text-ink-muted">No records cite this evidence yet.</p>;
  }

  const describe = (link: EvidenceLink) => recordLabel(workspace, link.target_type, link.target_id, observations);

  return (
    <ul className="rounded-md border border-line divide-y divide-line">
      {evidence.links.map((link) => {
        const module = MODULE_FOR[link.target_type];
        return (
          <li key={link.id} className="px-3 py-2.5 text-body space-y-1">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-2xs text-ink-muted">{humanize(link.target_type)}</span>
                <span className="text-ink">{describe(link)}</span>
              </span>
              {module && (
                <button onClick={() => navigate(casePath(evidence.case_id, module))} className="text-xs text-accent-text hover:underline shrink-0">
                  Open
                </button>
              )}
            </div>
            {link.passage && <p className="pl-3 border-l-2 border-line-strong text-body text-ink-soft italic">“{link.passage}”</p>}
          </li>
        );
      })}
    </ul>
  );
};

// ---------------------------------------------------------------------------

const CustodyLedger: React.FC<{ entries: AuditEntry[] }> = ({ entries }) => {
  if (!entries.length) return <p className="text-body text-ink-muted">No custody entries.</p>;
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="rounded-md border border-line divide-y divide-line">
      {sorted.map((entry) => (
        <li key={entry.id} className="px-3 py-2.5 grid grid-cols-[5.5rem_1fr] sm:grid-cols-[10rem_5.5rem_1fr] gap-x-3 gap-y-0.5 text-body">
          <span className="font-mono text-2xs text-ink-muted pt-0.5 col-span-2 sm:col-span-1">{formatDateTime(entry.at)}</span>
          <span className={`font-mono text-xs ${AUDIT_ACTION_STYLES[entry.action]}`}>{entry.action}</span>
          <div className="min-w-0">
            <span className="text-ink">{entry.actor_name ?? 'Unknown investigator'}</span>
            {entry.detail && <p className="text-xs text-ink-muted mt-0.5 break-words">{describeAuditDetail(entry)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};
