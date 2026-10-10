import React from 'react';
import { FileText } from 'lucide-react';
import { Citation } from '@/types/api';

/** A source passage reference. Clicking opens the evidence at that passage. */
export const CitationChip: React.FC<{
  citation: Pick<Citation, 'evidence_id' | 'evidence_title' | 'page'>;
  index?: number;
  onOpen: () => void;
}> = ({ citation, index, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    title={`Open ${citation.evidence_title}`}
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-[10px] font-mono max-w-[16rem]"
  >
    {index !== undefined && <span className="font-bold">[{index}]</span>}
    <FileText className="w-3 h-3 shrink-0" />
    <span className="truncate">{citation.evidence_title}</span>
    {citation.page !== null && <span className="text-cyan-400/70 shrink-0">p.{citation.page}</span>}
  </button>
);
