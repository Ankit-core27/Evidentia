import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Id } from '@/types/api';
import { ReportBuilder } from './ReportBuilder';

/** The workspace Reports tab: report builder and history for this case. */
export const CaseReportsModule: React.FC<{ caseId: Id }> = ({ caseId }) => (
  <div className="space-y-4">
    <div className="pb-3 border-b border-slate-800">
      <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
        Reports
      </h2>
      <p className="text-xs text-slate-400">Reports are assembled from this case's records and stored with a SHA-256 of their content.</p>
    </div>
    <ReportBuilder caseId={caseId} />
  </div>
);
