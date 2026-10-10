import React from 'react';
import { Link } from 'react-router-dom';
import { EVIDENCE_ICONS } from '@/components/evidence/evidenceIcons';
import { ProcessingBadge, ReviewBadge } from '@/components/shared/Badges';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { SectionHeader } from '@/components/shared/PageHeader';
import { linkClass } from '@/components/shared/formStyles';
import { EvidenceCanvas } from '@/features/evidence-canvas/EvidenceCanvas';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { CaseModule, casePath } from '@/lib/caseModules';
import { formatBytes, humanize } from '@/lib/format';
import { CaseWorkspace } from '@/types/api';

const list = 'rounded-md border border-line divide-y divide-line';
const row = 'px-3 py-2.5';

/** Overview of a case: everything recorded so far, straight from the workspace call. */
export const CaseSummary: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const { case: c, evidence } = workspace;
  const { open: openEvidence } = useEvidenceInspector();
  // Rejected AI proposals are not part of the case.
  const kept = <T extends { review_status: string }>(rows: T[]) => rows.filter((r) => r.review_status !== 'rejected');
  const persons = kept(workspace.persons);
  const objects = kept(workspace.objects);
  const locations = kept(workspace.locations);
  const vehicles = objects.filter((o) => o.kind === 'vehicle');
  const otherObjects = objects.filter((o) => o.kind !== 'vehicle');
  const processing = evidence.filter((e) => e.processing_status === 'queued' || e.processing_status === 'processing').length;

  const moduleLink = (module: CaseModule, label: string) => (
    <Link to={casePath(c.id, module)} className={`text-xs ${linkClass}`}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-8">
      <section aria-label="Summary" className="space-y-1.5">
        <SectionHeader title="Summary" as="h2" />
        <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap max-w-3xl">
          {c.description || <span className="text-ink-muted">No summary entered. Add one with Edit case.</span>}
        </p>
      </section>

      {workspace.relationships.length > 0 && (
        <section className="space-y-2" aria-label="Relationships">
          <SectionHeader title="Relationships" count={kept(workspace.relationships).length} as="h2" action={moduleLink('canvas', 'Open canvas')} />
          <EvidenceCanvas workspace={workspace} readOnly heightClass="h-[300px]" />
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-8 items-start">
        <div className="space-y-8">
          <section className="space-y-2" aria-label="People">
            <SectionHeader title="People" count={persons.length} as="h2" action={moduleLink('people', 'Manage')} />
            {persons.length === 0 ? (
              <p className="text-body text-ink-muted">No people recorded.</p>
            ) : (
              <ul className={list}>
                {persons.map((p) => (
                  <li key={p.id} className={`${row} flex gap-3`}>
                    <InitialsAvatar name={p.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                        <span className="text-body font-medium text-ink">{p.name}</span>
                        <span className="text-xs text-ink-soft">{humanize(p.role)}</span>
                        {p.condition && <span className="text-xs text-ink-muted">· {humanize(p.condition)}</span>}
                        <ReviewBadge status={p.review_status} origin={p.origin} />
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {[p.age !== null && `Age ${p.age}`, p.occupation, p.contact].filter(Boolean).join(' · ')}
                      </div>
                      {p.notes && <p className="text-body text-ink-soft mt-1">{p.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2" aria-label="Vehicles and objects">
            <SectionHeader title="Vehicles and objects" count={objects.length} as="h2" action={moduleLink('people', 'Manage')} />
            {objects.length === 0 ? (
              <p className="text-body text-ink-muted">No vehicles or objects recorded.</p>
            ) : (
              <ul className={list}>
                {[...vehicles, ...otherObjects].map((o) => (
                  <li key={o.id} className={`${row} flex items-start justify-between gap-3`}>
                    <div className="min-w-0">
                      <div className="text-body font-medium text-ink">{o.label}</div>
                      <div className="text-xs text-ink-muted">
                        {humanize(o.kind)}
                        {o.details.plate && (
                          <>
                            {' · '}
                            <span className="font-mono">{o.details.plate}</span>
                          </>
                        )}
                        {[o.details.make, o.details.colour].filter(Boolean).map((v) => ` · ${v}`)}
                        {o.details.number && (
                          <>
                            {' · '}
                            <span className="font-mono">{o.details.number}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ReviewBadge status={o.review_status} origin={o.origin} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2" aria-label="Locations">
            <SectionHeader title="Locations" count={locations.length} as="h2" action={moduleLink('people', 'Manage')} />
            {locations.length === 0 ? (
              <p className="text-body text-ink-muted">No locations recorded.</p>
            ) : (
              <ul className={list}>
                {locations.map((l) => (
                  <li key={l.id} className={`${row} flex items-start justify-between gap-3`}>
                    <div className="min-w-0">
                      <div className="text-body text-ink">{l.address}</div>
                      <div className="text-xs text-ink-muted">
                        {humanize(l.kind)}
                        {l.lat !== null && l.lng !== null && (
                          <span className="font-mono">
                            {' · '}
                            {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ReviewBadge status={l.review_status} origin={l.origin} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="space-y-2" aria-label="Evidence">
          <SectionHeader
            title="Evidence"
            count={evidence.length}
            as="h2"
            action={
              <span className="flex items-center gap-3">
                {processing > 0 && <span className="text-xs text-accent-text">{processing} processing</span>}
                {moduleLink('evidence', 'Open evidence')}
              </span>
            }
          />
          {evidence.length === 0 ? (
            <p className="text-body text-ink-muted">No evidence uploaded.</p>
          ) : (
            <ul className={list}>
              {evidence.map((e) => {
                const Icon = EVIDENCE_ICONS[e.type].icon;
                return (
                  <li key={e.id}>
                    <button onClick={() => openEvidence(e.id)} className={`${row} group w-full text-left flex gap-3 hover:bg-surface transition-colors`}>
                      <Icon className="size-4 text-ink-muted shrink-0 mt-0.5" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-body font-medium text-ink group-hover:text-accent-text truncate">{e.title}</span>
                          <ProcessingBadge status={e.processing_status} />
                        </div>
                        <div className="text-xs text-ink-muted">
                          {humanize(e.type)} · <span className="font-mono">{formatBytes(e.size_bytes)}</span>
                        </div>
                        {e.summary && <p className="text-xs text-ink-soft mt-1 line-clamp-2">{e.summary}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
