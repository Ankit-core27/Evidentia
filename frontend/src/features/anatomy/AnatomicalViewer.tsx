import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Eye,
  ShieldAlert,
  Flame,
  Zap,
  RotateCcw,
  Info,
  CheckCircle2
} from 'lucide-react';
import { AnatomicalInjury } from '@/types';

interface AnatomicalViewerProps {
  injuries: AnatomicalInjury[];
}

export const AnatomicalViewer: React.FC<AnatomicalViewerProps> = ({ injuries }) => {
  const [viewAngle, setViewAngle] = useState<'front' | 'back'>('front');
  const [selectedInjuryId, setSelectedInjuryId] = useState<string>(injuries[0]?.id || '');
  const [toxScanActive, setToxScanActive] = useState<boolean>(true);

  const selectedInjury = injuries.find((i) => i.id === selectedInjuryId) || injuries[0];

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800/90 overflow-hidden">
      {/* Visualizer Header */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            3D AUTOPSY ANATOMICAL BREAKDOWN
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tox Scan Toggle */}
          <button
            onClick={() => setToxScanActive(!toxScanActive)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all flex items-center gap-1.5 ${
              toxScanActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Tox Scan Overlay</span>
          </button>

          {/* Front / Back Angle Toggle */}
          <button
            onClick={() => setViewAngle(viewAngle === 'front' ? 'back' : 'front')}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
            title="Rotate Body Angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 items-stretch">
        {/* Left Interactive Body Silhouette SVG Stage (7 Cols) */}
        <div className="md:col-span-7 relative bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center min-h-[380px] overflow-hidden">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px] opacity-30 pointer-events-none"></div>

          {/* Glowing Toxicological Scan Radial Rays */}
          {toxScanActive && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.08)_0,transparent_70%)] pointer-events-none animate-pulse"></div>
          )}

          {/* Body Silhouette SVG */}
          <div className="relative w-48 h-[340px] flex items-center justify-center">
            <svg
              viewBox="0 0 100 220"
              className={`w-full h-full transition-transform duration-500 filter drop-shadow-[0_0_10px_rgba(6,182,212,0.15)] ${
                viewAngle === 'back' ? 'scale-x-[-1]' : ''
              }`}
            >
              {/* Body Silhouette Outline */}
              <g fill="#0f172a" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.6">
                {/* Head */}
                <ellipse cx="50" cy="22" rx="14" ry="17" />
                {/* Neck */}
                <path d="M 43 38 L 57 38 L 59 48 L 41 48 Z" />
                {/* Torso & Abdomen */}
                <path d="M 32 48 L 68 48 L 63 115 L 37 115 Z" />
                {/* Left Arm */}
                <path d="M 32 48 L 22 55 L 15 105 L 22 105 L 28 65 L 34 52 Z" />
                {/* Right Arm */}
                <path d="M 68 48 L 78 55 L 85 105 L 78 105 L 72 65 L 66 52 Z" />
                {/* Pelvis & Legs */}
                <path d="M 37 115 L 49 115 L 47 200 L 35 200 Z" />
                <path d="M 51 115 L 63 115 L 65 200 L 53 200 Z" />
              </g>

              {/* Toxicological Chemical Vascular Overlay */}
              {toxScanActive && (
                <g stroke="#f59e0b" strokeWidth="0.8" fill="none" opacity="0.8" className="animate-pulse">
                  <path d="M 50 40 Q 50 60, 48 80 Q 42 100, 44 140" strokeDasharray="2 2" />
                  <path d="M 50 40 Q 52 60, 54 80 Q 60 100, 58 140" strokeDasharray="2 2" />
                  <circle cx="52" cy="42" r="3" fill="#f59e0b" fillOpacity="0.4" />
                </g>
              )}

              {/* Anatomical Injury Interactive Touchpoints */}
              {injuries.map((injury) => {
                const isSelected = selectedInjury?.id === injury.id;
                const isFatal = injury.severity === 'Fatal';

                return (
                  <g
                    key={injury.id}
                    onClick={() => setSelectedInjuryId(injury.id)}
                    className="cursor-pointer group"
                  >
                    {/* Glowing Ping Circle */}
                    <circle
                      cx={injury.coordinates.x}
                      cy={injury.coordinates.y}
                      r={isSelected ? '8' : '5'}
                      fill={isFatal ? '#ef4444' : '#f59e0b'}
                      fillOpacity={isSelected ? '0.6' : '0.3'}
                      className="animate-ping"
                    />

                    {/* Touchpoint Core Pin */}
                    <circle
                      cx={injury.coordinates.x}
                      cy={injury.coordinates.y}
                      r={isSelected ? '4' : '3'}
                      fill={isFatal ? '#ef4444' : '#f59e0b'}
                      stroke="#020617"
                      strokeWidth="1.5"
                      className="transition-all duration-200 group-hover:scale-125"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 text-[10px] text-slate-500 font-mono text-center">
            Click anatomical touchpoints to inspect injury depth & chemical chromatography.
          </div>
        </div>

        {/* Right Selected Injury Card (5 Cols) */}
        <div className="md:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          {selectedInjury ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                  ANATOMICAL TOUCHPOINT DETAILS
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedInjury.severity === 'Fatal'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {selectedInjury.severity}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-mono font-bold text-slate-100">
                  {selectedInjury.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Type: {selectedInjury.type} • Trauma Depth: {selectedInjury.depth}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                {selectedInjury.description}
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase block flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> AI DIAGNOSTIC CORRELATION
                </span>
                <p className="text-[11px] leading-normal">{selectedInjury.aiNotes}</p>
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                Estimated Time of Injury: {selectedInjury.estimatedTimeOfInjury}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 font-mono">
              Select a touchpoint to inspect medical examiner records.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
