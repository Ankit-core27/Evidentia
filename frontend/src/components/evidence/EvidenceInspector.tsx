import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ExternalLink, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { ProcessingBadge } from '@/components/shared/Badges';
import { inputClass, labelClass, primaryButtonClass } from '@/components/shared/formStyles';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { useCaseWorkspace } from '@/hooks/useCases';
import { useEvidenceDetail, useReprocessEvidence, useUpdateEvidence } from '@/hooks/useEvidence';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { useObservations } from '@/hooks/useReview';
import { fileUrl } from '@/lib/api';
import { casePath } from '@/lib/caseModules';
import { recordLabel } from '@/lib/recordNames';
import { AUDIT_ACTION_STYLES, describeAuditDetail } from '@/lib/audit';
import { formatBytes, formatDateTime, humanize } from '@/lib/format';
import { EVIDENCE_TYPES } from '@/lib/options';
import { CaseModule } from '@/types';
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Evidence inspector"
        className="w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col font-mono"
      >
        {query.data ? (
          // Keyed so tabs and forms reset when another item opens.
          <InspectorBody key={query.data.id} evidence={query.data} passage={passage} onClose={close} />
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex justify-end">
              <button onClick={close} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800" aria-label="Close inspector">
                <X className="w-4 h-4" />
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
  const { icon: Icon, colour } = EVIDENCE_ICONS[evidence.type];
  const downloadUrl = fileUrl(evidence.id, { download: true });
  const canReprocess = evidence.processing_status === 'failed' || evidence.processing_status === 'done';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'text', label: 'Text' },
    { id: 'details', label: 'Details' },
    { id: 'links', label: `Linked records (${evidence.links.length})` },
    { id: 'custody', label: `Custody (${evidence.custody.length})` }
  ];

  return (
    <>
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
              <Icon className={`w-5 h-5 ${colour}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-100 break-words">{evidence.title}</h2>
              <p className="text-[11px] text-slate-400">
                {evidence.case_number} • {humanize(evidence.type)} • {formatBytes(evidence.size_bytes)} • {evidence.mime_type}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 shrink-0" aria-label="Close inspector">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <ProcessingBadge status={evidence.processing_status} />
          <span className="flex items-center gap-1 text-[10px] text-slate-400" title={evidence.sha256}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SHA-256 {evidence.sha256.slice(0, 16)}…
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canReprocess && (
              <button
                onClick={() => reprocess.mutate(evidence.id)}
                disabled={reprocess.isPending}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] flex items-center gap-1 disabled:opacity-50"
              >
                {reprocess.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Reprocess
              </button>
            )}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={evidence.title}
                className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Download
              </a>
            )}
          </div>
        </div>
        {reprocess.isError && <p className="text-[11px] text-red-300">{(reprocess.error as Error).message}</p>}

        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap ${
                tab === t.id ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4" role="tabpanel">
        {evidence.summary && tab !== 'details' && (
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-100">
            <span className="text-[10px] text-cyan-400 font-bold uppercase block mb-1">Summary</span>
            {evidence.summary}
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
  useEffect(() => markRef.current?.scrollIntoView({ block: 'center' }), [range?.[0]]);

  if (!text) {
    return <p className="text-xs text-slate-500">No text has been extracted from this file.</p>;
  }
  return (
    <div className="space-y-2">
      {passage && !range && <p className="text-[11px] text-amber-300">The cited passage was not found in the extracted text.</p>}
      <pre className="whitespace-pre-wrap text-xs text-slate-200 leading-relaxed p-4 rounded-xl border border-slate-800 bg-slate-950">
        {range ? (
          <>
            {text.slice(0, range[0])}
            <mark ref={markRef} className="bg-amber-400/30 text-amber-100 rounded px-0.5" data-testid="cited-passage">
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
      <dl className="grid grid-cols-2 gap-3 text-xs">
        {[
          ['Case', `${evidence.case_number} — ${evidence.case_title}`],
          ['Collected', formatDateTime(evidence.collected_at)],
          ['Uploaded', formatDateTime(evidence.created_at)],
          ['Source', evidence.source || '—'],
          ['Size', `${formatBytes(evidence.size_bytes)} (${evidence.size_bytes.toLocaleString()} bytes)`],
          ['Type of file', evidence.mime_type]
        ].map(([label, value]) => (
          <div key={label} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <dt className="text-[10px] text-slate-500 uppercase">{label}</dt>
            <dd className="text-slate-200 break-words">{value}</dd>
          </div>
        ))}
        <div className="col-span-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
          <dt className="text-[10px] text-slate-500 uppercase">SHA-256</dt>
          <dd className="text-slate-200 break-all text-[11px]" data-testid="evidence-sha256">
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
            <select id="evidence-type" value={type} onChange={(e) => setType(e.target.value as EvidenceType)} className={inputClass}>
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
            {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save details
          </button>
          {update.isSuccess && !dirty && <span className="text-[11px] text-emerald-300">Saved.</span>}
          {update.isError && <span className="text-[11px] text-red-300">{(update.error as Error).message}</span>}
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
    return <p className="text-xs text-slate-500">No records cite this evidence yet.</p>;
  }

  const describe = (link: EvidenceLink) => recordLabel(workspace, link.target_type, link.target_id, observations);

  return (
    <ul className="space-y-2">
      {evidence.links.map((link) => {
        const module = MODULE_FOR[link.target_type];
        return (
          <li key={link.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-[10px] text-cyan-400 uppercase mr-2">{humanize(link.target_type)}</span>
                <span className="text-slate-200">{describe(link)}</span>
              </span>
              {module && (
                <button
                  onClick={() => navigate(casePath(evidence.case_id, module))}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            {link.passage && <p className="text-[11px] text-slate-400 italic">"{link.passage}"</p>}
          </li>
        );
      })}
    </ul>
  );
};

// ---------------------------------------------------------------------------

const CustodyLedger: React.FC<{ entries: AuditEntry[] }> = ({ entries }) => {
  if (!entries.length) return <p className="text-xs text-slate-500">No custody entries.</p>;
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="space-y-2">
      {sorted.map((entry) => (
        <li key={entry.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex gap-3">
          <span className={`px-2 py-0.5 h-fit rounded text-[10px] font-bold border ${AUDIT_ACTION_STYLES[entry.action]}`}>
            {humanize(entry.action)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between gap-2">
              <span className="text-slate-200 font-bold">{entry.actor_name ?? 'Unknown investigator'}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{formatDateTime(entry.at)}</span>
            </div>
            {entry.detail && <p className="text-[11px] text-slate-400 mt-0.5 break-words">{describeAuditDetail(entry)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};
