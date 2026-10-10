import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, Printer, Sparkles } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
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
 * Intelligence Hub, which passes its case picker in as `caseSelector`.
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
    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-950 ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-slate-700'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-cyan-500" />
      <span>
        <span className="block text-slate-200 font-bold">{label}</span>
        <span className="block text-[10px] text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-4 space-y-4 text-xs">
        <section className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4" aria-label="New report">
          {caseSelector}
          <fieldset className="space-y-1.5">
            <legend className={labelClass}>Template</legend>
            {TEMPLATES.map((t) => (
              <label
                key={t.value}
                className={`block p-2.5 rounded-xl border cursor-pointer ${
                  template === t.value ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input type="radio" name="report-template" value={t.value} checked={template === t.value} onChange={() => setTemplate(t.value)} className="sr-only" />
                <span className={`block font-bold ${template === t.value ? 'text-cyan-300' : 'text-slate-200'}`}>{TEMPLATE_LABELS[t.value]}</span>
                <span className="block text-[10px] text-slate-500">{t.description}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className={labelClass}>Include</legend>
            {toggle(includeAi, setIncludeAi, 'AI insights', 'Model-written evidence summaries, marked as unconfirmed.')}
            {toggle(
              includeCustody || custodyForced,
              setIncludeCustody,
              'Custody ledger',
              custodyForced ? 'Always part of the chain of custody audit.' : 'Every upload, view, change and export of the evidence.',
              custodyForced
            )}
          </fieldset>
          <button onClick={generate} disabled={create.isPending} className={`${primaryButtonClass} w-full justify-center`}>
            {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate report
          </button>
          {create.isError && <p className="text-red-300" role="alert">{(create.error as Error).message}</p>}
        </section>

        <section className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2" aria-label="Report history">
          <h3 className="text-xs font-bold text-slate-200 uppercase">Report history</h3>
          {history.isPending && <LoadingState />}
          {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}
          {history.data?.length === 0 && <p className="text-[11px] text-slate-500">No reports for this case yet.</p>}
          <ul className="space-y-1.5">
            {history.data?.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  aria-current={r.id === shownId || undefined}
                  className={`w-full text-left p-2.5 rounded-xl border ${
                    r.id === shownId ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200">
                      #{r.id} {TEMPLATE_LABELS[r.template]}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{shortHash(r.sha256)}</span>
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {formatDateTime(r.created_at)} · {investigators.data?.find((i) => i.id === r.created_by)?.name ?? 'Unknown'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="xl:col-span-8 space-y-3 min-w-0">
        {shownId === null && !history.isPending && (
          <EmptyState title="No report selected" message="Choose a template and generate a report, or open one from the history." />
        )}
        {shownId !== null && reportQuery.isPending && <LoadingState label="Loading report…" />}
        {reportQuery.isError && <ErrorState error={reportQuery.error} onRetry={() => reportQuery.refetch()} />}
        {report && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                Report #{report.id}, generated {formatDateTime(report.created_at)}. Print or save it as PDF from the browser.
              </p>
              <button onClick={print} className={secondaryButtonClass}>
                <Printer className="w-3.5 h-3.5" /> Print / PDF
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
