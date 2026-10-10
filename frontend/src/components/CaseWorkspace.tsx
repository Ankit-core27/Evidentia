import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Dna,
  Radio,
  Users,
  Clock,
  Zap,
  Activity,
  Share2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Search,
  ExternalLink,
  Video,
  PhoneCall,
  Navigation,
  Bot,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Send,
  Eye,
  Download,
  Box,
  Fingerprint,
  RotateCcw,
  Sparkles,
  Lock
} from 'lucide-react';
import {
  ForensicCase,
  EvidenceItem,
  PersonOfInterest,
  TimelineEvent,
  CaseStatus,
  CaseModule,
  CopilotMessage
} from '../types';
import { AnatomicalViewer } from './AnatomicalViewer';
import { NetworkGraphViewer } from './NetworkGraphViewer';
import { CaseWorkspaceSidebar } from './CaseWorkspaceSidebar';

interface CaseWorkspaceProps {
  forensicCase: ForensicCase;
  activeModule: CaseModule;
  onSelectModule: (module: CaseModule) => void;
  onExitWorkspace: () => void;
  onPreviewEvidence: (item: EvidenceItem) => void;
  onUpdateStatus: (caseId: string, newStatus: CaseStatus) => void;
}

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({
  forensicCase,
  activeModule,
  onSelectModule,
  onExitWorkspace,
  onPreviewEvidence,
  onUpdateStatus
}) => {
  // Timeline category filter
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>('ALL');

  // Copilot State
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'MSG-1',
      sender: 'copilot',
      timestamp: '22:46 PST',
      text: `Hello Det. A. Sharma. I have finished cross-referencing all 14 evidence files for ${forensicCase.id} (${forensicCase.title}).`,
      citations: ['EVD-8801-01 (Autopsy)', 'EVD-8801-02 (DNA Swab #B-42)', 'EVD-8801-03 (Cell Tower #409)'],
      suggestedActions: [
        'Analyze Victor Vance alibi contradiction',
        'Inspect VX-7B toxin synthesis records from Apex Bio-Labs',
        'Review CCTV facial biometric match from service elevator'
      ]
    }
  ]);

  const handleSendCopilot = (textToSend?: string) => {
    const query = textToSend || copilotInput;
    if (!query.trim()) return;

    const userMsg: CopilotMessage = {
      id: `USER-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setCopilotInput('');

    setTimeout(() => {
      let aiResponseText = `AI Forensic Copilot Analysis for case ${forensicCase.id}:\n\n` +
        `Based on spectral analysis and CODIS database query, victim ${forensicCase.victim?.name || 'Julian Vance'} suffered fatal respiratory paralysis caused by VX-7B neurotoxin. ` +
        `Touch DNA recovered from Swab #B-42 matches prime suspect Victor Vance with 99.98% probability. ` +
        `Additionally, cell tower #409 logs place Victor Vance's handset 120m from the crime scene at 22:42 PST, disproving his stated airport alibi.`;

      if (query.toLowerCase().includes('victim')) {
        aiResponseText = `Victim Dossier Query:\nName: ${forensicCase.victim?.name || 'Julian Vance'} (Age ${forensicCase.victim?.age || 48})\n` +
          `Status: ${forensicCase.victim?.status || 'Deceased - Confirmed'}\n` +
          `Cause of Death: ${forensicCase.victim?.causeOfDeath || 'Synthetic VX-7B Neurotoxin'}\n` +
          `DNA Verification: ${forensicCase.victim?.dnaMatchVerification || '99.98% CODIS Match'}\n\n` +
          `Key Finding: Micro-puncture mark found adjacent to right carotid artery. Subjugation occurred rapidly within 45 seconds.`;
      }

      const copilotResponse: CopilotMessage = {
        id: `COPILOT-${Date.now()}`,
        sender: 'copilot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: aiResponseText,
        citations: ['EVD-8801-01', 'EVD-8801-02', 'EVD-8801-03'],
        suggestedActions: ['Issue Subpoena for Apex Bio-Labs Sales Ledger', 'Request Search Warrant for Black Audi A8']
      };

      setCopilotMessages((prev) => [...prev, copilotResponse]);
    }, 600);
  };

  const filteredTimeline =
    timelineCategoryFilter === 'ALL'
      ? forensicCase.timeline
      : forensicCase.timeline.filter((tl) => tl.category === timelineCategoryFilter);

  // Primary Suspect
  const primarySuspect = forensicCase.personsOfInterest.find((p) => p.role === 'Suspect') || forensicCase.personsOfInterest[0];

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 font-mono">
      {/* 1. Case Workspace Secondary Left Sidebar */}
      <CaseWorkspaceSidebar
        activeCase={forensicCase}
        activeModule={activeModule}
        onSelectModule={onSelectModule}
        onExitWorkspace={onExitWorkspace}
      />

      {/* 2. Main Case Module Panel Content */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6">
        {/* Top Case Banner Summary Header */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-cyan-400 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                {forensicCase.id}
              </span>

              {/* Status Selector */}
              <select
                value={forensicCase.status}
                onChange={(e) => onUpdateStatus(forensicCase.id, e.target.value as CaseStatus)}
                className="py-1 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Forensic Testing">Forensic Testing</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Under Review">Under Review</option>
              </select>

              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                {forensicCase.priority} PRIORITY
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-100 mt-2">
              {forensicCase.title}
            </h1>

            <p className="text-xs text-slate-400 mt-1">
              Location: {forensicCase.incidentLocation} • Created: {forensicCase.dateCreated} • Lead: {forensicCase.leadInvestigator.name}
            </p>
          </div>

          {/* AI Threat Score & Progress Bar */}
          <div className="flex items-center gap-4 shrink-0 font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold gap-4">
                <span>INVESTIGATION PROGRESS</span>
                <span className="text-cyan-400">{forensicCase.progressPercent || 78}% SOLVED</span>
              </div>
              <div className="w-40 h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                  style={{ width: `${forensicCase.progressPercent || 78}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
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

        {/* ---------------------------------------------------- */}
        {/* MODULE 1: OVERVIEW PAGE */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'overview' && (
          <div className="space-y-6">
            {/* 1. Deep-Dive Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>Total Evidences</span>
                  <Folder className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-3xl font-bold text-white mt-2">
                  {forensicCase.evidenceList.length || forensicCase.evidenceCount}
                </div>
                <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> 100% SHA-256 Validated
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>Relationships Linked</span>
                  <Share2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-purple-300 mt-2">
                  {forensicCase.networkNodes.length} Nodes / {forensicCase.networkLinks.length} Links
                </div>
                <div className="text-[11px] text-slate-400 mt-2 font-mono">
                  5 High-Suspicious Links
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>Timeline Events</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-bold text-amber-400 mt-2">
                  {forensicCase.timeline.length} Logs
                </div>
                <div className="text-[11px] text-amber-400/80 mt-2 flex items-center gap-1 font-mono">
                  <Zap className="w-3 h-3" /> 4 AI Breakthrough Flags
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>AI Confidence Score</span>
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-3xl font-bold text-cyan-300 mt-2">
                  {forensicCase.aiConfidenceScore}%
                </div>
                <div className="text-[11px] text-cyan-400/80 mt-2 font-mono">
                  Neural STR & Telemetry Match
                </div>
              </div>
            </div>

            {/* 2. Main Deep-Dive Overview Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: Primary Suspect Profile Cards & Threat Levels (4 Cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold">
                    <span className="text-slate-200 uppercase flex items-center gap-2">
                      <Users className="w-4 h-4 text-red-400" />
                      Primary Suspect Profile
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/40">
                      THREAT: {primarySuspect?.threatLevel || 'Severe'}
                    </span>
                  </div>

                  {primarySuspect && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={primarySuspect.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                          alt={primarySuspect.name}
                          className="w-12 h-12 rounded-xl object-cover border border-red-500/40"
                        />
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">{primarySuspect.name}</h3>
                          <span className="text-[11px] text-red-400 block font-semibold">
                            Role: Prime Suspect
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Alibi: {primarySuspect.alibiStatus}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        {primarySuspect.notes}
                      </p>

                      {primarySuspect.dnaMatch && (
                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                          <Dna className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span><strong>CODIS MATCH:</strong> {primarySuspect.dnaMatch}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => onSelectModule('witnesses')}
                    className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
                  >
                    View All {forensicCase.personsOfInterest.length} Persons of Interest →
                  </button>
                </div>

                {/* CCTV & Phone Quick Highlights */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-200 uppercase block pb-2 border-b border-slate-800 flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    Key CCTV & Telecom Signals
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-cyan-400">
                        <span>CCTV Match • 22:38 PST</span>
                        <span className="font-bold">96.4% Match</span>
                      </div>
                      <div className="font-bold text-slate-200">Skyline Tower Service Elevator</div>
                      <div className="text-[11px] text-slate-400">Facial biometric frame reconstruction matched suspect features.</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-amber-400">
                        <span>Wiretap Call • 23:15 PST</span>
                        <span className="font-bold">Decrypted</span>
                      </div>
                      <div className="font-bold text-slate-200">Intercepted Call to Broker X</div>
                      <div className="text-[11px] text-slate-400">"The drive has been extracted, cleanup complete."</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN: Core Investigation Canvas / Network Graph (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold">
                    <span className="text-slate-200 uppercase flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-cyan-400" />
                      Core Investigation Link Graph
                    </span>
                    <button
                      onClick={() => onSelectModule('canvas')}
                      className="text-cyan-400 hover:underline text-[11px]"
                    >
                      Open Full Canvas →
                    </button>
                  </div>

                  <div className="h-[380px] rounded-xl overflow-hidden border border-slate-800">
                    <NetworkGraphViewer
                      nodes={forensicCase.networkNodes}
                      links={forensicCase.networkLinks}
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT-SIDE FORENSIC INSPECTOR CONTEXT DRAWER (3 Cols) */}
              <div className="lg:col-span-3 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] space-y-4">
                  <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      Forensic Inspector Drawer
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                      CASE DOSSIER
                    </span>
                  </div>

                  {/* Victim Status & Details */}
                  <div className="space-y-2 text-xs">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Victim Status</div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100">{forensicCase.victim?.name || 'Julian Vance'}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                          {forensicCase.victim?.status || 'Deceased - Confirmed'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Age: {forensicCase.victim?.age || 48} • {forensicCase.victim?.occupation || 'CEO, Quantum Cybernetics'}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 uppercase font-bold mt-2">Cause of Death</div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed">
                      {forensicCase.victim?.causeOfDeath || 'Acute Respiratory Paralysis via Synthetic VX-7B Neurotoxin'}
                    </div>

                    <div className="text-[10px] text-slate-400 uppercase font-bold mt-2">DNA Verification</div>
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{forensicCase.victim?.dnaMatchVerification || '99.98% CODIS Match on Swab #B-42 to Victor Vance'}</span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="pt-2 space-y-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Quick Actions</span>

                    <button
                      onClick={() => onSelectModule('autopsy')}
                      className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-between transition-all"
                    >
                      <span>Open Full Autopsy Findings</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        onSelectModule('copilot');
                        handleSendCopilot('Provide complete forensic breakdown regarding the victim Julian Vance.');
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-between transition-all"
                    >
                      <span>Ask AI Copilot About Victim</span>
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                    </button>

                    {forensicCase.evidenceList[1] && (
                      <button
                        onClick={() => onPreviewEvidence(forensicCase.evidenceList[1])}
                        className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-between transition-all"
                      >
                        <span>Inspect DNA Swab #B-42</span>
                        <Dna className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 2: EVIDENCE LOCKER */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'evidence' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Folder className="w-5 h-5 text-cyan-400" />
                  Case Evidence Locker ({forensicCase.evidenceList.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Cryptographically secured SHA-256 evidence chain of custody records.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forensicCase.evidenceList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onPreviewEvidence(item)}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.fileSize}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>SHA-256 Validated</span>
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 3: INVESTIGATION CANVAS (CORE) */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'canvas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-cyan-400" />
                  Core Investigation Link Canvas
                </h2>
                <p className="text-xs text-slate-400">
                  Interactive node map showing suspect motives, cell tower pings, DNA links, and evidence relationships.
                </p>
              </div>
            </div>

            <div className="h-[600px] rounded-2xl overflow-hidden border border-slate-800">
              <NetworkGraphViewer
                nodes={forensicCase.networkNodes}
                links={forensicCase.networkLinks}
              />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 4: TIMELINE CHRONOLOGY */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'timeline' && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Investigation Chronology Timeline
                </h2>
                <p className="text-xs text-slate-400">
                  Chronological progression of crime events, cell tower pings, and autopsy findings.
                </p>
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-1.5 text-xs">
                {['ALL', 'GPS', 'Autopsy', 'Witness', 'Telecom'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTimelineCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      timelineCategoryFilter === cat
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative pl-8 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-blue-500 before:to-slate-800">
              {filteredTimeline.map((tl) => (
                <div key={tl.id} className="relative group">
                  <div
                    className={`absolute -left-8 top-2 w-4 h-4 rounded-full border-2 transition-all ${
                      tl.isAiFlagged
                        ? 'bg-cyan-400 border-slate-950 shadow-[0_0_12px_#06b6d4]'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  ></div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-cyan-400 font-bold uppercase">
                        {tl.timeDisplay} • {tl.category}
                      </span>
                      {tl.isAiFlagged && (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> AI BREAKTHROUGH FLAG
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-100">{tl.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{tl.description}</p>

                    {tl.aiBreakthroughReason && (
                      <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 mt-2">
                        <strong>AI INSIGHT:</strong> {tl.aiBreakthroughReason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 5: CCTV ANALYSIS */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'cctv' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Video className="w-5 h-5 text-cyan-400" />
                  CCTV Facial Biometrics & Video Feed Analysis
                </h2>
                <p className="text-xs text-slate-400">
                  Neural video enhancement, facial feature matching, and Automated License Plate Recognition (ALPR).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CCTV Feed 1 */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">CAM-NORTH-04 • Skyline Service Elevator</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    96.4% MATCH
                  </span>
                </div>

                <div className="relative h-64 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80"
                    alt="CCTV Frame"
                    className="w-full h-full object-cover filter brightness-75 contrast-125"
                  />
                  {/* Facial Recognition Overlay Box */}
                  <div className="absolute top-12 left-1/3 w-32 h-32 border-2 border-cyan-400 rounded-lg flex flex-col justify-between p-1 bg-cyan-500/10 animate-pulse">
                    <span className="text-[9px] bg-cyan-500 text-slate-950 px-1 font-bold">MATCH: V. Vance</span>
                    <span className="text-[9px] text-cyan-300 font-bold text-right">CONF: 96.4%</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <strong>AI Note:</strong> Neural frame reconstruction verified bone structure and gait alignment matching Victor Vance exiting penthouse floor at 22:38 PST.
                </div>
              </div>

              {/* CCTV Feed 2 */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">CAM-STREET-12 • Ground Dock Exit</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    ALPR HIT
                  </span>
                </div>

                <div className="relative h-64 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80"
                    alt="Vehicle LPR Frame"
                    className="w-full h-full object-cover filter brightness-75 contrast-125"
                  />
                  <div className="absolute bottom-6 left-6 px-3 py-1.5 rounded bg-slate-950/90 border border-emerald-500 text-emerald-400 font-bold text-xs">
                    PLATE: 9X22 (Black Audi A8)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <strong>ALPR Confirmation:</strong> Black Audi A8 registered to Victor Vance sped south on Harbor Expressway at 22:52 PST.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 6: AUTOPSY & MEDICAL */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'autopsy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  3D Autopsy & Medical Examiner Findings
                </h2>
                <p className="text-xs text-slate-400">
                  Interactive body mannequin viewer, pathology notes, and toxicological chromatography.
                </p>
              </div>
            </div>

            <div className="h-[600px]">
              <AnatomicalViewer injuries={forensicCase.injuries} />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 7: CRIME SCENE SPATIAL */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'crimescene' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Box className="w-5 h-5 text-cyan-400" />
                  3D Crime Scene Spatial Floorplan & Telemetry
                </h2>
                <p className="text-xs text-slate-400">
                  LiDAR point cloud reconstruction of Skyline Plaza Penthouse B.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl relative min-h-[450px] flex flex-col items-center justify-center space-y-4">
              <div className="w-full max-w-xl h-80 bg-slate-950 border border-slate-800 rounded-2xl p-4 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>

                {/* Spatial Floorplan Schematic */}
                <div className="w-full h-full border-2 border-slate-700 rounded-xl relative p-3 font-mono text-[10px]">
                  <div className="absolute top-2 left-2 text-cyan-400 font-bold">Penthouse Study Room (402)</div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 rounded-lg border border-red-500 bg-red-500/20 text-red-300 font-bold text-center">
                    Victim Location (Desk)
                  </div>
                  <div className="absolute bottom-4 right-4 p-2 rounded border border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold">
                    Touch DNA Doorknob (#B-42)
                  </div>
                  <div className="absolute top-4 right-4 p-2 rounded border border-amber-500 bg-amber-500/20 text-amber-300 font-bold">
                    RF Jammer Origin
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center max-w-md">
                Spatial point cloud confirms perpetrator entered via service balcony door at 22:36 PST and deployed localized RF frequency jammer.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 8: PHONE RECORDS & CDR */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'phonerecords' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-cyan-400" />
                  Call Detail Records (CDR) & Wiretap Transcripts
                </h2>
                <p className="text-xs text-slate-400">
                  Subpoenaed cellular logs, decrypted voice calls, and acoustic spectrograph matches.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(forensicCase.phoneRecords || []).map((cdr) => (
                <div key={cdr.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-400">{cdr.timestamp} • {cdr.location}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      {cdr.encryptionStatus}
                    </span>
                  </div>

                  <div className="text-xs text-slate-200">
                    <strong>Caller:</strong> {cdr.caller} → <strong>Receiver:</strong> {cdr.receiver} (Duration: {cdr.duration})
                  </div>

                  {cdr.transcriptSnippet && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed italic">
                      "{cdr.transcriptSnippet}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 9: GPS TELEMETRY */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'gps' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-cyan-400" />
                  GPS Telemetry & Cell Tower Triangulation
                </h2>
                <p className="text-xs text-slate-400">
                  Target device IMEI 359102941029 trajectory analysis for disproving airport alibi.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs">
                <strong>CRITICAL ALIBI ANOMALY:</strong> Suspect Victor Vance claimed he was boarding Flight QF-190 at Airport Terminal 2 at 22:45 PST. Telemetry places handset pinging Cell Tower #409 (120 meters from crime scene) between 22:38 and 23:05 PST.
              </div>

              <div className="h-72 rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col justify-center items-center text-xs space-y-3">
                <div className="text-slate-400 font-bold">Cell Tower #409 Triangulation Grid</div>
                <div className="flex items-center gap-6 font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <span className="text-cyan-400 font-bold block">Tower Sector 3</span>
                    <span className="text-slate-400 text-[10px]">Azimuth 120°</span>
                  </div>
                  <div className="text-amber-400 font-bold">← 120m Range →</div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <span className="text-red-400 font-bold block">Skyline Penthouse</span>
                    <span className="text-slate-400 text-[10px]">Crime Scene</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 10: WITNESSES & POIS */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'witnesses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Persons of Interest & Witness Statements
                </h2>
                <p className="text-xs text-slate-400">
                  Interrogation summaries, alibi statuses, and threat level assignments.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forensicCase.personsOfInterest.map((poi) => (
                <div key={poi.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={poi.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                        alt={poi.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{poi.name}</h3>
                        <span className="text-xs text-cyan-400 block">{poi.role}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      poi.threatLevel === 'Severe' || poi.threatLevel === 'High'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {poi.threatLevel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    {poi.notes}
                  </p>

                  {poi.dnaMatch && (
                    <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {poi.dnaMatch}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 11: AI COPILOT */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'copilot' && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-cyan-400" />
                  AI Forensic Copilot Assistant
                </h2>
                <p className="text-xs text-slate-400">
                  Ask questions about DNA STR loci, cell telemetry, toxicology matches, or evidence links.
                </p>
              </div>
            </div>

            {/* Copilot Chat Feed */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4 h-[420px] overflow-y-auto">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'copilot' && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`p-3.5 rounded-2xl max-w-2xl text-xs leading-relaxed space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-cyan-600 text-white rounded-br-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 flex-wrap text-[10px] text-cyan-400">
                        <span>Citations:</span>
                        {msg.citations.map((c, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">Suggested Actions:</span>
                        {msg.suggestedActions.map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendCopilot(act)}
                            className="block text-left w-full px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 text-[10px] border border-slate-800 transition-colors"
                          >
                            → {act}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
                placeholder="Ask AI Copilot regarding victim, suspect alibi, DNA match, or phone logs..."
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleSendCopilot()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2"
              >
                <span>Ask</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 12: DOSSIER REPORTS */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'reports' && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                  Official Forensic Dossier Generator
                </h2>
                <p className="text-xs text-slate-400">
                  Generate court-admissible forensic summary dossiers signed by Lead Det. A. Sharma.
                </p>
              </div>

              <button
                onClick={() => alert(`Exporting Official Forensic Dossier for Case ${forensicCase.id}...`)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <Download className="w-3.5 h-3.5" />
                Export Executive PDF Report
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 font-mono">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">FORENSIX OFFICIAL FORENSIC SUMMARY</h3>
                    <p className="text-[10px] text-slate-400">CASE ID: {forensicCase.id} • STATUS: {forensicCase.status}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-400 block">Lead Investigator</span>
                  <span className="text-cyan-400 font-bold">{forensicCase.leadInvestigator.name}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                <p>
                  <strong>Executive Incident Summary:</strong> {forensicCase.description}
                </p>

                <p>
                  <strong>Victim Findings:</strong> {forensicCase.victim?.name || 'Julian Vance'} confirmed deceased at {forensicCase.victim?.timeOfDeath || '2026-08-01 22:45 UTC'}. Cause of death identified as {forensicCase.victim?.causeOfDeath}.
                </p>

                <p>
                  <strong>Suspect Contradictions:</strong> Touch DNA recovered from Swab #B-42 yields a 99.98% CODIS match to prime suspect Victor Vance. Disproved airport alibi via Cell Tower #409 telemetry.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>Cryptographic Digest: SHA-256 Verified</span>
                <span>Signature: Det. A. Sharma [Badge #7091]</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODULE 13: SETTINGS */}
        {/* ---------------------------------------------------- */}
        {activeModule === 'settings' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-cyan-400" />
                  Case Access Controls & Security Settings
                </h2>
                <p className="text-xs text-slate-400">
                  Manage clearance levels, cryptographically lock evidence, and grant investigator permissions.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Clearance Level</span>
                  <span className="text-[11px] text-slate-400">Level 5 Top Secret Required for Full Access</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                  LEVEL 5 (ACTIVE)
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">SHA-256 Chain of Custody Integrity</span>
                  <span className="text-[11px] text-slate-400">All 14 evidence items cryptographically signed</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> LOCKED
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
