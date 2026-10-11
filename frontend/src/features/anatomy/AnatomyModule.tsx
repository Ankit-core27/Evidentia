import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { inputClass, labelClass, primaryButtonClass, selectClass, smallButtonClass } from '@/components/shared/formStyles';
import { useInjuries, useUpdateInjury } from '@/hooks/useInjuries';
import { useAnatomyAIStatus, useAnatomyFindings, useMedicalAnalysis, useReviewAnatomyFinding } from '@/hooks/useAnatomy';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { casePath } from '@/lib/caseModules';
import { humanize } from '@/lib/format';
import type { AnatomyFinding, CaseWorkspace, Injury, ReviewStatus, Vec3 } from '@/types/api';
import { AnatomicalViewer, useAnatomyManifest } from './AnatomicalViewer';
import { Finding, findingKey, findingState, findingsForPerson, mapFinding } from './anatomyEngine';

export const AnatomyModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const injuries = useInjuries(workspace.case.id);
  const findings = useAnatomyFindings(workspace.case.id);
  const [person, setPerson] = useState(String(workspace.injuries.find(i => i.person_id !== null)?.person_id ?? workspace.persons[0]?.id ?? 'unassigned'));
  const people = workspace.persons.filter(p => p.review_status !== 'rejected');
  const selected = people.find(p => String(p.id) === person);
  const personId = selected?.id ?? null;
  return <section className="space-y-4" aria-label="Autopsy and medical examination">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Medical examination · M5</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">Anatomy & findings</h2>
        <p className="mt-1 text-body text-ink-muted">Examine recorded findings alongside segmented reference anatomy.</p></div>
      <div className="w-full sm:w-64"><label className={labelClass} htmlFor="anatomy-person">Person</label>
        <select id="anatomy-person" className={selectClass} value={selected ? person : 'unassigned'} onChange={e => setPerson(e.target.value)}>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}{p.condition ? ` · ${humanize(p.condition)}` : ''}</option>)}
          <option value="unassigned">Unassigned findings — no person</option>
        </select></div>
    </div>
    {selected && <p className="text-body text-ink-soft">{selected.name} · {selected.condition ? humanize(selected.condition) : 'Condition not documented'}. Report classification does not change this person’s recorded condition.</p>}
    {!selected && <p className="border-l-2 border-warn pl-3 text-body text-warn">These findings have no assigned person. They are not attributed to anyone else in this case. Select a person to request report analysis.</p>}
    {injuries.isPending || findings.isPending ? <LoadingState label="Loading medical records…" /> : injuries.isError || findings.isError ?
      <ErrorState error={injuries.error ?? findings.error} onRetry={() => { void injuries.refetch(); void findings.refetch(); }} /> :
      <Examination key={`${workspace.case.id}:${personId ?? 'unassigned'}`} workspace={workspace} personId={personId} injuries={injuries.data} findings={findings.data} />}
  </section>;
};

