import React from 'react';
import { Settings as SettingsIcon, Lock } from 'lucide-react';

export const CaseSettings: React.FC = () => {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-cyan-400" />
            Case Access Controls & Security Settings
          </h2>
          <p className="text-xs text-slate-400">
            Manage clearance levels, cryptographically lock evidence, and grant investigator permissions.
          </p>
        </div>
      </div>

      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
          <div>
            <span className="font-bold text-slate-200 block">Clearance Level</span>
            <span className="text-[11px] text-slate-400">Level 5 Top Secret Required for Full Access</span>
          </div>
          <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
            LEVEL 5 (ACTIVE)
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
          <div>
            <span className="font-bold text-slate-200 block">SHA-256 Chain of Custody Integrity</span>
            <span className="text-[11px] text-slate-400">All 14 evidence items cryptographically signed</span>
          </div>
          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
            <Lock className="w-3 h-3" /> LOCKED
          </span>
        </div>
      </div>
    </div>
  );
};
