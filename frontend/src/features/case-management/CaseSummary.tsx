import React from 'react';
import { Link } from 'react-router-dom';
import { Car, Clock, Folder, MapPin, Users, Brain, AlertTriangle, ChevronRight } from 'lucide-react';
import { ProcessingBadge, ReviewBadge } from '@/components/shared/Badges';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { casePath } from '@/lib/caseModules';
import { formatBytes, humanize } from '@/lib/format';
import { CaseModule } from '@/types';
import { CaseWorkspace } from '@/types/api';

const card = 'bg-slate-900/60 border border-slate-800 p-4 rounded-2xl';
const sectionTitle = 'text-xs font-bold text-slate-200 uppercase flex items-center gap-2 pb-2 border-b border-slate-800';

/** Overview of a case: counts and everything recorded so far, straight from the workspace call. */
export const CaseSummary: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const { case: c, counts, evidence } = workspace;
  const { open: openEvidence } = useEvidenceInspector();
  // Rejected AI proposals are not part of the case.
  const kept = <T extends { review_status: string }>(rows: T[]) => rows.filter((r) => r.review_status !== 'rejected');
  const persons = kept(workspace.persons);
  const objects = kept(workspace.objects);
  const locations = kept(workspace.locations);
  const events = kept(workspace.events);
  const vehicles = objects.filter((o) => o.kind === 'vehicle');
  const otherObjects = objects.filter((o) => o.kind !== 'vehicle');
  const processing = evidence.filter((e) => e.processing_status === 'queued' || e.processing_status === 'processing').length;

  const metrics: { label: string; value: number; note: string; icon: React.ElementType; module: CaseModule }[] = [
    { label: 'Evidence', value: counts.evidence, note: processing ? `${processing} processing` : 'files', icon: Folder, module: 'evidence' },
    { label: 'People', value: persons.length, note: 'recorded', icon: Users, module: 'people' },
    { label: 'Vehicles', value: vehicles.length, note: 'recorded', icon: Car, module: 'people' },
    { label: 'Timeline events', value: events.length, note: 'recorded', icon: Clock, module: 'timeline' },
    { label: 'To review', value: counts.pending_reviews, note: 'AI proposals', icon: Brain, module: 'review' },
    { label: 'Open conflicts', value: counts.open_conflicts, note: 'between statements', icon: AlertTriangle, module: 'review' }
  ];
  const moduleLink = (module: CaseModule, label: string) => (
    <Link to={casePath(c.id, module)} className="ml-auto text-[10px] text-cyan-400 hover:underline normal-case flex items-center">
      {label} <ChevronRight className="w-3 h-3" />
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <Link key={m.label} to={casePath(c.id, m.module)} className={`${card} hover:border-slate-600 transition-colors`}>
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <span>{m.label}</span>
              <m.icon className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{m.value}</div>
            <div className="text-[11px] text-slate-500 mt-1">{m.note}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <section className={`${card} space-y-3`}>
            <h2 className={sectionTitle}>Summary</h2>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {c.description || <span className="text-slate-500">No summary entered.</span>}
            </p>
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className={sectionTitle}>
              <MapPin className="w-4 h-4 text-cyan-400" /> Locations ({locations.length}){moduleLink('people', 'Manage')}
            </h2>
            {locations.length === 0 && <p className="text-xs text-slate-500">No locations recorded.</p>}
            {locations.map((l) => (
              <div key={l.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between gap-3">
                <div>
                  <div className="text-slate-200 font-bold">{l.address}</div>
                  <div className="text-[11px] text-slate-500">
                    {humanize(l.kind)}
                    {l.lat !== null && l.lng !== null ? ` • ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : ''}
                  </div>
                </div>
                <ReviewBadge status={l.review_status} origin={l.origin} />
              </div>
            ))}
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className={sectionTitle}>
              <Car className="w-4 h-4 text-cyan-400" /> Vehicles and objects ({objects.length}){moduleLink('people', 'Manage')}
            </h2>
            {objects.length === 0 && <p className="text-xs text-slate-500">No vehicles or objects recorded.</p>}
            {[...vehicles, ...otherObjects].map((o) => (
              <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between gap-3">
                <div>
                  <div className="text-slate-200 font-bold">{o.label}</div>
                  <div className="text-[11px] text-slate-500">
                    {[humanize(o.kind), o.details.plate, o.details.make, o.details.colour, o.details.number]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
                <ReviewBadge status={o.review_status} origin={o.origin} />
              </div>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          <section className={`${card} space-y-3`}>
            <h2 className={sectionTitle}>
              <Users className="w-4 h-4 text-cyan-400" /> People ({persons.length}){moduleLink('people', 'Manage')}
            </h2>
            {persons.length === 0 && <p className="text-xs text-slate-500">No people recorded.</p>}
            {persons.map((p) => (
              <div key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex gap-3">
                <InitialsAvatar name={p.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-200 font-bold">{p.name}</span>
                    <span className="text-[10px] text-cyan-300">{humanize(p.role)}</span>
                    {p.condition && <span className="text-[10px] text-slate-400">{humanize(p.condition)}</span>}
                    <ReviewBadge status={p.review_status} origin={p.origin} />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {[p.age !== null && `Age ${p.age}`, p.occupation, p.contact].filter(Boolean).join(' • ')}
                  </div>
                  {p.notes && <p className="text-[11px] text-slate-300 mt-1">{p.notes}</p>}
                </div>
              </div>
            ))}
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className={sectionTitle}>
              <Folder className="w-4 h-4 text-cyan-400" /> Evidence ({evidence.length}){moduleLink('evidence', 'Open')}
            </h2>
            {evidence.length === 0 && <p className="text-xs text-slate-500">No evidence uploaded.</p>}
            {evidence.map((e) => (
              <button
                key={e.id}
                onClick={() => openEvidence(e.id)}
                className="w-full text-left p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-xs flex justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-slate-200 font-bold truncate">{e.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {humanize(e.type)} • {formatBytes(e.size_bytes)}
                  </div>
                  {e.summary && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{e.summary}</p>}
                </div>
                <ProcessingBadge status={e.processing_status} />
              </button>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};
