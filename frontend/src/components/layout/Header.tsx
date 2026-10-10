import React, { useRef, useState } from 'react';
import { Link, NavLink, useMatch, useNavigate } from 'react-router-dom';
import {
  Bell,
  Plus,
  X,
  ShieldAlert,
  Shield,
  ChevronRight,
  FolderKanban,
  Fingerprint,
  Cpu,
  LayoutDashboard,
  ChevronDown
} from 'lucide-react';
import { CaseModule } from '@/types';
import { Alert } from '@/types/api';
import { CaseStatusBadge } from '@/components/shared/Badges';
import { useAlerts } from '@/hooks/useDashboard';
import { useCase, useCases } from '@/hooks/useCases';
import { useClickOutside } from '@/hooks/useClickOutside';
import { caseModuleLabel, casePath, parseCaseId } from '@/lib/caseModules';
import { formatDateTime } from '@/lib/format';
import { GlobalCaseSearch } from './GlobalCaseSearch';
import { InvestigatorPicker } from './InvestigatorPicker';

interface HeaderProps {
  activeModule: CaseModule;
  onOpenCreateModal: () => void;
}

const MACRO_TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/cases', label: 'Cases Directory', icon: FolderKanban },
  { to: '/evidence', label: 'Global Evidence', icon: Fingerprint },
  { to: '/reports', label: 'Intelligence Hub', icon: Cpu }
];

/** The workspace module an alert should open. */
const alertModule = (alert: Alert): CaseModule => (alert.record_type === 'evidence' ? 'evidence' : 'overview');

const SEVERITY_DOT: Record<Alert['severity'], string> = {
  info: 'bg-cyan-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-500'
};

export const Header: React.FC<HeaderProps> = ({ activeModule, onOpenCreateModal }) => {
  const navigate = useNavigate();
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);
  const caseSelectorRef = useRef<HTMLDivElement>(null);
  useClickOutside(alertsRef, () => setShowAlertsMenu(false), showAlertsMenu);
  useClickOutside(caseSelectorRef, () => setShowCaseSelector(false), showCaseSelector);

  // The open case comes from the URL. Numeric IDs are API cases; anything else is a
  // case from the UI draft's mock data, until every screen reads from the API.
  const workspaceMatch = useMatch('/cases/:caseId/:module?');
  const routeCaseId = workspaceMatch?.params.caseId;
  const apiCaseId = parseCaseId(routeCaseId);
  const { data: apiCase } = useCase(apiCaseId ?? undefined);
  const caseLabel = apiCaseId !== null ? (apiCase?.case_number ?? '…') : routeCaseId;

  const { data: allCases } = useCases({}, { enabled: showCaseSelector });
  const { data: alerts } = useAlerts();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40 font-mono">
      {/* LEFT SECTION: Logo or Workspace Breadcrumb */}
      <div className="flex items-center gap-4 lg:gap-6 shrink-0">
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity focus:outline-none"
        >
          <div className="w-8 h-8 rounded bg-cyan-600 text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(8,145,178,0.4)]">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-sm text-slate-100 tracking-wider uppercase font-mono leading-tight">
              FORENSIX
            </span>
          </div>
        </Link>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

        {/* NAVIGATION / BREADCRUMBS */}
        {routeCaseId ? (
          /* Case Workspace Breadcrumbs */
          <div className="flex items-center gap-2 text-xs font-mono">
            <Link
              to="/cases"
              className="text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Cases</span>
            </Link>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

            {/* Case Picker Selector Dropdown */}
            <div className="relative" ref={caseSelectorRef}>
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1.5 hover:bg-cyan-500/20 transition-all"
                aria-haspopup="listbox"
                aria-expanded={showCaseSelector}
              >
                <span>{caseLabel}</span>
                <ChevronDown className="w-3 h-3 text-cyan-400" />
              </button>

              {showCaseSelector && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block px-2 py-1 border-b border-slate-800">
                    Switch Active Case
                  </span>
                  <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
                    {!allCases && <div className="p-2 text-xs text-slate-500">Loading cases…</div>}
                    {allCases?.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          navigate(casePath(c.id));
                          setShowCaseSelector(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-between gap-2 ${
                          c.id === apiCaseId
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">
                          {c.case_number} · {c.title}
                        </span>
                        <CaseStatusBadge status={c.status} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

            <span className="text-slate-200 font-bold px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs">
              {caseModuleLabel(activeModule)}
            </span>
          </div>
        ) : (
          /* Top Navigation Bar Tabs for Macro Agency Views */
          <nav className="hidden md:flex items-center gap-1 text-xs font-mono">
            {MACRO_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-slate-800 text-cyan-400 border border-slate-700 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>

      {/* CENTER SECTION: Global Search Input */}
      <div className="hidden lg:flex items-center gap-3 flex-1 min-w-[14rem] max-w-md mx-6">
        <GlobalCaseSearch />
      </div>

      {/* RIGHT SECTION: Action Buttons & User Profile */}
      <div className="flex items-center gap-3 shrink-0 font-mono">
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
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setShowAlertsMenu(!showAlertsMenu)}
            id="alerts-bell-btn"
            aria-label={`Alerts (${alerts?.length ?? 0})`}
            className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {!!alerts?.length && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </button>

          {showAlertsMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <span className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  Alerts ({alerts?.length ?? 0})
                </span>
                <button
                  onClick={() => setShowAlertsMenu(false)}
                  className="text-slate-500 hover:text-slate-300"
                  aria-label="Close alerts"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
                {alerts?.length === 0 && <div className="p-2 text-xs text-slate-500">No alerts.</div>}
                {alerts?.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => {
                      navigate(casePath(alert.case_id, alertModule(alert)));
                      setShowAlertsMenu(false);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
                        {alert.title}
                      </span>
                      <span className="text-[10px] text-cyan-400 shrink-0">{alert.case_number}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{alert.message}</p>
                    <span className="text-[10px] text-slate-500">{formatDateTime(alert.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <InvestigatorPicker />
      </div>
    </header>
  );
};
