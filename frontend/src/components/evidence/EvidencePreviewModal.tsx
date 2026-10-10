import React, { useState } from 'react';
import {
  X,
  Dna,
  Radio,
  FileText,
  Volume2,
  HardDrive,
  Download,
  ShieldCheck,
  Zap,
  Play,
  Pause,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { EvidenceItem } from '@/types';

interface EvidencePreviewModalProps {
  evidence: EvidenceItem | null;
  onClose: () => void;
}

export const EvidencePreviewModal: React.FC<EvidencePreviewModalProps> = ({
  evidence,
  onClose
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!evidence) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {evidence.type === 'DNA' ? (
                <Dna className="w-5 h-5 text-emerald-400" />
              ) : evidence.type === 'GPS' ? (
                <Radio className="w-5 h-5 text-amber-400" />
              ) : (
                <FileText className="w-5 h-5 text-cyan-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-100">
                  {evidence.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                  {evidence.type}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                ID: {evidence.id} • Added: {evidence.dateAdded} • Size: {evidence.fileSize}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 font-mono">
          {/* SHA-256 Hash Integrity Badge */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>SHA-256 HASH VERIFIED INTEGRITY</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
              {evidence.sha256}
            </span>
          </div>

          {/* DYNAMIC VISUALIZER CONTENT ACCORDING TO EVIDENCE TYPE */}

          {/* 1. DNA Sequence Analysis */}
          {evidence.type === 'DNA' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-emerald-400" />
                  HIGH-THROUGHPUT NUCLEOBASE STR SEQUENCE MATCH
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  CODIS MATCH 99.98%
                </span>
              </div>

              {/* Simulated Nucleobase Grid */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono tracking-widest overflow-x-auto flex gap-1">
                {['A', 'T', 'C', 'G', 'G', 'C', 'A', 'T', 'T', 'A', 'C', 'G', 'A', 'T', 'C', 'G'].map(
                  (base, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-1 rounded text-center font-bold ${
                        base === 'A'
                          ? 'bg-red-500/20 text-red-400'
                          : base === 'T'
                          ? 'bg-blue-500/20 text-blue-400'
                          : base === 'C'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {base}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* 2. Audio Waveform Simulator */}
          {evidence.type === 'Audio/Transcript' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  SPECTROGRAM SPEECH ANALYSIS & VOICEPRINT MATCH
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  SPECTRAL MATCH 98.4%
                </span>
              </div>

              {/* Waveform Visualization Bars */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between gap-1 h-16">
                {[20, 45, 60, 30, 80, 95, 40, 70, 90, 100, 60, 30, 75, 85, 40, 20].map(
                  (val, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${val}%` }}
                      className={`w-2 rounded-full transition-all ${
                        isPlayingAudio ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'
                      }`}
                    ></div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2"
                >
                  {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlayingAudio ? 'Pause Audio' : 'Play Intercepted Wiretap'}</span>
                </button>

                <span className="text-xs text-slate-400">00:03:42 / 00:03:42</span>
              </div>
            </div>
          )}

          {/* AI Insights Summary */}
          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 space-y-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
              <Zap className="w-4 h-4" /> AI Automated Forensic Feature Extraction
            </span>
            <p className="leading-relaxed">{evidence.summary}</p>
            {evidence.aiInsights && (
              <p className="text-[11px] text-cyan-300 italic pt-1 border-t border-cyan-500/20">
                Note: {evidence.aiInsights}
              </p>
            )}
          </div>

          {/* Chain of Custody Audit Log */}
          <div>
            <span className="text-xs font-bold text-slate-200 uppercase block mb-2">
              Chain of Custody Ledger ({evidence.chainOfCustody.length} Actions)
            </span>

            <div className="space-y-2">
              {evidence.chainOfCustody.map((coc, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-200 block">{coc.officer}</span>
                    <span className="text-[11px] text-slate-400">{coc.action}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{coc.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3 font-mono">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
          >
            Close Inspector
          </button>
          <button
            onClick={() => alert(`Downloading forensic evidence file ${evidence.id}...`)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export File
          </button>
        </div>
      </div>
    </div>
  );
};
