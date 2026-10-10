import React, { useState } from 'react';
import { Car, MapPin, Pencil, Plus, Users } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { DeleteButton } from '@/components/shared/DeleteButton';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { ErrorState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { smallButtonClass } from '@/components/shared/formStyles';
import {
  useCreateLocation,
  useCreateObject,
  useCreatePerson,
  useDeleteLocation,
  useDeleteObject,
  useDeletePerson,
  useUpdateLocation,
  useUpdateObject,
  useUpdatePerson
} from '@/hooks/usePeople';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { humanize } from '@/lib/format';
import { CaseObject, CaseWorkspace, Id, Location, Person, ReviewStatus } from '@/types/api';
import { LocationDialog, ObjectDialog, PersonDialog } from './RecordForms';

type Editing =
  | { kind: 'person'; record: Person | null }
  | { kind: 'object'; record: CaseObject | null }
  | { kind: 'location'; record: Location | null };

const ROLE_ORDER = ['victim', 'suspect', 'witness', 'other'];

const sectionClass = 'p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3';
const rowClass = 'p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2';

/** Persons, vehicles and other objects, and locations: add, edit, delete, and review AI proposals. */
export const PeopleModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const { open: onOpenEvidence } = useEvidenceInspector();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const createPerson = useCreatePerson(caseId);
  const updatePerson = useUpdatePerson(caseId);
  const deletePerson = useDeletePerson(caseId);
  const createObject = useCreateObject(caseId);
  const updateObject = useUpdateObject(caseId);
  const deleteObject = useDeleteObject(caseId);
  const createLocation = useCreateLocation(caseId);
  const updateLocation = useUpdateLocation(caseId);
  const deleteLocation = useDeleteLocation(caseId);

  const mutationError = [updatePerson, deletePerson, updateObject, deleteObject, updateLocation, deleteLocation].find(
    (m) => m.isError
  )?.error;

  const visible = <T extends { review_status: ReviewStatus }>(rows: T[]) =>
    showRejected ? rows : rows.filter((r) => r.review_status !== 'rejected');
  const rejectedCount = [...workspace.persons, ...workspace.objects, ...workspace.locations].filter(
    (r) => r.review_status === 'rejected'
  ).length;

  const persons = visible(workspace.persons).sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name)
  );
  const objects = visible(workspace.objects).sort((a, b) => (a.kind === 'vehicle' ? -1 : 0) - (b.kind === 'vehicle' ? -1 : 0));
  const locations = visible(workspace.locations);

  const sources = (type: 'person' | 'object' | 'location', id: Id) => (
    <SourcePassages
      links={workspace.links}
      evidence={workspace.evidence}
      targetType={type}
      targetId={id}
      onOpenEvidence={onOpenEvidence}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            People, Vehicles & Locations
          </h2>
          <p className="text-xs text-slate-400">
            Everyone and everything involved. Items the AI proposed from evidence stay pending until you confirm them.
          </p>
        </div>
        {rejectedCount > 0 && (
          <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showRejected}
              onChange={(e) => setShowRejected(e.target.checked)}
              className="accent-cyan-500"
            />
            Show {rejectedCount} rejected
          </label>
        )}
      </div>

      {mutationError && <ErrorState error={mutationError} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Persons */}
        <section className={sectionClass} aria-label="People">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" /> People ({persons.length})
            </h3>
            <button onClick={() => setEditing({ kind: 'person', record: null })} className={smallButtonClass}>
              <Plus className="w-3 h-3" /> Add person
            </button>
          </div>
          {persons.length === 0 && <p className="text-xs text-slate-500">No people recorded.</p>}
          {persons.map((p) => (
            <div key={p.id} className={`${rowClass} ${p.review_status === 'rejected' ? 'opacity-50' : ''}`} data-testid={`person-${p.id}`}>
              <div className="flex items-start gap-3">
                <InitialsAvatar name={p.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-100 font-bold">{p.name}</span>
                    <span className="text-[10px] text-cyan-300">{humanize(p.role)}</span>
                    {p.condition && <span className="text-[10px] text-slate-400">{humanize(p.condition)}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {[p.age !== null && `Age ${p.age}`, p.occupation, p.contact].filter(Boolean).join(' • ')}
                  </div>
                  {p.notes && <p className="text-[11px] text-slate-300 mt-1">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditing({ kind: 'person', record: p })}
                    className="p-1 rounded text-slate-500 hover:text-cyan-300"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <DeleteButton
                    label={p.name}
                    busy={deletePerson.isPending && deletePerson.variables === p.id}
                    onDelete={() => deletePerson.mutate(p.id)}
                  />
                </div>
              </div>
              <ReviewActions
                origin={p.origin}
                status={p.review_status}
                busy={updatePerson.isPending && updatePerson.variables?.id === p.id}
                onChange={(review_status) => updatePerson.mutate({ id: p.id, input: { review_status } })}
              />
              {sources('person', p.id)}
            </div>
          ))}
        </section>

        <div className="space-y-6">
          {/* Vehicles and objects */}
          <section className={sectionClass} aria-label="Vehicles and objects">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" /> Vehicles & objects ({objects.length})
              </h3>
              <button onClick={() => setEditing({ kind: 'object', record: null })} className={smallButtonClass}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {objects.length === 0 && <p className="text-xs text-slate-500">No vehicles or objects recorded.</p>}
            {objects.map((o) => (
              <div key={o.id} className={`${rowClass} ${o.review_status === 'rejected' ? 'opacity-50' : ''}`} data-testid={`object-${o.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-slate-100 font-bold">{o.label}</div>
                    <div className="text-[11px] text-slate-400">
                      {[humanize(o.kind), o.details.plate, o.details.make, o.details.colour, o.details.number]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing({ kind: 'object', record: o })}
                      className="p-1 rounded text-slate-500 hover:text-cyan-300"
                      aria-label={`Edit ${o.label}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <DeleteButton
                      label={o.label}
                      busy={deleteObject.isPending && deleteObject.variables === o.id}
                      onDelete={() => deleteObject.mutate(o.id)}
                    />
                  </div>
                </div>
                <ReviewActions
                  origin={o.origin}
                  status={o.review_status}
                  busy={updateObject.isPending && updateObject.variables?.id === o.id}
                  onChange={(review_status) => updateObject.mutate({ id: o.id, input: { review_status } })}
                />
                {sources('object', o.id)}
              </div>
            ))}
          </section>

          {/* Locations */}
          <section className={sectionClass} aria-label="Locations">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" /> Locations ({locations.length})
              </h3>
              <button onClick={() => setEditing({ kind: 'location', record: null })} className={smallButtonClass}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {locations.length === 0 && <p className="text-xs text-slate-500">No locations recorded.</p>}
            {locations.map((l) => (
              <div key={l.id} className={`${rowClass} ${l.review_status === 'rejected' ? 'opacity-50' : ''}`} data-testid={`location-${l.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-slate-100 font-bold">{l.address}</div>
                    <div className="text-[11px] text-slate-400">
                      {humanize(l.kind)}
                      {l.lat !== null && l.lng !== null ? ` • ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing({ kind: 'location', record: l })}
                      className="p-1 rounded text-slate-500 hover:text-cyan-300"
                      aria-label={`Edit ${l.address}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <DeleteButton
                      label={l.address}
                      busy={deleteLocation.isPending && deleteLocation.variables === l.id}
                      onDelete={() => deleteLocation.mutate(l.id)}
                    />
                  </div>
                </div>
                <ReviewActions
                  origin={l.origin}
                  status={l.review_status}
                  busy={updateLocation.isPending && updateLocation.variables?.id === l.id}
                  onChange={(review_status) => updateLocation.mutate({ id: l.id, input: { review_status } })}
                />
                {sources('location', l.id)}
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* Keyed by record so each dialog starts from that record's values. */}
      {editing?.kind === 'person' && (
        <PersonDialog
          key={editing.record?.id ?? 'new'}
          open
          record={editing.record}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing.record
              ? updatePerson.mutateAsync({ id: editing.record.id, input })
              : createPerson.mutateAsync(input)
          }
        />
      )}
      {editing?.kind === 'object' && (
        <ObjectDialog
          key={editing.record?.id ?? 'new'}
          open
          record={editing.record}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing.record
              ? updateObject.mutateAsync({ id: editing.record.id, input })
              : createObject.mutateAsync(input)
          }
        />
      )}
      {editing?.kind === 'location' && (
        <LocationDialog
          key={editing.record?.id ?? 'new'}
          open
          record={editing.record}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing.record
              ? updateLocation.mutateAsync({ id: editing.record.id, input })
              : createLocation.mutateAsync(input)
          }
        />
      )}
    </div>
  );
};
