import React from 'react';

/** Placeholder for a workspace module whose API wiring lands in a later task (docs/FRONTEND_TASKS.md). */
export const NotWiredYet: React.FC<{ module: string; task: string }> = ({ module, task }) => (
  <div className="px-4 py-8 rounded-md border border-line bg-surface max-w-xl space-y-1">
    <h2 className="text-body font-semibold text-ink">{module} is not connected to the API yet</h2>
    <p className="text-xs text-ink-muted">It is wired in {task} of the frontend task plan.</p>
  </div>
);
