import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Activity,
  Brain,
  HardDrive,
  MapPin,
  Flame,
  Shield,
  Search,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Zap,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { IncidentMapPoint } from '@/types';
import { useAppContext } from '@/components/layout/AppLayout';
import { mockInvestigators, mockMapIncidents, mockSystemAlerts } from '@/data/mockData';
import { casePath } from '@/lib/caseModules';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { cases, openCreateCaseModal: onOpenCreateModal } = useAppContext();
  const mapPoints = mockMapIncidents;
  const alerts = mockSystemAlerts;
  const investigators = mockInvestigators;
  const onSelectCase = (caseId: string) => navigate(casePath(caseId));

  const [mapTypeFilter, setMapTypeFilter] = useState<string>('All');
  const [selectedMapPoint, setSelectedMapPoint] = useState<IncidentMapPoint | null>(mapPoints[0] || null);

  const filteredMapPoints = mapTypeFilter === 'All'
    ? mapPoints
    : mapPoints.filter((p) => p.type === mapTypeFilter);

  // Status breakdown calculations
  const totalCasesCount = 432; // Overall historical
  const activeCasesCount = cases.filter((c) => c.status !== 'Closed').length;
  const pendingInsightsCount = 7;
  const processedEvidenceSize = '1.2 TB';

  const statusCounts = {
    Open: cases.filter((c) => c.status === 'Open').length,
    'Forensic Testing': cases.filter((c) => c.status === 'Forensic Testing').length,
    Closed: cases.filter((c) => c.status === 'Closed').length,
    'Under Review': cases.filter((c) => c.status === 'Under Review').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            FORENSIC COMMAND DASHBOARD
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time AI telemetry, automated DNA match alerts & cross-case correlation index.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            NEURAL ENGINE: ACTIVE (99.8% ACCURACY)
          </div>

          <button
            onClick={onOpenCreateModal}
            id="dash-new-case-btn"
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            INITIATE CASE
          </button>
        </div>
      </div>

      {/* 1. Top Metrics Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl shadow-inner relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest font-mono">
              Total Cases
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono text-white mt-1">
            {totalCasesCount}
          </div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3 h-3" /> 12% vs last month
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl shadow-inner relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest font-mono">
              Active Investigations
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono text-cyan-400 mt-1">
            {activeCasesCount}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono">
            3 prioritized [Tier-1]
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl shadow-inner relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest font-mono">
              AI Insights Pending
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono text-amber-500 mt-1">
            0{pendingInsightsCount}
          </div>
          <div className="text-xs text-amber-500/80 mt-2 font-mono">
            Action required in Case #8801
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl shadow-inner relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest font-mono">
              Evidence Data
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono text-white mt-1">
            1.2 <span className="text-lg text-slate-400">TB</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono">
            Storage capacity 84%
          </div>
        </div>
      </div>

      {/* 2. Interactive Geographical Heatmap & Case Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map / Heatmap Card (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          {/* Map Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 z-10">
            <div>
              <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                INCIDENT GEOGRAPHICAL HEATMAP & DISTRIBUTION
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time spatial cluster analysis for active crimes and forensic recovery zones.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
              {['All', 'Homicide', 'Cyber', 'Narcotics', 'Arson'].map((type) => (
                <button
                  key={type}
                  onClick={() => setMapTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    mapTypeFilter === type
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Map Canvas Visualizer */}
          <div className="relative my-4 h-[340px] w-full rounded-xl bg-slate-950 border border-slate-800/90 overflow-hidden flex items-center justify-center">
            {/* Grid background lines */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

            {/* Simulated Tactical Map Canvas SVG */}
            <svg className="w-full h-full absolute inset-0 opacity-20 pointer-events-none" viewBox="0 0 800 400">
              <path
                d="M 100 120 Q 200 80, 300 150 T 500 200 T 700 100 L 750 250 L 600 350 L 200 380 Z"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <path
                d="M 50 250 Q 180 200, 320 280 T 580 220 T 720 320"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1"
              />
            </svg>

            {/* Radar Sweep Effect */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(6,182,212,0.15)_360deg)] animate-[spin_8s_linear_infinite] rounded-full scale-150 pointer-events-none"></div>

            {/* Incident Heatmap Radar Hotspots & Markers */}
            {filteredMapPoints.map((point) => {
              const isSelected = selectedMapPoint?.id === point.id;
              const isCritical = point.severity === 'Critical';

              return (
                <div
                  key={point.id}
                  style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  onClick={() => setSelectedMapPoint(point)}
                >
                  {/* Heatmap Outer Pulse Ring */}
                  <span
                    className={`absolute inset-0 -m-3 rounded-full opacity-60 animate-ping ${
                      isCritical ? 'bg-red-500' : 'bg-cyan-400'
                    }`}
                  ></span>

                  {/* Heat Glow */}
                  <span
                    className={`block w-6 h-6 rounded-full blur-sm opacity-80 ${
                      isCritical ? 'bg-red-500' : 'bg-cyan-400'
                    }`}
                  ></span>

                  {/* Core Pin */}
                  <div
                    className={`absolute inset-0 m-auto w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-cyan-400 scale-125 shadow-[0_0_15px_#06b6d4]'
                        : isCritical
                        ? 'bg-red-500 border-white shadow-[0_0_10px_#ef4444]'
                        : 'bg-cyan-400 border-slate-950'
                    }`}
                  ></div>

                  {/* Tooltip Hover Badge */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap z-30">
                    <span className="font-bold text-cyan-300">{point.title}</span>
                    <span className="text-slate-400">{point.city} • {point.severity}</span>
                  </div>
                </div>
              );
            })}

            {/* Map Selected Incident Overlay Bar */}
            {selectedMapPoint && (
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-md z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${
                    selectedMapPoint.severity === 'Critical'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  }`}>
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-100">
                        {selectedMapPoint.title}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                        {selectedMapPoint.type}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Location: {selectedMapPoint.city} • Incident Time: {selectedMapPoint.timestamp}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectCase(selectedMapPoint.caseId)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono flex items-center gap-1 shrink-0 transition-all"
                >
                  <span>INSPECT CASE FILE</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Case Status breakdown chart/widget */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              CASE STATUS BREAKDOWN
            </h2>

            {/* Circular Ring Gauge Display */}
            <div className="my-6 flex flex-col items-center justify-center">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* SVG Ring Gauge */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="58"
                    stroke="#1e293b"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Forensic Testing Segment */}
                  <circle
                    cx="72"
                    cy="72"
                    r="58"
                    stroke="#06b6d4"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray="364"
                    strokeDashoffset="120"
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  {/* Open Segment */}
                  <circle
                    cx="72"
                    cy="72"
                    r="58"
                    stroke="#f59e0b"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray="364"
                    strokeDashoffset="260"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-mono font-bold text-slate-100">
                    {cases.length}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                    ACTIVE DOSSIERS
                  </span>
                </div>
              </div>
            </div>

            {/* Status Bars List */}
            <div className="space-y-3 font-mono">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    Forensic Testing
                  </span>
                  <span className="text-slate-200 font-bold">{statusCounts['Forensic Testing']}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full w-[60%] rounded-full"></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Open / Active
                  </span>
                  <span className="text-slate-200 font-bold">{statusCounts['Open']}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-[25%] rounded-full"></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Closed / Solved
                  </span>
                  <span className="text-slate-200 font-bold">{statusCounts['Closed']}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full w-[15%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 font-mono">
              Average Clearance Time: 14.2 Days
            </span>
          </div>
        </div>
      </div>

      {/* 3. Recent Alerts & Top Investigators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Case Alerts Stream */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              AI FORENSIC ALERTS FEED
            </h2>
            <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              STREAMING
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => onSelectCase(alert.caseId)}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer transition-all flex items-start gap-3 group"
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  alert.severity === 'critical'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : alert.severity === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                }`}>
                  <Zap className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                      {alert.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {alert.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {alert.message}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-cyan-400">
                    <span>CASE: {alert.caseId}</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Investigators List */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              TOP INVESTIGATORS & SPECIALISTS
            </h2>
            <span className="text-[10px] font-mono text-slate-400">
              4 ON DUTY
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-800/80">
            {investigators.map((inv) => (
              <div key={inv.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <img
                    src={inv.avatar}
                    alt={inv.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      {inv.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {inv.role}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 font-mono">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-cyan-400 border border-slate-800">
                    {inv.clearanceLevel.split(' ')[0]} {inv.clearanceLevel.split(' ')[1]}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {inv.casesSolved} Solved • <strong className="text-slate-200">{inv.activeCases} Active</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
