import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer } from 'lucide-react';
import { SectionHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useInvestigators } from '@/hooks/useCases';
import { useCaseReports, useCreateReport, useReport } from '@/hooks/useReports';
import { formatDateTime, shortHash } from '@/lib/format';
import { Id, Investigator, Report, ReportTemplate } from '@/types/api';
import { ReportDocument, TEMPLATE_LABELS } from './ReportDocument';

const TEMPLATES: { value: ReportTemplate; description: string }[] = [
  { value: 'court', description: 'Full dossier for court: findings, timeline, conflicts, scenarios and the evidence inventory.' },
  { value: 'summary', description: 'Where the investigation stands: findings, timeline and open questions.' },
  { value: 'custody', description: 'Evidence inventory with hashes and every custody event.' },
  { value: 'medical', description: 'Medical evidence, injuries and findings about people.' }
];

/** Report export is the browser's print of this copy; the print stylesheet hides the app around it. */
const PrintCopy: React.FC<{ report: Report; investigators: Investigator[] | undefined }> = (props) =>
  createPortal(
    <div className="print-root" aria-hidden="true">
      <ReportDocument {...props} />
    </div>,
    document.body
  );

/**
 * Builds reports for one case (POST /api/cases/{id}/reports), lists the ones already stored
 * and shows the selected one, ready to print. Used by the workspace Reports tab and the
 * Reports page, which passes its case picker in as `caseSelector`.
 */
export const ReportBuilder: React.FC<{ caseId: Id; caseSelector?: React.ReactNode }> = ({ caseId, caseSelector }) => {
  const [template, setTemplate] = useState<ReportTemplate>('court');
  const [includeAi, setIncludeAi] = useState(false);
  const [includeCustody, setIncludeCustody] = useState(true);
  const [selectedId, setSelectedId] = useState<Id | null>(null);

  const investigators = useInvestigators();
  const create = useCreateReport(caseId);
  const history = useCaseReports(caseId);
  const shownId = selectedId ?? history.data?.[0]?.id ?? null;
  const reportQuery = useReport(shownId);
  const report = reportQuery.data?.case_id === caseId ? reportQuery.data : undefined;
  const custodyForced = template === 'custody';

  const generate = () =>
    create.mutate(
      { template, options: { include_ai_insights: includeAi, include_custody: includeCustody || custodyForced } },
      { onSuccess: (r) => setSelectedId(r.id) }
    );

  const print = () => {
    if (!report) return;
    const title = document.title;
    document.title = `${report.content.case.case_number} ${TEMPLATE_LABELS[report.template]} #${report.id}`;
    window.print();
    document.title = title;
  };

  const toggle = (checked: boolean, onChange: (v: boolean) => void, label: string, hint: string, disabled = false) => (
    <label className={`flex items-start gap-2.5 px-3 py-2 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="block text-body text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
    </label>
  );

  const legend = 'text-xs font-medium text-ink-soft mb-1.5';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-x-8 gap-y-6 items-start">
      <div className="xl:col-span-4 space-y-6">
        <section className="space-y-4" aria-label="New report">
          {caseSelector}
          <fieldset>
            <legend className={legend}>Template</legend>
            <div className="rounded-md border border-line divide-y divide-line">
              {TEMPLATES.map((t) => (
                <label key={t.value} className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer ${template === t.value ? 'bg-accent/5' : 'hover:bg-surface'}`}>
                  <input
                    type="radio"
                    name="report-template"
                    value={t.value}
                    checked={template === t.value}
                    onChange={() => setTemplate(t.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-body text-ink">{TEMPLATE_LABELS[t.value]}</span>
                    <span className="block text-xs text-ink-muted">{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>Include</legend>
            <div className="rounded-md border border-line divide-y divide-line">
              {toggle(includeAi, setIncludeAi, 'AI insights', 'Model-written evidence summaries, marked as unconfirmed.')}
              {toggle(
                includeCustody || custodyForced,
                setIncludeCustody,
                'Custody ledger',
                custodyForced ? 'Always part of the chain of custody audit.' : 'Every upload, view, change and export of the evidence.',
                custodyForced
              )}
            </div>
          </fieldset>
          <button onClick={generate} disabled={create.isPending} className={`${primaryButtonClass} w-full`}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Generate report
          </button>
          {create.isError && (
            <p className="text-xs text-danger" role="alert">
              {(create.error as Error).message}
            </p>
          )}
        </section>

        <section className="space-y-2" aria-label="Report history">
          <SectionHeader title="Report history" count={history.data?.length} />
          {history.isPending && <LoadingState />}
          {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}
          {history.data?.length === 0 && <p className="text-body text-ink-muted">No reports for this case yet.</p>}
          {!!history.data?.length && (
            <ul className="rounded-md border border-line divide-y divide-line">
              {history.data.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    aria-current={r.id === shownId || undefined}
                    className={`w-full text-left px-3 py-2 transition-colors ${r.id === shownId ? 'bg-accent/10' : 'hover:bg-surface'}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-body text-ink">
                        <span className="font-mono text-xs text-ink-muted mr-1.5">#{r.id}</span>
                        {TEMPLATE_LABELS[r.template]}
                      </span>
                      <span className="text-2xs text-ink-muted font-mono">{shortHash(r.sha256)}</span>
                    </span>
                    <span className="block text-xs text-ink-muted">
                      <span className="font-mono">{formatDateTime(r.created_at)}</span> ·{' '}
                      {investigators.data?.find((i) => i.id === r.created_by)?.name ?? 'Unknown'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="xl:col-span-8 space-y-3 min-w-0">
        {shownId === null && !history.isPending && (
          <EmptyState title="No report yet" message="Choose a template and generate a report, or open one from the history." className="py-16" />
        )}
        {shownId !== null && reportQuery.isPending && <LoadingState label="Loading report…" />}
        {reportQuery.isError && <ErrorState error={reportQuery.error} onRetry={() => reportQuery.refetch()} />}
        {report && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">
                Report <span className="font-mono">#{report.id}</span>, generated <span className="font-mono">{formatDateTime(report.created_at)}</span>.
                Print it, or save it as a PDF from the print dialog.
              </p>
              <button onClick={print} className={secondaryButtonClass}>
                <Printer className="size-3.5" aria-hidden /> Print or save PDF
              </button>
            </div>
            <ReportDocument report={report} investigators={investigators.data} />
            <PrintCopy report={report} investigators={investigators.data} />
          </>
        )}
      </div>
    </div>
  );
};
