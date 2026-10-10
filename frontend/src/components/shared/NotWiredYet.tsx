import React from 'react';
import { Construction } from 'lucide-react';

/** Placeholder for a workspace module whose API wiring lands in a later task (docs/FRONTEND_TASKS.md). */
export const NotWiredYet: React.FC<{ module: string; task: string }> = ({ module, task }) => (
  <div className="p-8 rounded-2xl bg-slate-900/60 border border-dashed border-slate-700 text-center font-mono space-y-2 max-w-xl">
    <Construction className="w-6 h-6 text-amber-400 mx-auto" />
    <h2 className="text-sm font-bold text-slate-200">{module} is not connected to the API yet</h2>
    <p className="text-xs text-slate-400">It is wired in {task} of the frontend task plan.</p>
  </div>
);
