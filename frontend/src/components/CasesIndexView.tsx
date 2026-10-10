import React, { useState } from 'react';
import {
  FolderSearch,
  Plus,
  Filter,
  Search,
  ArrowUpDown,
  Eye,
  FileText,
  Shield,
  Activity,
  UserCheck,
  Calendar,
  Layers,
  ChevronRight,
  Flame
} from 'lucide-react';
import { ForensicCase, CaseStatus, CasePriority } from '../types';

interface CasesIndexViewProps {
  cases: ForensicCase[];
  onSelectCase: (caseId: string) => void;
  onOpenCreateModal: () => void;
  onNavigateToReports: (caseId?: string) => void;
}

export const CasesIndexView: React.FC<CasesIndexViewProps> = ({
  cases,
  onSelectCase,
  onOpenCreateModal,
  onNavigateToReports
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const filteredCases = cases.filter((c) => {
    const matchesQuery =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.leadInvestigator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.incidentLocation.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || c.priority === priorityFilter;

    return matchesQuery && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Forensic Testing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            Forensic Testing
          </span>
        );
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Open
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Closed
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Under Review
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: CasePriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40 uppercase animate-pulse">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header & New Case Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-cyan-400" />
            ACTIVE CASE DOSSIER INDEX
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse, filter, and initiate deep forensic timeline & evidence analysis.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          id="cases-create-case-btn"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
          <span>CREATE NEW CASE</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        {/* Search Input */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cases by Title, Case ID, Lead or Location..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            id="case-search-input"
          />
        </div>

        {/* Status Dropdown Filter */}
        <div className="md:col-span-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            id="status-filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="Forensic Testing">Forensic Testing</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Under Review">Under Review</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="md:col-span-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            id="priority-filter-select"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="md:col-span-1 flex items-center justify-end font-mono text-[11px] text-slate-500">
          {filteredCases.length} Cases
        </div>
      </div>

      {/* Cases Data Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Case ID</th>
                <th className="py-3.5 px-4 font-semibold">Title & Location</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Priority</th>
                <th className="py-3.5 px-4 font-semibold">Lead Investigator</th>
                <th className="py-3.5 px-4 font-semibold">Created Date</th>
                <th className="py-3.5 px-4 font-semibold text-center">Evidence</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredCases.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                  onClick={() => onSelectCase(c.id)}
                >
                  {/* Case ID */}
                  <td className="py-4 px-4 font-mono font-bold text-cyan-400 whitespace-nowrap">
                    {c.id}
                  </td>

                  {/* Title & Location */}
                  <td className="py-4 px-4 max-w-xs">
                    <span className="font-bold text-slate-200 block group-hover:text-cyan-300 transition-colors">
                      {c.title}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5 truncate">
                      {c.incidentLocation}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {getStatusBadge(c.status)}
                  </td>

                  {/* Priority */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {getPriorityBadge(c.priority)}
                  </td>

                  {/* Lead Investigator */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={c.leadInvestigator.avatar}
                        alt={c.leadInvestigator.name}
                        className="w-7 h-7 rounded-lg object-cover border border-slate-700"
                      />
                      <div>
                        <span className="text-xs text-slate-200 block font-medium">
                          {c.leadInvestigator.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {c.leadInvestigator.badgeId}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Created Date */}
                  <td className="py-4 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {c.dateCreated}
                  </td>

                  {/* Evidence Count */}
                  <td className="py-4 px-4 text-center whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-mono text-[11px]">
                      {c.evidenceCount} Files
                    </span>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-4 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectCase(c.id)}
                        className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1 transition-colors"
                        title="Open Deep Analysis"
                        id={`deep-analysis-btn-${c.id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">ANALYZE</span>
                      </button>

                      <button
                        onClick={() => onNavigateToReports(c.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1 transition-colors"
                        title="Generate Report"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No forensic cases match the query criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
