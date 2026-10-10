import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { labelClass } from '@/components/shared/formStyles';
import { ReportBuilder } from '@/features/reports/ReportBuilder';
import { useCases } from '@/hooks/useCases';
import { casePath, parseCaseId } from '@/lib/caseModules';

// Intelligence Hub: reports for any case. /reports?case=<id> preselects a case.
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
        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
      >
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.case_number}: {c.title}
          </option>
        ))}
      </select>
      {caseId !== undefined && (
        <Link to={casePath(caseId, 'overview')} className="inline-block mt-1 text-[10px] text-cyan-400 hover:underline">
          Open case workspace
        </Link>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6 font-mono">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
          Intelligence Hub
        </h1>
        <p className="text-xs text-slate-400 mt-1">Generate, review and print case reports.</p>
      </div>
      {casesQuery.isPending && <LoadingState label="Loading cases…" />}
      {casesQuery.isError && <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} />}
      {casesQuery.data?.length === 0 && <EmptyState title="No cases yet" message="Create a case to build reports for it." />}
      {caseId !== undefined && <ReportBuilder key={caseId} caseId={caseId} caseSelector={picker} />}
    </div>
  );
};
