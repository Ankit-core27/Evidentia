import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { labelClass, selectClass } from '@/components/shared/formStyles';
import { ReportBuilder } from '@/features/reports/ReportBuilder';
import { useCases } from '@/hooks/useCases';
import { casePath, parseCaseId } from '@/lib/caseModules';

// Reports for any case. /reports?case=<id> preselects a case.
export const ReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const casesQuery = useCases();
  const cases = casesQuery.data ?? [];
  const requested = parseCaseId(searchParams.get('case') ?? undefined);
  const caseId = cases.some((c) => c.id === requested) ? requested! : cases[0]?.id;

  const picker = (
    <div>
      <label htmlFor="report-case" className={labelClass}>
        Case
      </label>
      <select
        id="report-case"
        value={caseId ?? ''}
        onChange={(e) => setSearchParams({ case: e.target.value }, { replace: true })}
        className={selectClass}
      >
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.case_number}: {c.title}
          </option>
        ))}
      </select>
      {caseId !== undefined && (
        <Link to={casePath(caseId, 'overview')} className="inline-block mt-1.5 text-xs text-accent-text hover:underline">
          Open case workspace
        </Link>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader level="page" title="Reports" description="Generate, review and print case reports. Each stored report carries a SHA-256 of its content." />
      {casesQuery.isPending && <LoadingState label="Loading cases…" />}
      {casesQuery.isError && <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} />}
      {casesQuery.data?.length === 0 && <EmptyState title="No cases yet" message="Create a case to build reports for it." />}
      {caseId !== undefined && <ReportBuilder key={caseId} caseId={caseId} caseSelector={picker} />}
    </div>
  );
};
