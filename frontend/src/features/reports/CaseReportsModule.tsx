import React from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Id } from '@/types/api';
import { ReportBuilder } from './ReportBuilder';

/** The workspace Reports tab: report builder and history for this case. */
export const CaseReportsModule: React.FC<{ caseId: Id }> = ({ caseId }) => (
  <div className="space-y-5">
    <PageHeader
      title="Reports"
      description="Reports are assembled from this case's records and stored with a SHA-256 of their content, so a printed copy can be checked later."
    />
    <ReportBuilder caseId={caseId} />
  </div>
);
