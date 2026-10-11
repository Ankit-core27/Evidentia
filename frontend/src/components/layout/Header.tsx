import React, { useRef, useState } from 'react';
import { Link, NavLink, useMatch, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Plus } from 'lucide-react';
import { ALERT_SEVERITY_DOT, alertPath } from '@/lib/alerts';
import { CASE_STATUS_DOT } from '@/components/shared/Badges';
import { iconButtonClass, primaryButtonClass } from '@/components/shared/formStyles';
import { useAlerts } from '@/hooks/useDashboard';
import { useCase, useCases } from '@/hooks/useCases';
import { useClickOutside } from '@/hooks/useClickOutside';
import { isMockMode } from '@/lib/api';
import { CaseModule, caseModuleLabel, casePath, parseCaseId } from '@/lib/caseModules';
import { formatDateTime, humanize } from '@/lib/format';
import { GlobalCaseSearch } from './GlobalCaseSearch';
import { InvestigatorPicker } from './InvestigatorPicker';

interface HeaderProps {
  activeModule: CaseModule;
  onOpenCreateModal: () => void;
}

const MACRO_TABS = [
  { to: '/', label: 'Dashboard' },
  { to: '/cases', label: 'Cases' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/reports', label: 'Reports' }
];

const menuClass = 'absolute z-50 mt-1.5 bg-raised border border-line-strong rounded-lg shadow-overlay';

/** The Evidentia mark: the shield from the favicon. */
const BrandMark: React.FC = () => (
  <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
    <rect width="24" height="24" rx="5" className="fill-accent" />
    <path
      d="M12 5l5 2v4c0 3.5-2.2 6.4-5 7.5-2.8-1.1-5-4-5-7.5V7z"
      fill="none"
      className="stroke-accent-fg"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({ activeModule, onOpenCreateModal }) => {
  const navigate = useNavigate();
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);
  const caseSelectorRef = useRef<HTMLDivElement>(null);
  useClickOutside(alertsRef, () => setShowAlertsMenu(false), showAlertsMenu);
  useClickOutside(caseSelectorRef, () => setShowCaseSelector(false), showCaseSelector);

  // The open case comes from the URL; case IDs are integers.
  const workspaceMatch = useMatch('/cases/:caseId/:module?');
  const routeCaseId = workspaceMatch?.params.caseId;
  const apiCaseId = parseCaseId(routeCaseId);
  const { data: apiCase } = useCase(apiCaseId ?? undefined);
  const caseLabel = apiCaseId !== null ? (apiCase?.case_number ?? '…') : routeCaseId;

  const { data: allCases } = useCases({}, { enabled: showCaseSelector });
  const { data: alerts } = useAlerts();

  return (
    <header className="sticky top-0 z-40 bg-canvas border-b border-line">
      {/* Below lg the navigation (or the case breadcrumb) wraps onto a second row. */}
      <div className="flex flex-wrap items-center gap-x-4 px-4 lg:px-6 lg:h-13">
        <div className="order-1 h-13 flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2 rounded" aria-label="Evidentia dashboard">
            <BrandMark />
            <span className="text-[15px] font-semibold text-ink tracking-tight">Evidentia</span>
          </Link>
          {isMockMode && (
            <span
              className="h-5 px-1.5 rounded border border-dashed border-warn/60 text-2xs text-warn inline-flex items-center whitespace-nowrap"
              title="In-memory mock backend: every change is lost when the page reloads."
            >
              Mock data<span className="hidden xl:inline">&nbsp;· resets on reload</span>
            </span>
          )}
        </div>

        {routeCaseId ? (
          <nav
            aria-label="Breadcrumb"
            className="order-3 lg:order-2 w-[calc(100%+2rem)] lg:w-auto min-w-0 h-10 lg:h-13 flex items-center gap-1.5 text-body border-t border-line lg:border-t-0 -mx-4 px-4 lg:mx-0 lg:px-0"
          >
            <Link to="/cases" className="text-ink-muted hover:text-ink shrink-0">
              Cases
            </Link>
            <span className="text-ink-faint" aria-hidden>
              /
            </span>
            <div className="relative min-w-0" ref={caseSelectorRef}>
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="h-7 px-1.5 -mx-1.5 rounded flex items-center gap-1 font-mono text-xs text-ink hover:bg-raised"
                aria-haspopup="listbox"
                aria-expanded={showCaseSelector}
                aria-label={`Case ${caseLabel}. Switch case`}
              >
                {caseLabel}
                <ChevronDown className="size-3.5 text-ink-muted" aria-hidden />
              </button>

              {showCaseSelector && (
                <div className={`${menuClass} left-0 w-[min(24rem,calc(100vw-2rem))] p-1`}>
                  <div className="px-2 pt-1.5 pb-1 text-2xs font-medium text-ink-muted">Switch case</div>
                  <div className="max-h-72 overflow-y-auto" role="listbox" aria-label="Cases">
                    {!allCases && <div className="px-2 py-2 text-body text-ink-muted">Loading cases…</div>}
                    {allCases?.map((c) => (
                      <button
                        key={c.id}
                        role="option"
                        aria-selected={c.id === apiCaseId}
                        onClick={() => {
                          navigate(casePath(c.id));
                          setShowCaseSelector(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2.5 ${
                          c.id === apiCaseId ? 'bg-hover' : 'hover:bg-hover'
                        }`}
                      >
                        <span className={`size-1.5 rounded-full shrink-0 ${CASE_STATUS_DOT[c.status]}`} title={humanize(c.status)} />
                        <span className="font-mono text-xs text-ink-muted shrink-0">{c.case_number}</span>
                        <span className="text-body text-ink truncate">{c.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-ink-faint" aria-hidden>
              /
            </span>
            <span className="text-ink truncate" aria-current="page">
              {caseModuleLabel(activeModule)}
            </span>
          </nav>
        ) : (
          <nav
            aria-label="Main"
            className="order-3 lg:order-2 w-[calc(100%+2rem)] lg:w-auto flex items-center gap-5 overflow-x-auto border-t border-line lg:border-t-0 -mx-4 px-4 lg:mx-0 lg:px-0"
          >
            {MACRO_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `h-10 lg:h-13 flex items-center border-b-2 -mb-px text-body whitespace-nowrap transition-colors focus-visible:outline-offset-[-3px] ${
                    isActive ? 'border-accent text-ink font-medium' : 'border-transparent text-ink-muted hover:text-ink'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="order-2 lg:order-3 ml-auto h-13 flex items-center gap-2 lg:gap-3">
          <div className="hidden lg:block w-56 xl:w-72">
            <GlobalCaseSearch />
          </div>

          <button onClick={onOpenCreateModal} id="header-create-case-btn" className={`${primaryButtonClass} px-2.5 sm:px-3`}>
            <Plus className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">New case</span>
          </button>

          <div className="relative" ref={alertsRef}>
            <button
              onClick={() => setShowAlertsMenu(!showAlertsMenu)}
              id="alerts-bell-btn"
              aria-label={`Alerts (${alerts?.length ?? 0})`}
              aria-expanded={showAlertsMenu}
              className={`${iconButtonClass} size-8 relative`}
            >
              <Bell className="size-4" />
              {!!alerts?.length && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-[10px] font-semibold leading-4 text-canvas text-center">
                  {alerts.length}
                </span>
              )}
            </button>

            {showAlertsMenu && (
              <div className={`${menuClass} right-0 w-[min(22rem,calc(100vw-2rem))]`}>
                <div className="px-3 h-10 flex items-center justify-between border-b border-line">
                  <span className="text-body font-semibold text-ink">Alerts</span>
                  <Link to="/" onClick={() => setShowAlertsMenu(false)} className="text-xs text-accent-text hover:underline">
                    Dashboard
                  </Link>
                </div>
                <div className="max-h-96 overflow-y-auto p-1">
                  {alerts?.length === 0 && <div className="px-2 py-3 text-body text-ink-muted">Nothing needs your attention.</div>}
                  {alerts?.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => {
                        navigate(alertPath(alert));
                        setShowAlertsMenu(false);
                      }}
                      className="w-full text-left px-2 py-2 rounded hover:bg-hover flex items-start gap-2.5"
                    >
                      <span className={`mt-1.5 size-1.5 rounded-full shrink-0 ${ALERT_SEVERITY_DOT[alert.severity]}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-body font-medium text-ink truncate">{alert.title}</span>
                          <span className="font-mono text-2xs text-ink-muted shrink-0">{alert.case_number}</span>
                        </span>
                        <span className="block text-xs text-ink-muted mt-0.5 line-clamp-2">{alert.message}</span>
                        <span className="block font-mono text-2xs text-ink-faint mt-1">{formatDateTime(alert.created_at)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <InvestigatorPicker />
        </div>
      </div>
    </header>
  );
};
