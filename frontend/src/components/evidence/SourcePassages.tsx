import React from 'react';
import { Evidence, EvidenceLink, Id, RecordType } from '@/types/api';

interface SourcePassagesProps {
  links: EvidenceLink[];
  evidence: Pick<Evidence, 'id' | 'title'>[];
  targetType: RecordType;
  targetId: Id;
  /** Opens the evidence at the passage. */
  onOpenEvidence?: (evidenceId: Id, passage: string | null) => void;
}

/**
 * The evidence passages a record came from (evidence_links), set like a quotation with its
 * source underneath. This is how every claim in the app points back to its evidence.
 */
export const SourcePassages: React.FC<SourcePassagesProps> = ({ links, evidence, targetType, targetId, onOpenEvidence }) => {
  const sources = links.filter((l) => l.target_type === targetType && l.target_id === targetId);
  if (!sources.length) return null;
  return (
    <div className="space-y-1.5">
      {sources.map((link) => {
        const title = evidence.find((e) => e.id === link.evidence_id)?.title ?? `Evidence #${link.evidence_id}`;
        const body = (
          <>
            {link.passage && <span className="block italic text-ink-soft">“{link.passage}”</span>}
            <span className={`block text-xs ${onOpenEvidence ? 'text-accent-text group-hover:underline underline-offset-2' : 'text-ink-muted'}`}>
              {title}
            </span>
          </>
        );
        const className = 'block w-full text-left pl-3 border-l-2 border-line-strong text-body leading-snug';
        return onOpenEvidence ? (
          <button
            key={link.id}
            onClick={() => onOpenEvidence(link.evidence_id, link.passage)}
            className={`${className} group hover:border-accent/70 transition-colors`}
            title={`Open ${title} at this passage`}
          >
            {body}
          </button>
        ) : (
          <div key={link.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
};
