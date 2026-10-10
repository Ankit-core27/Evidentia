import React from 'react';
import { Link } from 'react-router-dom';
import { CASE_MODULE_GROUPS, CASE_MODULES, CaseModule, casePath } from '@/lib/caseModules';

interface CaseWorkspaceSidebarProps {
  caseId: string | number;
  activeModule: CaseModule;
  /** Counts shown beside each module. */
  badges?: Partial<Record<CaseModule, number>>;
  /** Modules whose count needs the investigator's attention. */
  attention?: Partial<Record<CaseModule, boolean>>;
}

/**
 * Module navigation for a case. A grouped sidebar from lg up; below that, one row of tabs
 * that scrolls sideways, so the workspace keeps the full width of a phone or tablet.
 */
export const CaseWorkspaceSidebar: React.FC<CaseWorkspaceSidebarProps> = ({ caseId, activeModule, badges = {}, attention = {} }) => {
  const visible = CASE_MODULES.filter((m) => !m.hidden || m.id === activeModule);

  return (
    <aside className="w-14 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-30 font-mono select-none md:w-64">
      {/* Top Case ID & Return Bar */}
      <div className="p-1.5 border-b border-slate-800 bg-slate-900/60 md:p-3">
        <Link
          to="/cases"
          aria-label="Exit to Cases Directory"
          className="w-full justify-center px-1.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 text-xs flex items-center gap-2 transition-all mb-2 md:justify-start md:px-2.5"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Exit to Cases Directory</span>
        </Link>

        <div className="hidden px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800/80 md:block">
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
      <nav className="flex-1 overflow-y-auto p-1 space-y-1 md:p-2" aria-label="Case modules">
        <div className="hidden text-[10px] text-slate-500 font-bold uppercase tracking-wider px-3 py-1.5 md:block">
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
              aria-label={m.label}
              title={m.label}
              className={`w-full justify-center px-1.5 py-2 rounded-lg text-xs font-medium flex items-center transition-all group md:justify-between md:px-3 md:rounded-xl ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="hidden truncate md:inline">{m.label}</span>
              </div>

              {m.badge !== undefined && (
                <span
                  className={`hidden px-2 py-0.5 text-[10px] rounded-md font-bold shrink-0 md:inline ${
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
      </div>
    </nav>
  );
};
