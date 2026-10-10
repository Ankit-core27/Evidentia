import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Shield,
  CheckCircle2,
  FileText,
  Zap,
  Sliders,
  UserCheck,
  Calendar
} from 'lucide-react';
import { ForensicCase } from '../types';

interface ReportsGeneratorViewProps {
  cases: ForensicCase[];
  selectedCaseIdForReport?: string;
}

export const ReportsGeneratorView: React.FC<ReportsGeneratorViewProps> = ({
  cases,
  selectedCaseIdForReport
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    selectedCaseIdForReport || cases[0]?.id || ''
  );
  const [templateType, setTemplateType] = useState<'court' | 'autopsy' | 'audit' | 'summary'>('court');
  const [includeAiInsights, setIncludeAiInsights] = useState(true);
  const [includeChainOfCustody, setIncludeChainOfCustody] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const currentCase = cases.find((c) => c.id === selectedCaseId) || cases[0];

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      alert(`Forensic Dossier Report for ${currentCase?.id} compiled and downloaded successfully!`);
    }, 1200);
  };

  if (!currentCase) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            OFFICIAL FORENSIC REPORTS GENERATOR
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compile court-admissible forensic dossiers, autopsy briefs, and automated AI correlation logs.
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{isGeneratingPdf ? 'COMPILING PDF...' : 'EXPORT OFFICIAL DOSSIER'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Panel (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-5 font-mono text-xs">
          <div>
            <label className="block text-slate-300 font-bold uppercase mb-1.5">
              Select Case File
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.title.substring(0, 30)}...
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold uppercase mb-1.5">
              Report Template Format
            </label>
            <div className="space-y-2">
              {[
                { id: 'court', label: 'Full Court Trial Dossier & AI Synthesis' },
                { id: 'autopsy', label: 'Autopsy & Toxicology Special Report' },
                { id: 'audit', label: 'Chain of Custody & Hash Integrity Audit' },
                { id: 'summary', label: 'Executive Summary Briefing' }
              ].map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setTemplateType(tmpl.id as any)}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                    templateType === tmpl.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="block text-slate-400 font-bold uppercase mb-1">
              Include Optional Modules
            </span>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAiInsights}
                onChange={(e) => setIncludeAiInsights(e.target.checked)}
                className="rounded border-slate-800 text-cyan-500 focus:ring-0"
              />
              <span>AI Feature Extraction Insights</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeChainOfCustody}
                onChange={(e) => setIncludeChainOfCustody(e.target.checked)}
                className="rounded border-slate-800 text-cyan-500 focus:ring-0"
              />
              <span>SHA-256 Chain of Custody Ledger</span>
            </label>
          </div>
        </div>

        {/* Live Report Preview Document Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl relative font-mono text-slate-200 min-h-[600px]">
          {/* Watermark Seal */}
          <div className="absolute top-12 right-12 opacity-10 pointer-events-none">
            <Shield className="w-48 h-48 text-cyan-400" />
          </div>

          {/* Report Document Header */}
          <div className="pb-6 border-b border-slate-800 flex justify-between items-start">
            <div>
              <div className="text-cyan-400 font-bold text-xs tracking-widest uppercase mb-1">
                NATIONAL FORENSIC INVESTIGATION BUREAU
              </div>
              <h2 className="text-lg font-bold text-slate-100 uppercase">
                {templateType === 'court'
                  ? 'COURT TRIAL FORENSIC DOSSIER'
                  : templateType === 'autopsy'
                  ? 'MEDICAL EXAMINER AUTOPSY REPORT'
                  : 'CHAIN OF CUSTODY AUDIT LOG'}
              </h2>
              <span className="text-xs text-slate-400 block mt-1">
                Ref: {currentCase.id} • Classification: TOP SECRET / LEVEL 5
              </span>
            </div>

            <div className="text-right text-xs text-slate-400">
              <span className="block">Date: {new Date().toISOString().split('T')[0]}</span>
              <span className="block text-emerald-400 font-bold mt-1">SEAL VERIFIED</span>
            </div>
          </div>

          {/* Case Information Box */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 block">CASE TITLE:</span>
                <span className="font-bold text-slate-100">{currentCase.title}</span>
              </div>
              <div>
                <span className="text-slate-500 block">LEAD INVESTIGATOR:</span>
                <span className="font-bold text-slate-100">{currentCase.leadInvestigator.name} ({currentCase.leadInvestigator.badgeId})</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-slate-500 block">LOCATION:</span>
                <span className="text-slate-300">{currentCase.incidentLocation}</span>
              </div>
              <div>
                <span className="text-slate-500 block">STATUS:</span>
                <span className="text-cyan-400 font-bold">{currentCase.status}</span>
              </div>
            </div>
          </div>

          {/* Case Executive Brief */}
          <div className="space-y-2 text-xs">
            <h3 className="text-cyan-400 font-bold uppercase tracking-wider">
              1. Executive Case Summary
            </h3>
            <p className="text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
              {currentCase.description}
            </p>
          </div>

          {/* Autopsy Injury Highlights */}
          <div className="space-y-2 text-xs">
            <h3 className="text-cyan-400 font-bold uppercase tracking-wider">
              2. Medical Examiner Anatomical Findings
            </h3>
            <div className="space-y-2">
              {currentCase.injuries.map((inj) => (
                <div key={inj.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="font-bold text-slate-200 block">{inj.title} ({inj.type})</span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">{inj.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights Module */}
          {includeAiInsights && (
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs space-y-2">
              <h3 className="text-cyan-300 font-bold uppercase flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                3. Neural Network Correlation Analysis
              </h3>
              <p className="text-cyan-200 text-[11px] leading-relaxed">
                Automated STR loci comparison confirms suspect Victor Vance touch DNA on swab #B-42 with 99.98% certainty. Cell tower telemetry logs contradict suspect airport alibi by 22 miles during the estimated time of death.
              </p>
            </div>
          )}

          {/* Signature Block */}
          <div className="pt-8 border-t border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">AUTHORIZED SIGNATURE:</span>
              <span className="text-cyan-400 font-mono font-bold text-sm block mt-1">
                Dr. Evelyn Vance, Lead Specialist
              </span>
            </div>

            <div className="text-right">
              <span className="text-slate-500 block">DIGITAL FINGERPRINT:</span>
              <span className="text-[10px] text-slate-400 font-mono block mt-1">
                0x9F86D081884C7D659A2FEAA0C55AD015
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
