import React, { useState } from 'react';
import {
  Folder,
  ChevronDown,
  ChevronRight,
  FileText,
  Dna,
  Radio,
  Volume2,
  Users,
  Clock,
  Zap,
  Activity,
  Share2,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Shield,
  Search,
  ExternalLink
} from 'lucide-react';
import {
  ForensicCase,
  EvidenceItem,
  PersonOfInterest,
  TimelineEvent,
  CaseStatus
} from '../types';
import { AnatomicalViewer } from './AnatomicalViewer';
import { NetworkGraphViewer } from './NetworkGraphViewer';

interface IndividualCaseViewProps {
  forensicCase: ForensicCase;
  onBackToCases: () => void;
  onPreviewEvidence: (item: EvidenceItem) => void;
  onUpdateStatus: (caseId: string, newStatus: CaseStatus) => void;
}

export const IndividualCaseView: React.FC<IndividualCaseViewProps> = ({
  forensicCase,
  onBackToCases,
  onPreviewEvidence,
  onUpdateStatus
}) => {
  const [activeRightTab, setActiveRightTab] = useState<'autopsy' | 'network'>('autopsy');
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>('ALL');
  const [openAccordion, setOpenAccordion] = useState<{ [key: string]: boolean }>({
    autopsy: true,
    dna: true,
    gps: true,
    pois: true
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordion((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredTimeline = timelineCategoryFilter === 'ALL'
    ? forensicCase.timeline
    : forensicCase.timeline.filter((tl) => tl.category === timelineCategoryFilter);

  return (
    <div className="p-6 space-y-6">
      {/* 1. Case Dossier Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <button
            onClick={onBackToCases}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors mt-0.5"
            title="Return to Cases Index"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-mono font-bold text-cyan-400 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                {forensicCase.id}
              </span>

              {/* Status Selector */}
              <select
                value={forensicCase.status}
                onChange={(e) => onUpdateStatus(forensicCase.id, e.target.value as CaseStatus)}
                className="py-1 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Forensic Testing">Forensic Testing</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Under Review">Under Review</option>
              </select>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                {forensicCase.priority} PRIORITY
              </span>
            </div>

            <h1 className="text-lg font-mono font-bold text-slate-100 mt-2">
              {forensicCase.title}
            </h1>

            <p className="text-xs text-slate-400 font-mono mt-1">
              Location: {forensicCase.incidentLocation} • Created: {forensicCase.dateCreated}
            </p>
          </div>
        </div>

        {/* Lead & AI Threat Score */}
        <div className="flex items-center gap-4 shrink-0 font-mono">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <img
              src={forensicCase.leadInvestigator.avatar}
              alt={forensicCase.leadInvestigator.name}
              className="w-8 h-8 rounded-lg object-cover border border-slate-700"
            />
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Lead Investigator</span>
              <span className="text-xs font-bold text-slate-200 block">
                {forensicCase.leadInvestigator.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
            <div className="text-right">
              <span className="text-[10px] text-cyan-400 block font-bold uppercase">
                AI Confidence
              </span>
              <span className="text-sm font-bold text-cyan-200">
                {forensicCase.aiConfidenceScore}% Match
              </span>
            </div>
            <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 2. Three-Panel Deep Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Case File Summary & Expandable Evidence Drawer (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-2">
                <Folder className="w-4 h-4 text-cyan-400" />
                Case Evidence Locker
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-cyan-400 border border-slate-800">
                {forensicCase.evidenceList.length} Files
              </span>
            </div>

            {/* Expandable Evidence Categories */}
            <div className="space-y-2 font-mono text-xs">
              {/* Autopsy Reports */}
              <div className="rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden">
                <button
                  onClick={() => toggleAccordion('autopsy')}
                  className="w-full p-2.5 flex items-center justify-between text-slate-300 hover:text-slate-100 bg-slate-900/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Autopsy & Medical Exam
                  </span>
                  {openAccordion['autopsy'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {openAccordion['autopsy'] && (
                  <div className="p-2 space-y-1.5 border-t border-slate-800/60">
                    {forensicCase.evidenceList
                      .filter((e) => e.type === 'Autopsy')
                      .map((evd) => (
                        <div
                          key={evd.id}
                          onClick={() => onPreviewEvidence(evd)}
                          className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 cursor-pointer transition-colors text-[11px] text-slate-300 flex items-center justify-between group"
                        >
                          <span className="truncate">{evd.title}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* DNA Sequencing */}
              <div className="rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden">
                <button
                  onClick={() => toggleAccordion('dna')}
                  className="w-full p-2.5 flex items-center justify-between text-slate-300 hover:text-slate-100 bg-slate-900/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-[11px]">
                    <Dna className="w-3.5 h-3.5 text-emerald-400" />
                    DNA STR Lab Results
                  </span>
                  {openAccordion['dna'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {openAccordion['dna'] && (
                  <div className="p-2 space-y-1.5 border-t border-slate-800/60">
                    {forensicCase.evidenceList
                      .filter((e) => e.type === 'DNA')
                      .map((evd) => (
                        <div
                          key={evd.id}
                          onClick={() => onPreviewEvidence(evd)}
                          className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 cursor-pointer transition-colors text-[11px] text-slate-300 flex items-center justify-between group"
                        >
                          <span className="truncate">{evd.title}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* GPS Telemetry */}
              <div className="rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden">
                <button
                  onClick={() => toggleAccordion('gps')}
                  className="w-full p-2.5 flex items-center justify-between text-slate-300 hover:text-slate-100 bg-slate-900/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-[11px]">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    GPS Telemetry & Cell Logs
                  </span>
                  {openAccordion['gps'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {openAccordion['gps'] && (
                  <div className="p-2 space-y-1.5 border-t border-slate-800/60">
                    {forensicCase.evidenceList
                      .filter((e) => e.type === 'GPS')
                      .map((evd) => (
                        <div
                          key={evd.id}
                          onClick={() => onPreviewEvidence(evd)}
                          className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 cursor-pointer transition-colors text-[11px] text-slate-300 flex items-center justify-between group"
                        >
                          <span className="truncate">{evd.title}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0" />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Persons of Interest (POI) Panel */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-mono text-xs">
              <span className="font-bold text-slate-200 uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Persons of Interest ({forensicCase.personsOfInterest.length})
              </span>
            </div>

            <div className="space-y-2">
              {forensicCase.personsOfInterest.map((poi) => (
                <div
                  key={poi.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100">{poi.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        poi.role === 'Suspect'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {poi.role}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-normal">{poi.notes}</p>

                  {poi.dnaMatch && (
                    <div className="pt-1 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {poi.dnaMatch}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Interactive Investigation Timeline (4 Cols) */}
        <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800 font-mono">
            <h2 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              INVESTIGATION CHRONOLOGY
            </h2>

            {/* Filter chips */}
            <div className="flex items-center gap-1 text-[10px]">
              {['ALL', 'GPS', 'Autopsy', 'Witness'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTimelineCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    timelineCategoryFilter === cat
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Events Vertical Cable Feed */}
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-blue-500 before:to-slate-800">
            {filteredTimeline.map((tl) => (
              <div key={tl.id} className="relative group">
                {/* Timeline Dot Pin */}
                <div
                  className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 transition-all ${
                    tl.isAiFlagged
                      ? 'bg-cyan-400 border-slate-950 shadow-[0_0_10px_#06b6d4]'
                      : 'bg-slate-800 border-slate-600'
                  }`}
                ></div>

                {/* Event Card */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 font-mono">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase">
                      {tl.timeDisplay} • {tl.category}
                    </span>
                    {tl.isAiFlagged && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] border border-cyan-500/30 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> AI FLAG
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-100">{tl.title}</h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {tl.description}
                  </p>

                  {/* AI Breakthrough Note */}
                  {tl.aiBreakthroughReason && (
                    <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[10px] text-cyan-200">
                      <strong>AI BREAKTHROUGH:</strong> {tl.aiBreakthroughReason}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredTimeline.length === 0 && (
              <div className="text-xs text-slate-500 font-mono py-8 text-center">
                No events match this filter category.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL / AI ANALYSIS HUB: Dual Tab Anatomical Viewer & POI Network Graph (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs">
            <button
              onClick={() => setActiveRightTab('autopsy')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                activeRightTab === 'autopsy'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Autopsy 3D Viewer</span>
            </button>

            <button
              onClick={() => setActiveRightTab('network')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                activeRightTab === 'network'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>POI Network Graph</span>
            </button>
          </div>

          {/* Render Active Visualizer */}
          <div className="h-[520px]">
            {activeRightTab === 'autopsy' ? (
              <AnatomicalViewer injuries={forensicCase.injuries} />
            ) : (
              <NetworkGraphViewer
                nodes={forensicCase.networkNodes}
                links={forensicCase.networkLinks}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
