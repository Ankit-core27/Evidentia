import React, { useState } from 'react';
import {
  Fingerprint,
  Search,
  Filter,
  ShieldCheck,
  FileText,
  Dna,
  Radio,
  Volume2,
  HardDrive,
  Flame,
  Eye,
  Download,
  ExternalLink
} from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceLockerViewProps {
  evidenceList: EvidenceItem[];
  onPreviewEvidence: (item: EvidenceItem) => void;
  onSelectCase: (caseId: string) => void;
}

export const EvidenceLockerView: React.FC<EvidenceLockerViewProps> = ({
  evidenceList,
  onPreviewEvidence,
  onSelectCase
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredList = evidenceList.filter((item) => {
    const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
    const matchesQuery =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.caseTitle && item.caseTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesType && matchesQuery;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DNA':
        return <Dna className="w-4 h-4 text-emerald-400" />;
      case 'GPS':
        return <Radio className="w-4 h-4 text-amber-400" />;
      case 'Audio/Transcript':
        return <Volume2 className="w-4 h-4 text-cyan-400" />;
      case 'Chemical/Tox':
        return <Flame className="w-4 h-4 text-purple-400" />;
      default:
        return <FileText className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Locker Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-cyan-400" />
            GLOBAL FORENSIC EVIDENCE LOCKER
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Central repository of immutable digital evidence, SHA-256 hash checksums, and chain of custody logs.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>100% SHA-256 HASH CHECKSUM VERIFIED</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search evidence by title, ID, or case name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="md:col-span-7 flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
          {['ALL', 'Autopsy', 'DNA', 'GPS', 'Audio/Transcript', 'Digital File', 'Chemical/Tox'].map(
            (type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  typeFilter === type
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            )
          )}
        </div>
      </div>

      {/* Evidence Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-cyan-500/50 transition-all space-y-3 font-mono flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] text-cyan-400 font-bold">{item.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                  {item.fileSize}
                </span>
              </div>

              <div className="mt-3 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                  {getTypeIcon(item.type)}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => onSelectCase(item.caseId)}
                className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 truncate max-w-[160px]"
              >
                <span>Case: {item.caseId}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </button>

              <button
                onClick={() => onPreviewEvidence(item)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>INSPECT</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredList.length === 0 && (
        <div className="p-12 text-center text-slate-500 font-mono text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
          No global evidence items match the filter criteria.
        </div>
      )}
    </div>
  );
};
