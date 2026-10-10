import React from 'react';
import { FileSpreadsheet, Download, Shield } from 'lucide-react';
import { ForensicCase } from '@/types';

interface CaseReportModuleProps {
  forensicCase: ForensicCase;
}

export const CaseReportModule: React.FC<CaseReportModuleProps> = ({ forensicCase }) => {
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            Official Forensic Dossier Generator
          </h2>
          <p className="text-xs text-slate-400">
            Generate court-admissible forensic summary dossiers signed by Lead Det. A. Sharma.
          </p>
        </div>

        <button
          onClick={() => alert(`Exporting Official Forensic Dossier for Case ${forensicCase.id}...`)}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          <Download className="w-3.5 h-3.5" />
          Export Executive PDF Report
        </button>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 font-mono">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">FORENSIX OFFICIAL FORENSIC SUMMARY</h3>
              <p className="text-[10px] text-slate-400">CASE ID: {forensicCase.id} • STATUS: {forensicCase.status}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Lead Investigator</span>
            <span className="text-cyan-400 font-bold">{forensicCase.leadInvestigator.name}</span>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            <strong>Executive Incident Summary:</strong> {forensicCase.description}
          </p>

          <p>
            <strong>Victim Findings:</strong> {forensicCase.victim?.name || 'Julian Vance'} confirmed deceased at {forensicCase.victim?.timeOfDeath || '2026-08-01 22:45 UTC'}. Cause of death identified as {forensicCase.victim?.causeOfDeath}.
          </p>

          <p>
            <strong>Suspect Contradictions:</strong> Touch DNA recovered from Swab #B-42 yields a 99.98% CODIS match to prime suspect Victor Vance. Disproved airport alibi via Cell Tower #409 telemetry.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Cryptographic Digest: SHA-256 Verified</span>
          <span>Signature: Det. A. Sharma [Badge #7091]</span>
        </div>
      </div>
    </div>
  );
};
