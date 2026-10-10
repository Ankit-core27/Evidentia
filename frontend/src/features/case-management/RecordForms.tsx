// Add and edit dialogs for persons, vehicles and other objects, and locations.
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { humanize } from '@/lib/format';
import { LOCATION_KINDS, OBJECT_KINDS, PERSON_CONDITIONS, PERSON_ROLES } from '@/lib/options';
import {
  CaseObject,
  CaseObjectCreate,
  Location,
  LocationCreate,
  LocationKind,
  ObjectKind,
  Person,
  PersonCondition,
  PersonCreate,
  PersonRole
} from '@/types/api';

interface FormDialogProps<TRecord, TInput> {
  open: boolean;
  /** The record being edited, or null to add a new one. */
  record: TRecord | null;
  onClose: () => void;
  onSave: (input: TInput) => Promise<unknown>;
}

const SaveFooter: React.FC<{ saving: boolean; onCancel: () => void; formId: string }> = ({ saving, onCancel, formId }) => (
  <>
    <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClass}>
      Cancel
    </button>
    <button type="submit" form={formId} disabled={saving} className={primaryButtonClass}>
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
    </button>
  </>
);

/** Runs a save, keeping the dialog open with the error if it fails. */
const useSave = (onSave: () => Promise<unknown>, onDone: () => void) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, save };
};

const ErrorLine: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <p className="text-[11px] text-red-300" role="alert">
      {error}
    </p>
  ) : null;

// ---------------------------------------------------------------------------

