import React from 'react';
import { formatBytes, formatDateTime, formatTimeRange, humanize } from '@/lib/format';
import { describeAuditDetail } from '@/lib/audit';
import { Investigator, Report, ReportTemplate } from '@/types/api';

export const TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  court: 'Court dossier',
  summary: 'Investigation summary',
  custody: 'Chain of custody audit',
  medical: 'Medical findings'
};

interface ReportDocumentProps {
  report: Report;
  investigators: Investigator[] | undefined;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 break-after-avoid">{title}</h2>
    {children}
  </section>
);

const th = 'text-left font-semibold text-slate-600 px-2 py-1 border-b border-slate-300';
const td = 'px-2 py-1 border-b border-slate-200 align-top';

/**
 * A stored report (POST /api/cases/{id}/reports), laid out as a printable page. Every
 * section comes from the report content the backend assembled; nothing here is invented.
 */
export const ReportDocument: React.FC<ReportDocumentProps> = ({ report, investigators }) => {
  const c = report.content;
  const name = (id: number | null) => investigators?.find((i) => i.id === id)?.name ?? (id === null ? 'Unknown' : `Investigator #${id}`);
  const evidenceTitle = (id: number) => c.evidence.find((e) => e.id === id)?.title ?? `Evidence #${id}`;
  let n = 0;
  const numbered = (title: string) => `${++n}. ${title}`;

  return (
    <article
      className="print-report bg-white text-slate-800 rounded-xl shadow-2xl p-8 space-y-6 font-sans text-[12px] leading-relaxed"
      data-testid="report-document"
    >
      <header className="flex justify-between gap-6 border-b-2 border-slate-800 pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Forensix · {TEMPLATE_LABELS[report.template]}</div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{c.case.title}</h1>
          <div className="text-slate-600 mt-1">
            {c.case.case_number} · {humanize(c.case.incident_type)} · Status: {humanize(c.case.status)} · Priority: {humanize(c.case.priority)}
          </div>
        </div>
        <dl className="text-right text-[11px] text-slate-600 shrink-0">
          <dt className="sr-only">Incident</dt>
          <dd>Incident: {formatDateTime(c.case.incident_at)}</dd>
          <dd>Lead: {c.case.lead_investigator_name ?? 'Not assigned'}</dd>
          <dd>Generated: {formatDateTime(report.created_at)}</dd>
          <dd>By: {name(report.created_by)}</dd>
        </dl>
      </header>

      {c.summary && (
        <Section title={numbered('Case summary')}>
          <p className="whitespace-pre-wrap">{c.summary}</p>
        </Section>
      )}

      {c.persons.length > 0 && (
        <Section title={numbered('People')}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Role</th>
                <th className={th}>Condition</th>
                <th className={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {c.persons.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    {p.name}
                    {p.review_status === 'pending' && <span className="text-[10px] text-purple-700"> (AI proposal, unconfirmed)</span>}
                  </td>
                  <td className={td}>{humanize(p.role)}</td>
                  <td className={td}>{p.condition ? humanize(p.condition) : '—'}</td>
                  <td className={td}>{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {c.timeline.length > 0 && (
        <Section title={numbered('Timeline')}>
          <table className="w-full border-collapse">
            <tbody>
              {c.timeline.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} whitespace-nowrap w-48`}>{formatTimeRange(e.time_start, e.time_end, e.time_precision)}</td>
                  <td className={td}>
                    {e.description}
                    {e.certainty !== 'established' && <span className="text-amber-700"> ({e.certainty})</span>}
                    {e.review_status === 'pending' && <span className="text-[10px] text-purple-700"> (AI proposal, unconfirmed)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {c.confirmed_findings.length > 0 && (
        <Section title={numbered('Confirmed findings')}>
          <ul className="list-disc pl-5 space-y-1">
            {c.confirmed_findings.map((f, i) => (
              <li key={i}>
                {f.statement}
                {f.evidence_ids.length > 0 && (
                  <span className="text-slate-500"> Source: {f.evidence_ids.map(evidenceTitle).join('; ')}.</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.injuries.length > 0 && (
        <Section title={numbered('Injuries')}>
          <ul className="list-disc pl-5 space-y-1">
            {c.injuries.map((i) => (
              <li key={i.id}>
                {i.type}, {humanize(i.body_region).toLowerCase()} ({i.severity}): {i.description}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(c.open_conflicts.length > 0 || c.uncertainties.length > 0) && (
        <Section title={numbered('Open conflicts and uncertainties')}>
          {c.open_conflicts.map((conflict, i) => (
            <div key={i} className="space-y-1">
              <p className="font-semibold">{conflict.description}</p>
              <ul className="list-disc pl-5">
                {conflict.statements.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
          {c.uncertainties.length > 0 && (
            <ul className="list-disc pl-5">
              {c.uncertainties.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {c.reconstructions.length > 0 && (
        <Section title={numbered('Reconstruction scenarios')}>
          {c.reconstructions.map((r, i) => (
            <div key={i}>
              <p className="font-semibold">
                {r.scenario} (version {r.version})
              </p>
              <p className="text-slate-600">{r.assumptions || 'No assumptions recorded.'}</p>
            </div>
          ))}
        </Section>
      )}

      {c.evidence.length > 0 && (
        <Section title={numbered('Evidence inventory')}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Item</th>
                <th className={th}>Type</th>
                <th className={th}>Collected</th>
                <th className={th}>Size</th>
                <th className={th}>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {c.evidence.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{e.title}</td>
                  <td className={td}>{humanize(e.type)}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(e.collected_at)}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatBytes(e.size_bytes)}</td>
                  <td className={`${td} font-mono text-[9px] break-all`}>{e.sha256}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {c.ai_insights && c.ai_insights.length > 0 && (
        <Section title={numbered('AI insights (not confirmed findings)')}>
          <ul className="list-disc pl-5 space-y-1 text-slate-700">
            {c.ai_insights.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </Section>
      )}

      {c.custody && c.custody.length > 0 && (
        <Section title={numbered('Chain of custody')}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Who</th>
                <th className={th}>Action</th>
                <th className={th}>Item</th>
                <th className={th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {c.custody.map((a) => (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(a.at)}</td>
                  <td className={td}>{a.actor_name ?? 'Unknown'}</td>
                  <td className={td}>{humanize(a.action)}</td>
                  <td className={td}>{evidenceTitle(a.record_id)}</td>
                  <td className={`${td} text-[10px]`}>{describeAuditDetail(a) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <footer className="pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between gap-4">
        <span>
          Report #{report.id} · {TEMPLATE_LABELS[report.template]} · AI insights {c.ai_insights ? 'included' : 'excluded'} · custody ledger{' '}
          {c.custody ? 'included' : 'excluded'}
        </span>
        <span className="font-mono break-all text-right" data-testid="report-sha256">
          SHA-256 {report.sha256}
        </span>
      </footer>
    </article>
  );
};
