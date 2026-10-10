import React from 'react';
import { Zap } from 'lucide-react';
import { ForensicCase, CaseStatus } from '@/types';

interface CaseBannerProps {
  forensicCase: ForensicCase;
  onUpdateStatus: (caseId: string, newStatus: CaseStatus) => void;
}

// Top case banner: ID, status, priority, progress.
export const CaseBanner: React.FC<CaseBannerProps> = ({ forensicCase, onUpdateStatus }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 backdrop-blur-md">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-cyan-400 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
            {forensicCase.id}
          </span>

          {/* Status Selector */}
          <select
            value={forensicCase.status}
            onChange={(e) => onUpdateStatus(forensicCase.id, e.target.value as CaseStatus)}
            className="py-1 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="Forensic Testing">Forensic Testing</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Under Review">Under Review</option>
          </select>

          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
            {forensicCase.priority} PRIORITY
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-100 mt-2">
          {forensicCase.title}
        </h1>

        <p className="text-xs text-slate-400 mt-1">
          Location: {forensicCase.incidentLocation} • Created: {forensicCase.dateCreated} • Lead: {forensicCase.leadInvestigator.name}
        </p>
      </div>

      {/* AI Threat Score & Progress Bar */}
      <div className="flex items-center gap-4 shrink-0 font-mono">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold gap-4">
            <span>INVESTIGATION PROGRESS</span>
            <span className="text-cyan-400">{forensicCase.progressPercent || 78}% SOLVED</span>
          </div>
          <div className="w-40 h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
              style={{ width: `${forensicCase.progressPercent || 78}%` }}
            ></div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
          <div className="text-right">
            <span className="text-[10px] text-cyan-400 block font-bold uppercase">
              AI Confidence
            </span>
            <span className="text-sm font-bold text-cyan-200">
              {forensicCase.aiConfidenceScore}% Match
            </span>
          </div>
          <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
