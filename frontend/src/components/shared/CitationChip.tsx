import React from 'react';
import { Citation } from '@/types/api';

/** A source reference, numbered like a footnote. Clicking opens the evidence at that passage. */
export const CitationChip: React.FC<{
  citation: Pick<Citation, 'evidence_id' | 'evidence_title' | 'page'>;
  index?: number;
  onOpen: () => void;
}> = ({ citation, index, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    title={`Open ${citation.evidence_title}`}
    className="group inline-flex items-baseline gap-1.5 max-w-full text-left text-xs text-accent-text"
  >
    {index !== undefined && <span className="font-mono text-2xs text-ink-muted">[{index}]</span>}
    <span className="truncate group-hover:underline underline-offset-2">{citation.evidence_title}</span>
    {citation.page !== null && <span className="font-mono text-2xs text-ink-muted shrink-0">p.{citation.page}</span>}
  </button>
);