export const PersonDialog: React.FC<FormDialogProps<Person, PersonCreate>> = ({ open, record, onClose, onSave }) => {
  const [name, setName] = useState(record?.name ?? '');
  const [role, setRole] = useState<PersonRole>(record?.role ?? 'witness');
  const [age, setAge] = useState(record?.age?.toString() ?? '');
  const [condition, setCondition] = useState<PersonCondition | ''>(record?.condition ?? '');
  const [occupation, setOccupation] = useState(record?.occupation ?? '');
  const [contact, setContact] = useState(record?.contact ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const { saving, error, save } = useSave(
    () =>
      onSave({
        name: name.trim(),
        role,
        age: age ? Number(age) : null,
        condition: condition || null,
        occupation: occupation.trim(),
        contact: contact.trim(),
        notes: notes.trim()
      }),
    onClose
  );

  return (
    <Dialog
      open={open}
      title={record ? `Edit ${record.name}` : 'Add person'}
      onClose={onClose}
      busy={saving}
      footer={<SaveFooter saving={saving} onCancel={onClose} formId="person-form" />}
    >
      <form
        id="person-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void save();
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="person-name" className={labelClass}>
              Name *
            </label>
            <input id="person-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
          </div>
          <div>
            <label htmlFor="person-role" className={labelClass}>
              Role
            </label>
            <select id="person-role" value={role} onChange={(e) => setRole(e.target.value as PersonRole)} className={inputClass}>
              {PERSON_ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="person-age" className={labelClass}>
              Age
            </label>
            <input
              id="person-age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="person-condition" className={labelClass}>
              Condition
            </label>
            <select
              id="person-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as PersonCondition | '')}
              className={inputClass}
            >
              <option value="">Unknown</option>
              {PERSON_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="person-occupation" className={labelClass}>
              Occupation
            </label>
            <input id="person-occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="person-contact" className={labelClass}>
              Contact
            </label>
            <input id="person-contact" value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="person-notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="person-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>
        <ErrorLine error={error} />
      </form>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------

export const ObjectDialog: React.FC<FormDialogProps<CaseObject, CaseObjectCreate>> = ({ open, record, onClose, onSave }) => {
  const [kind, setKind] = useState<ObjectKind>(record?.kind ?? 'vehicle');
  const [label, setLabel] = useState(record?.label ?? '');
  const [plate, setPlate] = useState(record?.details.plate ?? '');
  const [make, setMake] = useState(record?.details.make ?? '');
  const [colour, setColour] = useState(record?.details.colour ?? '');
  const [number, setNumber] = useState(record?.details.number ?? '');
  const { saving, error, save } = useSave(() => {
    // Keep any other details the AI or backend stored, and drop emptied fields.
    const details: Record<string, unknown> = { ...(record?.details ?? {}), plate, make, colour, number };
    for (const key of ['plate', 'make', 'colour', 'number']) {
      const value = String(details[key] ?? '').trim();
      if (value) details[key] = value;
      else delete details[key];
    }
    return onSave({ kind, label: label.trim(), details });
  }, onClose);

  return (
    <Dialog
      open={open}
      title={record ? `Edit ${record.label}` : 'Add vehicle or object'}
      onClose={onClose}
      busy={saving}
      footer={<SaveFooter saving={saving} onCancel={onClose} formId="object-form" />}
    >
      <form
        id="object-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) void save();
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="object-kind" className={labelClass}>
              Kind
            </label>
            <select id="object-kind" value={kind} onChange={(e) => setKind(e.target.value as ObjectKind)} className={inputClass}>
              {OBJECT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {humanize(k)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="object-label" className={labelClass}>
              Description *
            </label>
            <input
              id="object-label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === 'vehicle' ? 'e.g. White hatchback' : ''}
              className={inputClass}
              autoFocus
            />
          </div>
          {kind === 'vehicle' && (
            <>
              <div>
                <label htmlFor="object-plate" className={labelClass}>
                  Plate
                </label>
                <input id="object-plate" value={plate} onChange={(e) => setPlate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="object-make" className={labelClass}>
                  Make and model
                </label>
                <input id="object-make" value={make} onChange={(e) => setMake(e.target.value)} className={inputClass} />
              </div>
            </>
          )}
          {kind === 'phone' && (
            <div className="col-span-2">
              <label htmlFor="object-number" className={labelClass}>
                Number
              </label>
              <input id="object-number" value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <label htmlFor="object-colour" className={labelClass}>
              Colour
            </label>
            <input id="object-colour" value={colour} onChange={(e) => setColour(e.target.value)} className={inputClass} />
          </div>
        </div>
        <ErrorLine error={error} />
      </form>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------

const coordinate = (value: string, min: number, max: number) => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

export const LocationDialog: React.FC<FormDialogProps<Location, LocationCreate>> = ({ open, record, onClose, onSave }) => {
  const [kind, setKind] = useState<LocationKind>(record?.kind ?? 'incident_site');
  const [address, setAddress] = useState(record?.address ?? '');
  const [lat, setLat] = useState(record?.lat?.toString() ?? '');
  const [lng, setLng] = useState(record?.lng?.toString() ?? '');
  const [invalid, setInvalid] = useState<string | null>(null);
  const { saving, error, save } = useSave(
    () =>
      onSave({ kind, address: address.trim(), lat: coordinate(lat, -90, 90) ?? null, lng: coordinate(lng, -180, 180) ?? null }),
    onClose
  );

  return (
    <Dialog
      open={open}
      title={record ? 'Edit location' : 'Add location'}
      onClose={onClose}
      busy={saving}
      footer={<SaveFooter saving={saving} onCancel={onClose} formId="location-form" />}
    >
      <form
        id="location-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (coordinate(lat, -90, 90) === undefined) return setInvalid('Latitude must be between -90 and 90.');
          if (coordinate(lng, -180, 180) === undefined) return setInvalid('Longitude must be between -180 and 180.');
          setInvalid(null);
          if (address.trim()) void save();
        }}
      >
        <div>
          <label htmlFor="location-kind" className={labelClass}>
            Kind
          </label>
          <select id="location-kind" value={kind} onChange={(e) => setKind(e.target.value as LocationKind)} className={inputClass}>
            {LOCATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {humanize(k)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location-address" className={labelClass}>
            Address or description *
          </label>
          <input
            id="location-address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="location-lat" className={labelClass}>
              Latitude
            </label>
            <input id="location-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="location-lng" className={labelClass}>
              Longitude
            </label>
            <input id="location-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} />
          </div>
        </div>
        <ErrorLine error={invalid ?? error} />
      </form>
    </Dialog>
  );
};
