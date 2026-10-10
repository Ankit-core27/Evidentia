import React from 'react';
import { Link } from 'react-router-dom';
import { IncidentMap } from '@/components/dashboard/IncidentMap';
import { CASE_STATUS_DOT } from '@/components/shared/Badges';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { PageHeader, SectionHeader } from '@/components/shared/PageHeader';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { useAlerts, useDashboard } from '@/hooks/useDashboard';
import { ALERT_SEVERITY_DOT, alertPath } from '@/lib/alerts';
import { formatBytes, formatDateTime, humanize } from '@/lib/format';
import { CASE_STATUSES } from '@/lib/options';
import { Dashboard } from '@/types/api';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The headline numbers in one strip. Cases carry their status split, so it needs no separate chart. */
const Figures: React.FC<{ dashboard: Dashboard }> = ({ dashboard: d }) => {
  const total = CASE_STATUSES.reduce((sum, s) => sum + d.status_counts[s], 0);
  return (
    <section
      aria-label="Figures"
      className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] rounded-md border border-line divide-y md:divide-y-0 md:divide-x divide-line"
    >
      <div className="p-4 space-y-3" data-testid="metric-total">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-ink-muted">Cases</span>
          <span className="text-xs text-ink-muted" data-testid="metric-active">
            <span className="text-ink-soft">{d.active_cases} active</span> · {d.status_counts.closed} closed
          </span>
        </div>
        <div className="font-mono text-3xl text-ink leading-none">{d.total_cases}</div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-raised gap-px" aria-hidden>
          {total > 0 &&
            CASE_STATUSES.filter((s) => d.status_counts[s] > 0).map((s) => (
              <div key={s} className={CASE_STATUS_DOT[s]} style={{ width: `${(d.status_counts[s] / total) * 100}%` }} />
            ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Cases by status">
          {CASE_STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-1.5 text-ink-muted" data-testid={`status-${s}`}>
              <span className={`size-1.5 rounded-full ${CASE_STATUS_DOT[s]}`} aria-hidden />
              {humanize(s)}
              <span className="font-mono text-ink-soft">{d.status_counts[s]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-4 space-y-1" data-testid="metric-reviews">
        <div className="text-xs text-ink-muted">AI proposals to review</div>
        <div className={`font-mono text-3xl leading-none pt-2 ${d.pending_reviews ? 'text-pending' : 'text-ink'}`}>{d.pending_reviews}</div>
        <p className="text-xs text-ink-muted pt-1.5">Waiting for an investigator to confirm or reject them.</p>
      </div>
      <div className="p-4 space-y-1" data-testid="metric-storage">
        <div className="text-xs text-ink-muted">Evidence stored</div>
        <div className="font-mono text-3xl text-ink leading-none pt-2">{formatBytes(d.storage_bytes)}</div>
        <p className="text-xs text-ink-muted pt-1.5">Original files across all cases, each with its SHA-256.</p>
      </div>
    </section>
  );
};

const NeedsAttention: React.FC = () => {
  const alerts = useAlerts();
  return (
    <section className="space-y-2 min-w-0 order-first lg:order-none" aria-label="Alerts">
      <SectionHeader title="Needs attention" count={alerts.data?.length} as="h2" />
      {alerts.isPending && <LoadingState label="Loading alerts…" />}
      {alerts.isError && <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />}
      {alerts.data?.length === 0 && (
        <p className="px-3 py-6 rounded-md border border-line text-body text-ink-muted">Nothing is waiting on you.</p>
      )}
      {!!alerts.data?.length && (
        <ul className="rounded-md border border-line divide-y divide-line">
          {alerts.data.map((alert) => (
            <li key={alert.id}>
              <Link to={alertPath(alert)} className="group flex items-start gap-3 px-3 py-3 hover:bg-surface transition-colors">
                <span className={`mt-1.5 size-2 rounded-full shrink-0 ${ALERT_SEVERITY_DOT[alert.severity]}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-body font-medium text-ink group-hover:text-accent-text">{alert.title}</span>
                    <span className="font-mono text-2xs text-ink-muted shrink-0">{alert.case_number}</span>
                  </span>
                  <span className="block text-xs text-ink-soft mt-0.5">{alert.message}</span>
                  <span className="block font-mono text-2xs text-ink-faint mt-1">{formatDateTime(alert.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Investigators: React.FC<{ dashboard: Dashboard }> = ({ dashboard }) => {
  const investigators = [...dashboard.investigators].sort((a, b) => b.active_cases - a.active_cases || a.name.localeCompare(b.name));
  return (
    <section className="space-y-2" aria-label="Investigators">
      <SectionHeader title="Investigators" count={investigators.length} as="h2" />
      <div className="rounded-md border border-line overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs text-ink-muted border-b border-line">
              <th scope="col" className="font-normal px-3 h-9">Name</th>
              <th scope="col" className="font-normal px-3 h-9 hidden md:table-cell">Role</th>
              <th scope="col" className="font-normal px-3 h-9 hidden sm:table-cell">Clearance</th>
              <th scope="col" className="font-normal px-3 h-9 text-right">Active</th>
              <th scope="col" className="font-normal px-3 h-9 text-right">Solved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {investigators.map((inv) => (
              <tr key={inv.id} data-testid={`investigator-${inv.id}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={inv.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-body text-ink truncate">{inv.name}</div>
                      <div className="font-mono text-2xs text-ink-muted">{inv.badge_number}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-body text-ink-soft hidden md:table-cell">{inv.role}</td>
                <td className="px-3 py-2 text-xs text-ink-muted whitespace-nowrap hidden sm:table-cell">{inv.clearance_level}</td>
                <td className="px-3 py-2 text-right font-mono text-body text-ink">{inv.active_cases}</td>
                <td className="px-3 py-2 text-right font-mono text-body text-ink-muted">{inv.solved_cases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

/** Agency-wide view: GET /api/dashboard for counts, sites and investigators; GET /api/alerts for the feed. */
export const DashboardPage: React.FC = () => {
  const dashboard = useDashboard();
  const d = dashboard.data;

  return (
    <div className="space-y-6">
      <PageHeader
        level="page"
        title="Dashboard"
        description={
          d
            ? `${plural(d.total_cases, 'case')}, ${d.active_cases} still active. ${
                d.pending_reviews ? `${plural(d.pending_reviews, 'AI proposal')} waiting for review.` : 'Every AI proposal has been reviewed.'
              }`
            : 'Every case at a glance: status, incident sites, alerts and workload.'
        }
      />

      {dashboard.isPending && <LoadingState label="Loading dashboard…" />}
      {dashboard.isError && <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />}

      {d && <Figures dashboard={d} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-8 items-start">
        <div className="lg:col-span-2 space-y-8 min-w-0">
          {d && <IncidentMap points={d.incident_points} />}
          {d && <Investigators dashboard={d} />}
        </div>
        <NeedsAttention />
      </div>
    </div>
  );
};
