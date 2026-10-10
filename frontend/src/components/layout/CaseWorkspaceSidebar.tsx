import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CaseModule } from '@/types';
import { CASE_MODULES, casePath } from '@/lib/caseModules';

interface CaseWorkspaceSidebarProps {
  caseId: string | number;
  caseNumber: string;
  title: string;
  priority: string;
  activeModule: CaseModule;
  badges?: Partial<Record<CaseModule, string | number>>;
}

export const CaseWorkspaceSidebar: React.FC<CaseWorkspaceSidebarProps> = ({
  caseId,
  caseNumber,
  title,
  priority,
  activeModule,
  badges = {}
}) => {
  const modulesList = CASE_MODULES.filter((m) => !m.hidden || m.id === activeModule).map((m) => ({
    ...m,
    badge: badges[m.id]
  }));

  return (
    <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-30 font-mono select-none">
      {/* Top Case ID & Return Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60">
        <Link
          to="/cases"
          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 text-xs flex items-center gap-2 transition-all mb-2"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span>Exit to Cases Directory</span>
        </Link>

        <div className="px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Active Workspace
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
              {priority}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-100 mt-0.5 truncate">{caseNumber}</div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">{title}</div>
        </div>
      </div>

      {/* Module Navigation Item List */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Case modules">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-3 py-1.5">
          Case Modules
        </div>

        {modulesList.map((m) => {
          const Icon = m.icon;
          const isActive = activeModule === m.id;

          return (
            <Link
              key={m.id}
              to={casePath(caseId, m.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all group ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="truncate">{m.label}</span>
              </div>

              {m.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-md font-bold shrink-0 ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950'
                      : m.badge === 'AI'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {m.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
