import React from 'react';
import { Activity } from 'lucide-react';
import { ForensicCase } from '@/types';
import { AnatomicalViewer } from './AnatomicalViewer';

interface AutopsyModuleProps {
  forensicCase: ForensicCase;
}

export const AutopsyModule: React.FC<AutopsyModuleProps> = ({ forensicCase }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            3D Autopsy & Medical Examiner Findings
          </h2>
          <p className="text-xs text-slate-400">
            Interactive body mannequin viewer, pathology notes, and toxicological chromatography.
          </p>
        </div>
      </div>

      <div className="h-[600px]">
        <AnatomicalViewer injuries={forensicCase.injuries} />
      </div>
    </div>
  );
};
