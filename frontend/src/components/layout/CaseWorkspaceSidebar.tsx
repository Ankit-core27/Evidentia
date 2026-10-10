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
    <nav
      aria-label="Case modules"
      className="shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-canvas lg:w-56 lg:sticky lg:top-13 lg:h-[calc(100vh-3.25rem)] lg:overflow-y-auto"
    >
      <div className="flex lg:flex-col overflow-x-auto px-2 lg:px-3 lg:py-4 gap-x-1 lg:gap-y-5">
        {CASE_MODULE_GROUPS.map((group) => {
          const modules = visible.filter((m) => m.group === group.id);
          if (!modules.length) return null;
          return (
            <div key={group.id} className="flex lg:flex-col lg:gap-0.5 shrink-0">
              <div className="hidden lg:block px-2 pb-1.5 text-2xs font-medium uppercase tracking-wider text-ink-faint">{group.label}</div>
              {modules.map((m) => {
                const Icon = m.icon;
                const isActive = activeModule === m.id;
                const badge = badges[m.id];
                return (
                  <Link
                    key={m.id}
                    to={casePath(caseId, m.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex items-center gap-2.5 whitespace-nowrap text-body transition-colors focus-visible:outline-offset-[-3px] h-10 px-2.5 border-b-2 lg:border-b-0 lg:h-8 lg:px-2 lg:rounded ${
                      isActive
                        ? 'border-accent text-ink font-medium lg:bg-raised'
                        : 'border-transparent text-ink-muted hover:text-ink lg:hover:bg-surface'
                    }`}
                  >
                    {/* Active marker on the sidebar edge */}
                    {isActive && <span className="hidden lg:block absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" aria-hidden />}
                    <Icon
                      className={`hidden lg:block size-4 shrink-0 ${isActive ? 'text-accent-text' : 'text-ink-faint group-hover:text-ink-muted'}`}
                      aria-hidden
                    />
                    <span className="lg:flex-1 lg:truncate">{m.label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span className={`font-mono text-2xs ${attention[m.id] ? 'text-pending' : 'text-ink-faint'}`}>{badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
