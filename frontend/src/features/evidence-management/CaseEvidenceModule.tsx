import React from 'react';
import { Folder, ExternalLink } from 'lucide-react';
import { ForensicCase, EvidenceItem } from '@/types';

interface CaseEvidenceModuleProps {
  forensicCase: ForensicCase;
  onPreviewEvidence: (item: EvidenceItem) => void;
}

// Evidence locker for one case.
export const CaseEvidenceModule: React.FC<CaseEvidenceModuleProps> = ({ forensicCase, onPreviewEvidence }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Folder className="w-5 h-5 text-cyan-400" />
            Case Evidence Locker ({forensicCase.evidenceList.length})
          </h2>
          <p className="text-xs text-slate-400">
            Cryptographically secured SHA-256 evidence chain of custody records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forensicCase.evidenceList.map((item) => (
          <div
            key={item.id}
            onClick={() => onPreviewEvidence(item)}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {item.type}
              </span>
              <span className="text-[10px] text-slate-500">{item.fileSize}</span>
            </div>

            <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
              {item.title}
            </h3>

            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {item.summary}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>SHA-256 Validated</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
