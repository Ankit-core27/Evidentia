import React from 'react';
import {
  LayoutDashboard,
  FolderSearch,
  Fingerprint,
  FileSpreadsheet,
  PlusCircle,
  Shield,
  Activity,
  Cpu,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentView: 'dashboard' | 'cases' | 'case-detail' | 'evidence' | 'reports';
  onViewChange: (view: 'dashboard' | 'cases' | 'case-detail' | 'evidence' | 'reports') => void;
  onOpenCreateModal: () => void;
  selectedCaseId?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  onOpenCreateModal,
  selectedCaseId,
  isCollapsed,
  onToggleCollapse
}) => {
  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined
    },
    {
      id: 'cases' as const,
      label: 'Cases Index',
      icon: FolderSearch,
      badge: '18 Active'
    },
    {
      id: 'case-detail' as const,
      label: 'Deep Analysis',
      icon: Activity,
      badge: selectedCaseId ? selectedCaseId.split('-')[2] || 'Active' : 'Select',
      disabled: !selectedCaseId
    },
    {
      id: 'evidence' as const,
      label: 'Evidence Locker',
      icon: Fingerprint,
      badge: '1.2 TB'
    },
    {
      id: 'reports' as const,
      label: 'Reports Generator',
      icon: FileSpreadsheet,
      badge: undefined
    }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-950/50 border-r border-slate-800 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Brand Logo Header */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex items-center justify-center w-8 h-8 rounded bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)] shrink-0">
              <Shield className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-slate-100 tracking-tight truncate uppercase font-mono">
                  AEGIS <span className="text-cyan-400">FORENSICS</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                  NEXUS COMMAND v4.2
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            id="sidebar-toggle-btn"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Action - Create Case */}
        <div className="p-3">
          <button
            onClick={onOpenCreateModal}
            id="sidebar-create-case-btn"
            className={`w-full py-2.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all duration-200 active:scale-[0.98] ${
              isCollapsed ? 'px-0' : ''
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate font-mono tracking-wide uppercase">+ New Case</span>}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Main Command
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isDisabled = item.disabled;

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && onViewChange(item.id)}
                disabled={isDisabled}
                id={`nav-item-${item.id}`}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed text-slate-600'
                    : isActive
                    ? 'bg-slate-800/50 text-cyan-400 border border-slate-700/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate font-mono">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status Panel */}
      <div className="p-3 border-t border-slate-800/80">
        {!isCollapsed ? (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                NEURAL CORE
              </span>
              <span className="text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full w-[82%] rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>GPU LOAD: 34%</span>
              <span>120 TFLOPS</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center p-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" title="Neural Core: ONLINE" />
          </div>
        )}
      </div>
    </aside>
  );
};
