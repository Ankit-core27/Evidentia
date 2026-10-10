import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Brain, ChevronRight, FolderKanban, HardDrive, Shield, SlidersHorizontal, UserCheck, Zap } from 'lucide-react';
import { useAppContext } from '@/components/layout/AppLayout';
import { IncidentMap } from '@/components/dashboard/IncidentMap';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { useAlerts, useDashboard } from '@/hooks/useDashboard';
import { ALERT_SEVERITY_STYLES, alertPath } from '@/lib/alerts';
import { formatBytes, formatDateTime, humanize } from '@/lib/format';
import { CASE_STATUSES } from '@/lib/options';
import { CaseStatus, Dashboard } from '@/types/api';

const STATUS_COLOURS: Record<CaseStatus, { stroke: string; dot: string }> = {
  open: { stroke: '#f59e0b', dot: 'bg-amber-400' },
  in_progress: { stroke: '#06b6d4', dot: 'bg-cyan-400' },
  under_review: { stroke: '#a855f7', dot: 'bg-purple-400' },
  closed: { stroke: '#10b981', dot: 'bg-emerald-400' }
};

const MetricCard: React.FC<{ label: string; value: React.ReactNode; note: string; icon: React.ReactNode; testId: string }> = ({
  label,
  value,
  note,
  icon,
  testId
}) => (
  <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl shadow-inner" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="text-slate-500 text-xs font-bold uppercase tracking-widest font-mono">{label}</span>
      {icon}
    </div>
    <div className="text-3xl font-mono text-white mt-1">{value}</div>
    <div className="text-xs text-slate-400 mt-2 font-mono">{note}</div>
  </div>
);

const iconBox = (icon: React.ReactNode, tone: string) => <div className={`p-1.5 rounded-lg border ${tone}`}>{icon}</div>;

/** Donut of cases by status, with a bar per status. */
const StatusBreakdown: React.FC<{ dashboard: Dashboard }> = ({ dashboard }) => {
  const total = CASE_STATUSES.reduce((sum, s) => sum + dashboard.status_counts[s], 0);
  const r = 58;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800" aria-label="Case status breakdown">
      <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
        <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
        CASE STATUS BREAKDOWN
      </h2>
      <div className="my-6 flex justify-center">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144" aria-hidden="true">
            <circle cx="72" cy="72" r={r} stroke="#1e293b" strokeWidth="12" fill="transparent" />
            {total > 0 &&
              CASE_STATUSES.map((s) => {
                const length = (dashboard.status_counts[s] / total) * circumference;
                const segment = (
                  <circle
                    key={s}
                    cx="72"
                    cy="72"
                    r={r}
                    stroke={STATUS_COLOURS[s].stroke}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return segment;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-mono font-bold text-slate-100">{total}</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">cases</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 font-mono">
        {CASE_STATUSES.map((s) => (
          <div key={s} className="space-y-1" data-testid={`status-${s}`}>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLOURS[s].dot}`} />
                {humanize(s)}
              </span>
              <span className="text-slate-200 font-bold">{dashboard.status_counts[s]}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${STATUS_COLOURS[s].dot}`}
                style={{ width: `${total ? (dashboard.status_counts[s] / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const AlertsFeed: React.FC = () => {
  const alerts = useAlerts();
  return (
    <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800" aria-label="Alerts">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          ALERTS
        </h2>
        {alerts.data && <span className="text-[10px] font-mono text-slate-400">{alerts.data.length} open</span>}
      </div>
      {alerts.isPending && <LoadingState label="Loading alerts…" />}
      {alerts.isError && <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />}
      {alerts.data?.length === 0 && <p className="mt-3 text-xs text-slate-500 font-mono">No alerts. Nothing is waiting on you.</p>}
      <ul className="mt-3 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {alerts.data?.map((alert) => (
          <li key={alert.id}>
            <Link
              to={alertPath(alert)}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/40 transition-all flex items-start gap-3 group"
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 border ${ALERT_SEVERITY_STYLES[alert.severity]}`}>
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300 truncate">{alert.title}</span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{formatDateTime(alert.created_at)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{alert.message}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                  {alert.case_number}
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const Investigators: React.FC<{ dashboard: Dashboard }> = ({ dashboard }) => {
  const investigators = [...dashboard.investigators].sort((a, b) => b.active_cases - a.active_cases || a.name.localeCompare(b.name));
  return (
    <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800" aria-label="Investigators">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-cyan-400" />
          INVESTIGATORS
        </h2>
        <span className="text-[10px] font-mono text-slate-400">{investigators.length} on the system</span>
      </div>
      <ul className="mt-3 divide-y divide-slate-800/80">
        {investigators.map((inv) => (
          <li key={inv.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0" data-testid={`investigator-${inv.id}`}>
            <div className="flex items-center gap-3 min-w-0">
              <InitialsAvatar name={inv.name} />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">{inv.name}</span>
                <span className="text-[11px] text-slate-400 font-mono block">
                  {inv.role} · {inv.badge_number}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 font-mono shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-cyan-400 border border-slate-800">{inv.clearance_level}</span>
              <span className="text-[11px] text-slate-400">
                {inv.solved_cases} solved · <strong className="text-slate-200">{inv.active_cases} active</strong>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Agency-wide view: GET /api/dashboard for counts, sites and investigators; GET /api/alerts for the feed. */
export const DashboardPage: React.FC = () => {
  const { openCreateCaseModal } = useAppContext();
  const dashboard = useDashboard();
  const d = dashboard.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            FORENSIC COMMAND DASHBOARD
          </h1>
          <p className="text-xs text-slate-400 mt-1">Every case at a glance: status, incident sites, alerts and who is working on what.</p>
        </div>
        <button
          onClick={openCreateCaseModal}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shrink-0"
        >
          <Zap className="w-4 h-4 fill-slate-950" />
          NEW CASE
        </button>
      </div>

      {dashboard.isPending && <LoadingState label="Loading dashboard…" />}
      {dashboard.isError && <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />}

      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              testId="metric-total"
              label="Total cases"
              value={d.total_cases}
              note={`${d.status_counts.closed} closed`}
              icon={iconBox(<FolderKanban className="w-4 h-4" />, 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20')}
            />
            <MetricCard
              testId="metric-active"
              label="Active cases"
              value={<span className="text-cyan-400">{d.active_cases}</span>}
              note={`${d.status_counts.under_review} under review`}
              icon={iconBox(<Activity className="w-4 h-4" />, 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20')}
            />
            <MetricCard
              testId="metric-reviews"
              label="AI proposals to review"
              value={<span className="text-amber-400">{d.pending_reviews}</span>}
              note="Waiting for an investigator to confirm or reject"
              icon={iconBox(<Brain className="w-4 h-4" />, 'bg-amber-500/10 text-amber-400 border-amber-500/20')}
            />
            <MetricCard
              testId="metric-storage"
              label="Evidence stored"
              value={formatBytes(d.storage_bytes)}
              note="Original files across all cases"
              icon={iconBox(<HardDrive className="w-4 h-4" />, 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <IncidentMap points={d.incident_points} />
            </div>
            <StatusBreakdown dashboard={d} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsFeed />
        {d && <Investigators dashboard={d} />}
      </div>
    </div>
  );
};
