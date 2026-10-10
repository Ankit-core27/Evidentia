import React from 'react';
import { Share2 } from 'lucide-react';
import { ForensicCase } from '@/types';
import { NetworkGraphViewer } from './NetworkGraphViewer';

interface CanvasModuleProps {
  forensicCase: ForensicCase;
}

export const CanvasModule: React.FC<CanvasModuleProps> = ({ forensicCase }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-cyan-400" />
            Core Investigation Link Canvas
          </h2>
          <p className="text-xs text-slate-400">
            Interactive node map showing suspect motives, cell tower pings, DNA links, and evidence relationships.
          </p>
        </div>
      </div>

      <div className="h-[600px] rounded-2xl overflow-hidden border border-slate-800">
        <NetworkGraphViewer
          nodes={forensicCase.networkNodes}
          links={forensicCase.networkLinks}
        />
      </div>
    </div>
  );
};
