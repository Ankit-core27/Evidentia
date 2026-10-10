import React, { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { DeleteButton } from '@/components/shared/DeleteButton';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { PageHeader, SectionHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/QueryState';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { iconButtonClass, smallButtonClass } from '@/components/shared/formStyles';
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

const listClass = 'rounded-md border border-line divide-y divide-line';
const rowClass = 'px-3 py-2.5 space-y-2';

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
      <PageHeader
        title="People, vehicles and locations"
        description="Everyone and everything involved. Items the AI proposed from evidence stay pending until you confirm them."
        actions={
          rejectedCount > 0 && (
            <label className="text-xs text-ink-muted flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
              Show {rejectedCount} rejected
            </label>
          )
        }
      />

      {mutationError && <ErrorState error={mutationError} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-8 items-start">
        {/* Persons */}
        <section className="space-y-2" aria-label="People">
          <SectionHeader
            title="People"
            count={persons.length}
            action={
              <button onClick={() => setEditing({ kind: 'person', record: null })} className={smallButtonClass}>
                <Plus className="size-3" aria-hidden /> Add person
              </button>
            }
          />
          {persons.length === 0 && <p className="text-body text-ink-muted">No people recorded.</p>}
          <div className={persons.length ? listClass : ''}>
            {persons.map((p) => (
              <div key={p.id} className={`${rowClass} ${p.review_status === 'rejected' ? 'opacity-50' : ''}`} data-testid={`person-${p.id}`}>
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={p.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-soft">{humanize(p.role)}</span>
                      {p.condition && <span className="text-xs text-ink-muted">· {humanize(p.condition)}</span>}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {[p.age !== null && `Age ${p.age}`, p.occupation, p.contact].filter(Boolean).join(' · ')}
                    </div>
                    {p.notes && <p className="text-body text-ink-soft mt-1">{p.notes}</p>}
                  </div>
                  <div className="flex items-center shrink-0 -mt-1 -mr-1.5">
                    <button
                      onClick={() => setEditing({ kind: 'person', record: p })}
                      className={iconButtonClass}
                      aria-label={`Edit ${p.name}`}
                    >
                      <Pencil className="size-3.5" />
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
          </div>
        </section>

        <div className="space-y-6">
          {/* Vehicles and objects */}
          <section className="space-y-2" aria-label="Vehicles and objects">
            <SectionHeader
              title="Vehicles and objects"
              count={objects.length}
              action={
                <button onClick={() => setEditing({ kind: 'object', record: null })} className={smallButtonClass}>
                  <Plus className="size-3" aria-hidden /> Add vehicle or object
                </button>
              }
            />
            {objects.length === 0 && <p className="text-body text-ink-muted">No vehicles or objects recorded.</p>}
            <div className={objects.length ? listClass : ''}>
              {objects.map((o) => (
                <div key={o.id} className={`${rowClass} ${o.review_status === 'rejected' ? 'opacity-50' : ''}`} data-testid={`object-${o.id}`}>
                  <div className="flex items-start justify-between gap-3">
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
                    <div className="flex items-center shrink-0 -mt-1 -mr-1.5">
                      <button
                        onClick={() => setEditing({ kind: 'object', record: o })}
                        className={iconButtonClass}
                        aria-label={`Edit ${o.label}`}
                      >
                        <Pencil className="size-3.5" />
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
            </div>
          </section>

          {/* Locations */}
          <section className="space-y-2" aria-label="Locations">
            <SectionHeader
              title="Locations"
              count={locations.length}
              action={
                <button onClick={() => setEditing({ kind: 'location', record: null })} className={smallButtonClass}>
                  <Plus className="size-3" aria-hidden /> Add location
                </button>
              }
            />
            {locations.length === 0 && <p className="text-body text-ink-muted">No locations recorded.</p>}
            <div className={locations.length ? listClass : ''}>
              {locations.map((l) => (
                <div key={l.id} className={`${rowClass} ${l.review_status === 'rejected' ? 'opacity-50' : ''}`} data-testid={`location-${l.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-body font-medium text-ink">{l.address}</div>
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
                    <div className="flex items-center shrink-0 -mt-1 -mr-1.5">
                      <button
                        onClick={() => setEditing({ kind: 'location', record: l })}
                        className={iconButtonClass}
                        aria-label={`Edit ${l.address}`}
                      >
                        <Pencil className="size-3.5" />
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
            </div>
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
