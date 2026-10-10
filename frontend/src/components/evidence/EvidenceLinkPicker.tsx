import React, { useState } from 'react';
import { Link2, Loader2, Quote, Search, X } from 'lucide-react';
import { inputClass, labelClass, smallButtonClass } from '@/components/shared/formStyles';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCreateEvidenceLink, useDeleteEvidenceLink } from '@/hooks/useEvidence';
import { useCaseSearch } from '@/hooks/useSearch';
import { Evidence, EvidenceLink, Id, RecordType } from '@/types/api';

interface EvidenceLinkPickerProps {
  caseId: Id;
  targetType: RecordType;
  targetId: Id;
  /** The case's evidence links (from the workspace). */
  links: EvidenceLink[];
  evidence: Pick<Evidence, 'id' | 'title'>[];
}

/**
 * Links evidence passages to a record (POST/DELETE /api/evidence-links), so the record
 * can show and open its sources. Passages come from case search, or are typed in.
 */
export const EvidenceLinkPicker: React.FC<EvidenceLinkPickerProps> = ({ caseId, targetType, targetId, links, evidence }) => {
  const create = useCreateEvidenceLink(caseId);
  const remove = useDeleteEvidenceLink(caseId);
  const current = links.filter((l) => l.target_type === targetType && l.target_id === targetId);

  const [evidenceId, setEvidenceId] = useState<Id | ''>('');
  const [passage, setPassage] = useState('');
  const [chunkId, setChunkId] = useState<Id | null>(null);
  const [term, setTerm] = useState('');
  const q = useDebouncedValue(term.trim(), 300);
  const search = useCaseSearch(caseId, q);
  const hits = (search.data ?? []).filter((h) => evidenceId === '' || h.evidence_id === evidenceId).slice(0, 6);

  const title = (id: Id) => evidence.find((e) => e.id === id)?.title ?? `Evidence #${id}`;

  const add = () => {
    if (evidenceId === '') return;
    create.mutate(
      { evidence_id: evidenceId, target_type: targetType, target_id: targetId, passage: passage.trim() || null, chunk_id: chunkId },
      {
        onSuccess: () => {
          setPassage('');
          setChunkId(null);
          setTerm('');
        }
      }
    );
  };

  return (
    <div className="space-y-3" data-testid="evidence-link-picker">
      <div className="space-y-1.5">
        <span className={labelClass}>Source evidence ({current.length})</span>
        {current.length === 0 && <p className="text-[11px] text-slate-500">No evidence linked yet.</p>}
        {current.map((link) => (
          <div key={link.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex gap-2">
            <Quote className="w-3 h-3 text-cyan-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {link.passage && <span className="text-slate-300 italic">"{link.passage}" </span>}
              <span className="text-cyan-400">— {title(link.evidence_id)}</span>
            </div>
            <button
              type="button"
              onClick={() => remove.mutate(link.id)}
              disabled={remove.isPending && remove.variables === link.id}
              className="p-0.5 rounded text-slate-500 hover:text-red-400 shrink-0"
              aria-label={`Unlink ${title(link.evidence_id)}`}
            >
              {remove.isPending && remove.variables === link.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-cyan-400" /> Link a passage
        </span>
        <select
          value={evidenceId}
          onChange={(e) => setEvidenceId(e.target.value ? Number(e.target.value) : '')}
          className={inputClass}
          aria-label="Evidence to link"
        >
          <option value="">Choose evidence, or search below…</option>
          {evidence.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search passages to pick one…"
            aria-label="Search passages to link"
            className={`${inputClass} pl-8`}
          />
        </div>
        {q && search.isPending && <p className="text-[11px] text-slate-500">Searching…</p>}
        {hits.length > 0 && (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {hits.map((hit) => (
              <li key={hit.chunk_id}>
                <button
                  type="button"
                  onClick={() => {
                    setEvidenceId(hit.evidence_id);
                    setPassage(hit.passage);
                    setChunkId(hit.chunk_id);
                  }}
                  className={`w-full text-left p-2 rounded-lg border text-[11px] ${
                    chunkId === hit.chunk_id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <span className="text-cyan-300">{hit.evidence_title}</span>
                  <span className="text-slate-400 line-clamp-2">{hit.passage}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          rows={2}
          value={passage}
          onChange={(e) => {
            setPassage(e.target.value);
            setChunkId(null);
          }}
          placeholder="Passage (optional): the exact words the record rests on"
          aria-label="Passage"
          className={`${inputClass} resize-none`}
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={add} disabled={evidenceId === '' || create.isPending} className={smallButtonClass}>
            {create.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Link evidence
          </button>
          {(create.isError || remove.isError) && (
            <span className="text-[11px] text-red-300">{((create.error ?? remove.error) as Error).message}</span>
          )}
        </div>
      </div>
    </div>
  );
};
