import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { Id } from '@/types/api';
import { AskPanel } from './AskPanel';
import { PassageSearch } from './PassageSearch';

/** AI Copilot: cited answers, and plain passage search for checking them. */
export const CopilotModule: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const [tab, setTab] = useState<'ask' | 'search'>('ask');

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-end justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            AI Copilot
          </h2>
          <p className="text-xs text-slate-400">
            Answers are drawn only from this case's evidence. Check each cited passage before relying on it.
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs" role="tablist">
          {(['ask', 'search'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap ${tab === t ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t === 'ask' ? 'Ask' : 'Search passages'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'ask' ? <AskPanel caseId={caseId} /> : <PassageSearch caseId={caseId} />}
    </div>
  );
};
