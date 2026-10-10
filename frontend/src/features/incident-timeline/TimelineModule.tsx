import React, { useState } from 'react';
import { Clock, Zap } from 'lucide-react';
import { ForensicCase } from '@/types';

interface TimelineModuleProps {
  forensicCase: ForensicCase;
}

export const TimelineModule: React.FC<TimelineModuleProps> = ({ forensicCase }) => {
  // Timeline category filter
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>('ALL');

  const filteredTimeline =
    timelineCategoryFilter === 'ALL'
      ? forensicCase.timeline
      : forensicCase.timeline.filter((tl) => tl.category === timelineCategoryFilter);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Investigation Chronology Timeline
          </h2>
          <p className="text-xs text-slate-400">
            Chronological progression of crime events, cell tower pings, and autopsy findings.
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 text-xs">
          {['ALL', 'GPS', 'Autopsy', 'Witness', 'Telecom'].map((cat) => (
            <button
              key={cat}
              onClick={() => setTimelineCategoryFilter(cat)}
              className={`px-3 py-1 rounded-lg transition-colors ${
                timelineCategoryFilter === cat
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="relative pl-8 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-blue-500 before:to-slate-800">
        {filteredTimeline.map((tl) => (
          <div key={tl.id} className="relative group">
            <div
              className={`absolute -left-8 top-2 w-4 h-4 rounded-full border-2 transition-all ${
                tl.isAiFlagged
                  ? 'bg-cyan-400 border-slate-950 shadow-[0_0_12px_#06b6d4]'
                  : 'bg-slate-800 border-slate-600'
              }`}
            ></div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-400 font-bold uppercase">
                  {tl.timeDisplay} • {tl.category}
                </span>
                {tl.isAiFlagged && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> AI BREAKTHROUGH FLAG
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-slate-100">{tl.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{tl.description}</p>

              {tl.aiBreakthroughReason && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 mt-2">
                  <strong>AI INSIGHT:</strong> {tl.aiBreakthroughReason}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
