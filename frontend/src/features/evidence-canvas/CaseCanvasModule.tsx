import React from 'react';
import { Share2 } from 'lucide-react';
import { CaseWorkspace } from '@/types/api';
import { EvidenceCanvas } from './EvidenceCanvas';

/** The Investigation Canvas module of a case workspace. */
export const CaseCanvasModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => (
  <div className="space-y-4">
    <div className="pb-3 border-b border-slate-800">
      <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
        <Share2 className="w-5 h-5 text-cyan-400" />
        Investigation Canvas
      </h2>
      <p className="text-xs text-slate-400">
        People, vehicles, places and evidence, and how they connect. Dashed links are AI proposals until confirmed.
      </p>
    </div>
    <EvidenceCanvas workspace={workspace} />
  </div>
);
