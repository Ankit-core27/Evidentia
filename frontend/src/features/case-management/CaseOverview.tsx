import React from 'react';
import {
  Folder,
  Dna,
  Users,
  Clock,
  Zap,
  Share2,
  CheckCircle2,
  Shield,
  ExternalLink,
  Video,
  Bot
} from 'lucide-react';
import { ForensicCase, EvidenceItem, CaseModule } from '@/types';
import { NetworkGraphViewer } from '@/features/evidence-canvas/NetworkGraphViewer';

interface CaseOverviewProps {
  forensicCase: ForensicCase;
  onSelectModule: (module: CaseModule) => void;
  onPreviewEvidence: (item: EvidenceItem) => void;
  onAskCopilot: (question: string) => void;
}

export const CaseOverview: React.FC<CaseOverviewProps> = ({
  forensicCase,
  onSelectModule,
  onPreviewEvidence,
  onAskCopilot
}) => {
  // Primary Suspect
  const primarySuspect = forensicCase.personsOfInterest.find((p) => p.role === 'Suspect') || forensicCase.personsOfInterest[0];

  return (
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
              onClick={() => onSelectModule('people')}
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
                  onAskCopilot('Provide complete forensic breakdown regarding the victim Julian Vance.');
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
  );
};