function Examination({ workspace, personId, injuries, findings }: { workspace: CaseWorkspace; personId: number | null; injuries: Injury[]; findings: AnatomyFinding[] }) {
  const model = useAnatomyManifest();
  const health = useAnatomyAIStatus();
  const analysis = useMedicalAnalysis(workspace.case.id);
  const updateInjury = useUpdateInjury(workspace.case.id);
  const updateFinding = useReviewAnatomyFinding(workspace.case.id);
  const { open: openEvidence } = useEvidenceInspector();
  const [selected, setSelected] = useState<string | null>(null);
  const [activeFinding, setActiveFinding] = useState<string | null>(null);
  const [report, setReport] = useState('all');
  const [reportKind, setReportKind] = useState<'medical' | 'postmortem'>('medical');
  const [filter, setFilter] = useState('all');
  const [system, setSystem] = useState('all');
  const [search, setSearch] = useState('');
  const [navigator, setNavigator] = useState(true);
  const [inspector, setInspector] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const all = findingsForPerson(injuries, findings, personId);
  const sources = (f: Finding) => workspace.links.filter(l => l.target_type === f.kind && l.target_id === f.record.id);
  const reported = all.filter(f => report === 'all' || sources(f).some(l => l.evidence_id === Number(report)));
  const visible = reported.filter(f => filter === 'all' ? f.record.review_status !== 'rejected' : f.record.review_status === filter);
  const structures = model.data?.structures ?? [];
  const markers = visible.map(f => mapFinding(f, structures));
  const selectedRecord = visible.find(f => findingKey(f) === activeFinding);
  const selectedStructure = structures.find(s => s.id === selected);
  const unresolved = markers.filter(m => !m.structureId);
  const cards = selectedRecord ? [selectedRecord] : selected ? markers.filter(m => m.structureId === selected).map(m => m.finding) : visible;
  const states = Object.fromEntries(structures.map(s => [s.id, findingState(reported.filter(f => mapFinding(f, structures).structureId === s.id), workspace.links)]));
  const reports = workspace.evidence.filter(e => e.type === 'medical' || e.type === 'document');
  const selectedReport = reports.find(e => e.id === Number(report));
  const error = placementError ?? (updateInjury.error as Error | null)?.message ?? (updateFinding.error as Error | null)?.message;
  const busy = updateInjury.isPending || updateFinding.isPending;
  const chooseStructure = (id: string | null) => { setSelected(id); setActiveFinding(null); setPlacing(false); };
  const chooseFinding = (key: string) => {
    const marker = markers.find(m => findingKey(m.finding) === key);
    setActiveFinding(key); setSelected(marker?.structureId ?? null); setInspector(true); setPlacing(false);
  };
  const resetSelection = () => { setSelected(null); setActiveFinding(null); setPlacing(false); analysis.reset(); };
  const review = (f: Finding, status: ReviewStatus) => {
    const payload = { id: f.record.id, input: { review_status: status } };
    if (f.kind === 'injury') updateInjury.mutate(payload); else updateFinding.mutate(payload);
  };
  const place = (structureId: string, local: Vec3) => {
    if (!selectedRecord || selectedRecord.kind !== 'injury') return;
    const expected = mapFinding(selectedRecord, structures).structureId;
    if (structureId !== expected) { setPlacementError('Place the marker on the documented structure. Regional findings cannot be reassigned to a different organ.'); return; }
    updateInjury.mutate({ id: selectedRecord.record.id, input: { structure_id: structureId, medical_details: {
      ...selectedRecord.record.medical_details, marker: { structure_id: structureId, local_position: local,
        location_precision: 'regional', placement_origin: 'investigator', model_id: 'bodyparts3d-3.0-forensix-v1' }
    } } }, { onSuccess: () => { setPlacing(false); setPlacementError(null); } });
  };
  return <div className="space-y-3">
    <div className="grid gap-3 rounded border border-line bg-surface p-3 lg:grid-cols-[1fr_170px_auto]">
      <div><label htmlFor="anatomy-report" className={labelClass}>Source report</label>
        <select id="anatomy-report" className={selectClass} value={report} onChange={e => { setReport(e.target.value); resetSelection(); }}>
          <option value="all">All sources for this person</option>
          {reports.map(e => <option key={e.id} value={e.id}>{e.title}{all.some(f => sources(f).some(l => l.evidence_id === e.id)) ? ' · linked' : ' · association unverified'}</option>)}
        </select>
        <p className="mt-1 text-xs text-ink-muted">Only linked findings are shown for a selected report. Unverified reports require an explicit identity check during analysis.</p>
      </div>
      <div><label htmlFor="anatomy-report-kind" className={labelClass}>Report classification</label>
        <select id="anatomy-report-kind" className={selectClass} value={reportKind} onChange={e => setReportKind(e.target.value as typeof reportKind)}>
          <option value="medical">Medical examination</option><option value="postmortem">Postmortem examination</option>
        </select></div>
      <div className="flex flex-col justify-start gap-2 pt-5">
        <button className={primaryButtonClass} disabled={!personId || !selectedReport || selectedReport.processing_status !== 'done' || !health.data?.ai_enabled || analysis.isPending}
          onClick={() => analysis.mutate({ evidence_id: selectedReport!.id, person_id: personId!, report_kind: reportKind })}>
          {analysis.isPending ? 'Analysing report…' : 'Analyse / reanalyse report'}</button>
        {selectedReport && <button className={smallButtonClass} onClick={() => openEvidence(selectedReport.id)}>Open source evidence</button>}
      </div>
      <div className="text-xs text-ink-muted lg:col-span-3">
        {health.data?.ai_enabled ? 'Analysis creates cited, pending-review proposals. Reanalysis retains reviewed findings and reuses identical citations.' : 'Live medical extraction is unavailable without configured Gemini. Stored findings and reference anatomy remain available.'}
        {' '}<Link className="text-accent-text underline" to={casePath(workspace.case.id, 'evidence')}>Add or process reports in Evidence.</Link>
      </div>
      {analysis.isError && <div role="alert" className="text-warn lg:col-span-3">{(analysis.error as Error).message}</div>}
      {analysis.data && <div role="status" className="text-body text-ink-soft lg:col-span-3">{analysis.data.created} new proposals; {analysis.data.retained} existing records retained.
        {analysis.data.limitations.map((text, i) => <p key={i} className="text-warn">{text}</p>)}</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2"><button className={smallButtonClass} aria-expanded={navigator} onClick={() => setNavigator(!navigator)}>{navigator ? 'Hide' : 'Show'} anatomy navigator</button>
        <button className={smallButtonClass} aria-expanded={inspector} onClick={() => setInspector(!inspector)}>{inspector ? 'Hide' : 'Show'} findings panel</button></div>
      <label className="flex items-center gap-2 text-xs text-ink-muted">Findings
        <select aria-label="Findings review filter" className={selectClass} value={filter} onChange={e => { setFilter(e.target.value); resetSelection(); }}>
          <option value="all">Confirmed & pending</option><option value="confirmed">Confirmed</option><option value="pending">Pending review</option><option value="rejected">Rejected (records only)</option>
        </select></label>
    </div>
    {error && <p role="alert" className="text-warn">{error}</p>}
    <div className="flex flex-col gap-3 xl:flex-row">
      {navigator && <aside className="w-full shrink-0 rounded border border-line bg-surface p-3 xl:w-44" aria-label="Anatomy navigator">
        <label htmlFor="anatomy-search" className={labelClass}>Find a structure</label>
        <input id="anatomy-search" className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name…" />
        <label htmlFor="anatomy-system" className={`${labelClass} mt-3`}>System</label>
        <select id="anatomy-system" className={selectClass} value={system} onChange={e => { setSystem(e.target.value); chooseStructure(null); }}>
          <option value="all">All systems</option>{[...new Set(structures.map(s => s.system))].map(s => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <div className="mt-3 max-h-[500px] overflow-y-auto">
          {structures.filter(s => (system === 'all' || s.system === system) && s.label.toLowerCase().includes(search.toLowerCase())).map(s => <button
            key={s.id} aria-pressed={selected === s.id} data-testid={`organ-${s.id}`} onClick={() => chooseStructure(s.id)}
            className={`mb-1 block w-full rounded border-l-2 px-2 py-2 text-left text-body ${selected === s.id ? 'border-accent bg-raised text-ink' : 'border-transparent text-ink-soft hover:bg-raised'}`}>
            <span className="block">{s.label}</span><span className="block text-2xs text-ink-muted">{humanize(states[s.id])}</span>
          </button>)}
        </div>
      </aside>}
      <div className="min-w-0 flex-1">
        {model.isPending ? <LoadingState label="Loading anatomy manifest…" /> : model.isError ? <ErrorState error={model.error} onRetry={() => model.refetch()} /> :
          <AnatomicalViewer manifest={model.data} selected={selected} onSelect={chooseStructure} selectedFinding={activeFinding}
            onFinding={chooseFinding} markers={markers} states={states} system={system} placing={placing} onPlace={place} />}
      </div>
      {inspector && <aside className="w-full shrink-0 space-y-3 rounded border border-line bg-surface p-4 xl:w-72" aria-label="Medical findings inspector">
        <div className="border-b border-line pb-3"><p className="font-mono text-xs uppercase text-ink-muted">Findings inspector</p>
          <h3 className="mt-1 text-lg font-medium text-ink">{selectedStructure?.label ?? (personId ? 'Person’s medical findings' : 'Unassigned findings')}</h3>
          {selectedStructure && <p className="text-xs text-ink-muted">{humanize(selectedStructure.system)} · {humanize(states[selectedStructure.id])}</p>}
          {activeFinding && <button className={`${smallButtonClass} mt-2`} onClick={() => setActiveFinding(null)}>All findings on this structure</button>}
        </div>
        {!cards.length && <p className="text-body text-ink-muted">Not documented in the selected records. Absence of a finding does not establish a normal or healthy organ.</p>}
        <div className="max-h-[650px] space-y-4 overflow-y-auto">
          {cards.map(f => <div key={findingKey(f)} className={`space-y-2 border-b border-line pb-4 ${f.record.review_status === 'rejected' ? 'opacity-65' : ''}`} data-testid={`finding-${findingKey(f)}`}>
            <button className="w-full text-left font-medium text-ink hover:text-accent-text" onClick={() => chooseFinding(findingKey(f))}>
              {f.kind === 'injury' ? f.record.type : humanize(f.record.finding_type)} <span className="font-mono text-xs text-ink-muted">#{f.record.id}</span></button>
            <p className="text-xs text-ink-muted">{humanize(f.record.body_region)}{f.kind === 'injury' ? ` · ${f.record.severity === 'unknown' ? 'Severity not documented' : humanize(f.record.severity)}` : ''}</p>
            <p className="text-body text-ink-soft">{f.record.description}</p>
            {(f.kind === 'anatomy_finding' ? f.record.reported_condition : f.record.medical_details?.reported_condition) && <p className="text-body">Reported condition: {f.kind === 'anatomy_finding' ? f.record.reported_condition : f.record.medical_details?.reported_condition}</p>}
            {f.record.medical_details?.anatomical_location && <p className="text-body text-ink-soft">Reported location: {f.record.medical_details.anatomical_location}</p>}
            {f.kind === 'injury' && f.record.depth && <p className="text-body">Recorded depth: {f.record.depth}</p>}
            {f.record.medical_details?.measurements?.map((m, i) => <p className="text-body text-ink-soft" key={i}>{m.label}: <span className="font-mono">{m.value}</span></p>)}
            {f.record.medical_details?.uncertainty && <p className="text-xs text-warn">{f.record.medical_details.uncertainty}</p>}
            <p className="text-xs text-ink-muted">{f.record.origin === 'ai' ? 'AI proposal' : 'Investigator record'} · {humanize(f.record.review_status)}
              {f.record.medical_details?.mapping_origin === 'ai' ? ' · Anatomical mapping proposed by AI' : ''}</p>
            <ReviewActions origin={f.record.origin} status={f.record.review_status} onChange={status => review(f, status)} busy={busy} />
            <SourcePassages links={workspace.links} evidence={workspace.evidence} targetType={f.kind} targetId={f.record.id} onOpenEvidence={openEvidence} />
            {!sources(f).length && <p className="text-xs text-warn">No supporting evidence link is recorded.</p>}
            <p className="text-xs text-ink-muted">Placement: {humanize(mapFinding(f, structures).locationPrecision)} · {humanize(mapFinding(f, structures).placementOrigin)}.</p>
            {f.kind === 'injury' && activeFinding === findingKey(f) && mapFinding(f, structures).structureId && f.record.review_status !== 'rejected' &&
              <button className={smallButtonClass} disabled={busy} onClick={() => { setPlacing(!placing); setPlacementError(null); }}>{placing ? 'Cancel placement' : 'Adjust illustrative marker'}</button>}
          </div>)}
        </div>
        {unresolved.length > 0 && <div className="border-t border-line pt-3"><h4 className="text-xs font-medium text-warn">Regional / unresolved findings ({unresolved.length})</h4>
          <p className="my-2 text-xs text-ink-muted">No supported structure mapping. These findings remain recorded; no precise marker is invented.</p>
          {unresolved.map(m => <button key={findingKey(m.finding)} className="block py-1 text-left text-xs text-accent-text hover:underline" onClick={() => chooseFinding(findingKey(m.finding))}>{m.finding.record.body_region} · #{m.finding.record.id}</button>)}
        </div>}
        <p className="border-t border-line pt-3 text-xs text-ink-muted">Reference model: one adult male, selected structures only. It does not represent this person’s body, measured geometry, cause of death or a diagnosis.</p>
      </aside>}
    </div>
  </div>;
}
