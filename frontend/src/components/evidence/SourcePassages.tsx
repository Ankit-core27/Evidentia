import React from 'react';
import { Quote } from 'lucide-react';
import { Evidence, EvidenceLink, Id, RecordType } from '@/types/api';

interface SourcePassagesProps {
  links: EvidenceLink[];
  evidence: Pick<Evidence, 'id' | 'title'>[];
  targetType: RecordType;
  targetId: Id;
  /** Opens the evidence at the passage. */
  onOpenEvidence?: (evidenceId: Id) => void;
}

/** The evidence passages a record came from (evidence_links), quoted with their source file. */
export const SourcePassages: React.FC<SourcePassagesProps> = ({ links, evidence, targetType, targetId, onOpenEvidence }) => {
  const sources = links.filter((l) => l.target_type === targetType && l.target_id === targetId);
  if (!sources.length) return null;
  return (
    <div className="space-y-1.5">
      {sources.map((link) => {
        const title = evidence.find((e) => e.id === link.evidence_id)?.title ?? `Evidence #${link.evidence_id}`;
        const body = (
          <>
            <Quote className="w-3 h-3 text-cyan-500 shrink-0 mt-0.5" />
            <span className="min-w-0">
              {link.passage && <span className="text-slate-300 italic">"{link.passage}" </span>}
              <span className="text-cyan-400 not-italic">— {title}</span>
            </span>
          </>
        );
        return onOpenEvidence ? (
          <button
            key={link.id}
            onClick={() => onOpenEvidence(link.evidence_id)}
            className="w-full text-left flex gap-1.5 text-[11px] p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40"
          >
            {body}
          </button>
        ) : (
          <div key={link.id} className="flex gap-1.5 text-[11px] p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
            {body}
          </div>
        );
      })}
    </div>
  );
};
