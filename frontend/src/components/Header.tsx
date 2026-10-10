import React, { useState } from 'react';
import {
  Search,
  Bell,
  Plus,
  Radio,
  X,
  ShieldAlert,
  Shield,
  ChevronRight,
  FolderKanban,
  Fingerprint,
  Cpu,
  LayoutDashboard,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { SystemAlert, ForensicCase, CaseModule } from '../types';

interface HeaderProps {
  macroView: 'dashboard' | 'cases' | 'evidence' | 'reports';
  onMacroViewChange: (view: 'dashboard' | 'cases' | 'evidence' | 'reports') => void;
  activeCase: ForensicCase | null;
  activeModule: CaseModule;
  onExitCaseWorkspace: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onOpenCreateModal: () => void;
  alerts: SystemAlert[];
  allCases: ForensicCase[];
  onSelectCase: (caseId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  macroView,
  onMacroViewChange,
  activeCase,
  activeModule,
  onExitCaseWorkspace,
  searchTerm,
  onSearchChange,
  onOpenCreateModal,
  alerts,
  allCases,
  onSelectCase
}) => {
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showCaseSelector, setShowCaseSelector] = useState(false);

  const getModuleName = (moduleKey: CaseModule) => {
    switch (moduleKey) {
      case 'overview':
        return 'Overview';
      case 'evidence':
        return 'Evidence Locker';
      case 'canvas':
        return 'Investigation Canvas';
      case 'timeline':
        return 'Timeline Chronology';
      case 'cctv':
        return 'CCTV Analysis';
      case 'autopsy':
        return 'Autopsy Findings';
      case 'crimescene':
        return 'Crime Scene Spatial';
      case 'phonerecords':
        return 'Phone Records & CDR';
      case 'gps':
        return 'GPS & Telemetry';
      case 'witnesses':
        return 'Witnesses & POIs';
      case 'copilot':
        return 'AI Forensic Copilot';
      case 'reports':
        return 'Official Dossiers';
      case 'settings':
        return 'Case Settings';
      default:
        return 'Overview';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40 font-mono">
      {/* LEFT SECTION: Logo or Workspace Breadcrumb */}
      <div className="flex items-center gap-4 lg:gap-6 shrink-0">
        {/* Brand Logo */}
        <button
          onClick={() => {
            onExitCaseWorkspace();
            onMacroViewChange('dashboard');
          }}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity focus:outline-none"
        >
          <div className="w-8 h-8 rounded bg-cyan-600 text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(8,145,178,0.4)]">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-sm text-slate-100 tracking-wider uppercase font-mono leading-tight">
              FORENSIX
            </span>
            <span className="text-[9px] text-cyan-400 tracking-widest uppercase font-mono">
              AI FORUM v5.0
            </span>
          </div>
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

        {/* NAVIGATION / BREADCRUMBS */}
        {activeCase ? (
          /* Case Workspace Breadcrumbs */
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={onExitCaseWorkspace}
              className="text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Cases</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

            {/* Case Picker Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1.5 hover:bg-cyan-500/20 transition-all"
              >
                <span>{activeCase.id}</span>
                <ChevronDown className="w-3 h-3 text-cyan-400" />
              </button>

              {showCaseSelector && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block px-2 py-1 border-b border-slate-800">
                    Switch Active Case
                  </span>
                  <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
                    {allCases.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelectCase(c.id);
                          setShowCaseSelector(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
                          c.id === activeCase.id
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{c.id}</span>
                        <span className="text-[9px] text-slate-500">{c.status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

            <span className="text-slate-200 font-bold px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs">
              {getModuleName(activeModule)}
            </span>
          </div>
        ) : (
          /* Top Navigation Bar Tabs for Macro Agency Views */
          <nav className="hidden md:flex items-center gap-1 text-xs font-mono">
            {[
              { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
              { id: 'cases', label: 'Cases Directory', icon: FolderKanban },
              { id: 'evidence', label: 'Global Evidence', icon: Fingerprint },
              { id: 'reports', label: 'Intelligence Hub', icon: Cpu }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = macroView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onMacroViewChange(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* CENTER SECTION: Global Search Input */}
      <div className="hidden lg:flex items-center gap-3 flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cases by ID, suspect name, DNA swab, or location..."
            className="w-full pl-10 pr-4 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
            id="global-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Action Buttons & User Profile */}
      <div className="flex items-center gap-3 shrink-0 font-mono">
        {/* Live System Pipeline Indicator */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>NEURAL PIPELINE ACTIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </div>

        {/* Primary "+ Create Case" Button */}
        <button
          onClick={onOpenCreateModal}
          id="header-create-case-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(8,145,178,0.3)] transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+ Create Case</span>
        </button>

        {/* Alerts Menu Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsMenu(!showAlertsMenu)}
            id="alerts-bell-btn"
            className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </button>

          {showAlertsMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <span className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  Forensic Intelligence ({alerts.length})
                </span>
                <button
                  onClick={() => setShowAlertsMenu(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      onSelectCase(alert.caseId);
                      setShowAlertsMenu(false);
                    }}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                        {alert.title}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {alert.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Badge: Det. A. Sharma */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/40 p-0.5 bg-slate-900 shrink-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
              alt="Det. A. Sharma"
              className="w-full h-full object-cover rounded"
            />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold text-slate-100 leading-tight">
              Det. A. Sharma
            </span>
            <span className="text-[9px] text-cyan-400 tracking-wider">
              LEVEL 5 LEAD
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
