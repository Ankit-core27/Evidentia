import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, UploadCloud, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, Circle, Check } from 'lucide-react';
import { useFocusTrap } from '@/components/shared/Dialog';
import {
  iconButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass
} from '@/components/shared/formStyles';
import { useInvestigators } from '@/hooks/useCases';
import { invalidateCase } from '@/hooks/queryKeys';
import { useInvestigatorStore } from '@/stores/investigator';
import { casePath } from '@/lib/caseModules';
import { formatBytes, humanize } from '@/lib/format';
import { CASE_PRIORITIES, INCIDENT_TYPES, PERSON_CONDITIONS, PERSON_ROLES } from '@/lib/options';
import {
  createCaseWithDetails,
  CreationStep,
  NewCaseInput,
  plannedSteps,
  StepStatus
} from '@/features/case-management/createCase';
import { Case, CasePriority, Id, IncidentType, PersonCondition, PersonRole } from '@/types/api';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PersonDraft {
  name: string;
  role: PersonRole;
  age: string;
  condition: PersonCondition | '';
  contact: string;
  notes: string;
}

interface VehicleDraft {
  label: string;
  plate: string;
  make: string;
  colour: string;
}

const EMPTY_PERSON: PersonDraft = { name: '', role: 'witness', age: '', condition: '', contact: '', notes: '' };
const EMPTY_VEHICLE: VehicleDraft = { label: '', plate: '', make: '', colour: '' };

const smallInputClass = inputClass;

const STEP_TITLES = ['Case details', 'Location & evidence', 'People & vehicles'] as const;

const parseCoordinate = (value: string, min: number, max: number): number | null | 'invalid' => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : 'invalid';
};

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: investigators } = useInvestigators();
  const currentInvestigatorId = useInvestigatorStore((s) => s.investigatorId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1
  const [title, setTitle] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType>('road_accident');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [incidentAt, setIncidentAt] = useState('');
  const [leadInvestigatorId, setLeadInvestigatorId] = useState<Id | ''>('');
  const [teamIds, setTeamIds] = useState<Id[]>([]);
  const [description, setDescription] = useState('');

  // Step 2
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Step 3
  const [persons, setPersons] = useState<PersonDraft[]>([]);
  const [personDraft, setPersonDraft] = useState<PersonDraft>(EMPTY_PERSON);
  const [vehicles, setVehicles] = useState<VehicleDraft[]>([]);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(EMPTY_VEHICLE);

  // Submission
  const [progress, setProgress] = useState<CreationStep[] | null>(null);
  const [createdCase, setCreatedCase] = useState<Case | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = progress !== null && createdCase === null && submitError === null;

  // Default the lead to whoever is using the app.
  useEffect(() => {
    if (isOpen && leadInvestigatorId === '' && currentInvestigatorId !== null) setLeadInvestigatorId(currentInvestigatorId);
  }, [isOpen, currentInvestigatorId, leadInvestigatorId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;

  const reset = () => {
    setStep(1);
    setStepError(null);
    setTitle('');
    setIncidentType('road_accident');
    setPriority('medium');
    setIncidentAt('');
    setLeadInvestigatorId('');
    setTeamIds([]);
    setDescription('');
    setAddress('');
    setLat('');
    setLng('');
    setFiles([]);
    setPersons([]);
    setPersonDraft(EMPTY_PERSON);
    setVehicles([]);
    setVehicleDraft(EMPTY_VEHICLE);
    setProgress(null);
    setCreatedCase(null);
    setSubmitError(null);
  };

  function close() {
    reset();
    onClose();
  }

  const validateStep = (current: 1 | 2 | 3): string | null => {
    if (current === 1 && !title.trim()) return 'Enter a case title.';
    if (current === 2) {
      if (parseCoordinate(lat, -90, 90) === 'invalid') return 'Latitude must be a number between -90 and 90.';
      if (parseCoordinate(lng, -180, 180) === 'invalid') return 'Longitude must be a number between -180 and 180.';
      if ((lat.trim() || lng.trim()) && !address.trim()) return 'Enter the incident address for these coordinates.';
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(step);
    setStepError(error);
    if (!error) setStep((step + 1) as 2 | 3);
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = [...list];
    setFiles((prev) => [...prev, ...incoming.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };

  const addPerson = () => {
    if (!personDraft.name.trim()) return;
    setPersons([...persons, personDraft]);
    setPersonDraft(EMPTY_PERSON);
  };

  const addVehicle = () => {
    if (!vehicleDraft.label.trim() && !vehicleDraft.plate.trim()) return;
    setVehicles([...vehicles, vehicleDraft]);
    setVehicleDraft(EMPTY_VEHICLE);
  };

  const handleSubmit = async () => {
    for (const s of [1, 2] as const) {
      const error = validateStep(s);
      if (error) {
        setStep(s);
        setStepError(error);
        return;
      }
    }
    // Entries typed but not yet added with the "Add" buttons still count.
    const allPersons = personDraft.name.trim() ? [...persons, personDraft] : persons;
    const allVehicles = vehicleDraft.label.trim() || vehicleDraft.plate.trim() ? [...vehicles, vehicleDraft] : vehicles;

    const latitude = parseCoordinate(lat, -90, 90);
    const longitude = parseCoordinate(lng, -180, 180);
    const input: NewCaseInput = {
      case: {
        title: title.trim(),
        incident_type: incidentType,
        priority,
        description: description.trim(),
        incident_at: incidentAt ? new Date(incidentAt).toISOString() : null,
        lead_investigator_id: leadInvestigatorId === '' ? null : leadInvestigatorId,
        investigator_ids: [...new Set([...(leadInvestigatorId === '' ? [] : [leadInvestigatorId]), ...teamIds])]
      },
      location: address.trim()
        ? {
            kind: 'incident_site',
            address: address.trim(),
            lat: typeof latitude === 'number' ? latitude : null,
            lng: typeof longitude === 'number' ? longitude : null
          }
        : null,
      persons: allPersons.map((p) => ({
        name: p.name.trim(),
        role: p.role,
        age: p.age.trim() ? Number(p.age) : null,
        condition: p.condition || null,
        contact: p.contact.trim(),
        notes: p.notes.trim()
      })),
      vehicles: allVehicles.map((v) => ({
        kind: 'vehicle',
        label: v.label.trim() || v.plate.trim(),
        details: Object.fromEntries(
          Object.entries({ plate: v.plate.trim(), make: v.make.trim(), colour: v.colour.trim() }).filter(([, value]) => value)
        )
      })),
      files
    };

    setSubmitError(null);
    setProgress(plannedSteps(input));
    const update = (key: string, status: StepStatus, error?: string) =>
      setProgress((prev) => prev?.map((s) => (s.key === key ? { ...s, status, error } : s)) ?? null);

    try {
      const { created, failed } = await createCaseWithDetails(input, update);
      await invalidateCase(queryClient, created.id);
      if (failed === 0) {
        navigate(casePath(created.id));
        close();
      } else {
        setCreatedCase(created);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The case could not be created.');
    }
  };

  const investigatorName = (id: Id) => investigators?.find((i) => i.id === id)?.name ?? `#${id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-case-title"
        className="w-full max-w-2xl bg-surface border border-line-strong rounded-t-lg sm:rounded-lg shadow-overlay overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] focus:outline-none"
      >
        <div className="pl-6 pr-3 h-14 border-b border-line flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 id="create-case-title" className="text-sm font-semibold text-ink">
              New case
            </h2>
            <p className="text-xs text-ink-muted">{progress ? 'Saving the case' : `Step ${step} of 3: ${STEP_TITLES[step - 1]}`}</p>
          </div>

          <button onClick={close} disabled={submitting} className={iconButtonClass} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        {!progress && (
          <ol className="px-6 h-11 border-b border-line flex items-center gap-3 text-xs shrink-0 overflow-x-auto" aria-label="Steps">
            {STEP_TITLES.map((label, i) => {
              const n = i + 1;
              return (
                <React.Fragment key={label}>
                  {i > 0 && <li className="w-6 h-px bg-line-strong shrink-0" aria-hidden />}
                  <li
                    className={`flex items-center gap-2 whitespace-nowrap ${step === n ? 'text-ink font-medium' : 'text-ink-muted'}`}
                    aria-current={step === n ? 'step' : undefined}
                  >
                    <span
                      className={`size-5 rounded-full flex items-center justify-center font-mono text-2xs border ${
                        step === n ? 'bg-accent border-accent text-accent-fg' : step > n ? 'border-ok/60 text-ok' : 'border-line-strong'
                      }`}
                    >
                      {step > n ? <Check className="size-3" aria-label="Done" /> : n}
                    </span>
                    <span>{label}</span>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        )}

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* SUBMISSION PROGRESS */}
          {progress && (
            <div className="space-y-3">
              <ul className="rounded-md border border-line divide-y divide-line" aria-live="polite">
                {progress.map((s) => (
                  <li key={s.key} className="px-3 py-2 text-body">
                    <div className="flex items-center gap-2">
                      {s.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
                      {s.status === 'running' && <Loader2 className="size-4 text-accent-text animate-spin" />}
                      {s.status === 'failed' && <AlertTriangle className="size-4 text-danger" />}
                      {s.status === 'pending' && <Circle className="size-4 text-ink-faint" />}
                      <span className={s.status === 'pending' ? 'text-ink-muted' : 'text-ink'}>{s.label}</span>
                    </div>
                    {s.error && <p className="text-xs text-danger mt-1 pl-6">{s.error}</p>}
                  </li>
                ))}
              </ul>

              {submitError && (
                <div className="px-3 py-2.5 rounded-md bg-danger/10 border border-danger/40 text-body text-ink" role="alert">
                  The case was not created: {submitError}
                </div>
              )}
              {createdCase && (
                <div className="px-3 py-2.5 rounded-md bg-warn/10 border border-warn/40 text-body text-ink" role="status">
                  Case {createdCase.case_number} was created, but the items marked above didn't save. You can add them
                  from the case workspace.
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Case Details */}
          {!progress && step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="case-title" className={labelClass}>
                  Case title *
                </label>
                <input
                  id="case-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Collision at Ring Road and 5th Avenue junction"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="case-type" className={labelClass}>
                    Incident type
                  </label>
                  <select
                    id="case-type"
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                    className={inputClass}
                  >
                    {INCIDENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {humanize(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="case-priority" className={labelClass}>
                    Priority
                  </label>
                  <select
                    id="case-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CasePriority)}
                    className={inputClass}
                  >
                    {CASE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {humanize(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="case-incident-at" className={labelClass}>
                    Incident date and time
                  </label>
                  <input
                    id="case-incident-at"
                    type="datetime-local"
                    value={incidentAt}
                    onChange={(e) => setIncidentAt(e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="case-lead" className={labelClass}>
                  Lead investigator
                </label>
                <select
                  id="case-lead"
                  value={leadInvestigatorId}
                  onChange={(e) => setLeadInvestigatorId(e.target.value ? Number(e.target.value) : '')}
                  className={inputClass}
                >
                  <option value="">Not assigned</option>
                  {investigators?.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} — {inv.role}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className={labelClass}>Team</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {investigators?.map((inv) => (
                    <label
                      key={inv.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-line text-body text-ink-soft cursor-pointer hover:border-control"
                    >
                      <input
                        type="checkbox"
                        checked={teamIds.includes(inv.id) || inv.id === leadInvestigatorId}
                        disabled={inv.id === leadInvestigatorId}
                        onChange={(e) =>
                          setTeamIds(e.target.checked ? [...teamIds, inv.id] : teamIds.filter((id) => id !== inv.id))
                        }
                      />
                      <span className="truncate">{inv.name}</span>
                      {inv.id === leadInvestigatorId && <span className="text-2xs text-ink-muted">lead</span>}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="case-description" className={labelClass}>
                  Incident summary
                </label>
                <textarea
                  id="case-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is known so far: what happened, where, and who was involved."
                  className={`${inputClass} resize-none`}
                ></textarea>
              </div>
            </div>
          )}

          {/* STEP 2: Location and Evidence */}
          {!progress && step === 2 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="case-address" className={labelClass}>
                  Incident location
                </label>
                <input
                  id="case-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Ring Road and 5th Avenue junction, Sector 12"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="case-lat" className={labelClass}>
                    Latitude (optional)
                  </label>
                  <input
                    id="case-lat"
                    inputMode="decimal"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="12.9716"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="case-lng" className={labelClass}>
                    Longitude (optional)
                  </label>
                  <input
                    id="case-lng"
                    inputMode="decimal"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="77.5946"
                    className={inputClass}
                  />
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`border border-dashed rounded-md px-4 py-6 text-center transition-colors ${
                  isDragging ? 'border-accent bg-accent/10' : 'border-control/60'
                }`}
              >
                <UploadCloud className="size-5 text-ink-muted mx-auto mb-2" aria-hidden />
                <p className="text-body text-ink">{isDragging ? 'Drop to add' : 'Drop evidence files here, or choose them'}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  PDF, Word, text, photos, audio and short video. Each original is stored and hashed.
                </p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${secondaryButtonClass} mt-3`}>
                  Choose files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                  data-testid="evidence-file-input"
                />
              </div>

              <div>
                <span className="text-xs font-medium text-ink-soft block mb-1.5">
                  Files to upload <span className="font-mono text-ink-muted">{files.length}</span>
                </span>
                <div className="rounded-md border border-line divide-y divide-line">
                  {files.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="pl-3 pr-1.5 py-1.5 flex items-center justify-between gap-3 text-body">
                      <div className="min-w-0">
                        <span className="text-ink block truncate">{file.name}</span>
                        <span className="text-2xs text-ink-muted">
                          <span className="font-mono">{formatBytes(file.size)}</span> · {file.type || 'unknown type'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className={`${iconButtonClass} hover:text-danger`}
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: People and Vehicles */}
          {!progress && step === 3 && (
            <div className="space-y-5">
              <fieldset className="p-4 rounded-md border border-line space-y-3">
                <legend className="px-1 -ml-1 text-xs font-medium text-ink-soft">Add a person</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    aria-label="Person name"
                    value={personDraft.name}
                    onChange={(e) => setPersonDraft({ ...personDraft, name: e.target.value })}
                    placeholder="Full name"
                    className={`${smallInputClass} sm:col-span-2`}
                  />
                  <select
                    aria-label="Person role"
                    value={personDraft.role}
                    onChange={(e) => setPersonDraft({ ...personDraft, role: e.target.value as PersonRole })}
                    className={smallInputClass}
                  >
                    {PERSON_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {humanize(r)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Person age"
                    inputMode="numeric"
                    value={personDraft.age}
                    onChange={(e) => setPersonDraft({ ...personDraft, age: e.target.value.replace(/\D/g, '') })}
                    placeholder="Age"
                    className={smallInputClass}
                  />
                  <select
                    aria-label="Person condition"
                    value={personDraft.condition}
                    onChange={(e) => setPersonDraft({ ...personDraft, condition: e.target.value as PersonCondition | '' })}
                    className={smallInputClass}
                  >
                    <option value="">Condition unknown</option>
                    {PERSON_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {humanize(c)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Person contact"
                    value={personDraft.contact}
                    onChange={(e) => setPersonDraft({ ...personDraft, contact: e.target.value })}
                    placeholder="Contact"
                    className={smallInputClass}
                  />
                </div>
                <input
                  aria-label="Person notes"
                  value={personDraft.notes}
                  onChange={(e) => setPersonDraft({ ...personDraft, notes: e.target.value })}
                  placeholder="Notes, such as what they saw or their part in the incident"
                  className={smallInputClass}
                />
                <button
                  type="button"
                  onClick={addPerson}
                  disabled={!personDraft.name.trim()}
                  className={smallButtonClass}
                >
                  <Plus className="size-3" aria-hidden /> Add person
                </button>
              </fieldset>

              {persons.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-ink-soft block mb-1.5">
                    People <span className="font-mono text-ink-muted">{persons.length}</span>
                  </span>
                  <div className="rounded-md border border-line divide-y divide-line">
                    {persons.map((p, idx) => (
                      <div key={idx} className="pl-3 pr-1.5 py-2 flex items-center justify-between gap-3 text-body">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-ink">{p.name}</span>
                            <span className="text-xs text-ink-soft">{humanize(p.role)}</span>
                            {p.condition && <span className="text-xs text-ink-muted">· {humanize(p.condition)}</span>}
                          </div>
                          <p className="text-xs text-ink-muted">
                            {[p.age && `Age ${p.age}`, p.contact, p.notes].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPersons(persons.filter((_, i) => i !== idx))}
                          className={`${iconButtonClass} hover:text-danger shrink-0`}
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <fieldset className="p-4 rounded-md border border-line space-y-3">
                <legend className="px-1 -ml-1 text-xs font-medium text-ink-soft">Add a vehicle</legend>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    aria-label="Vehicle description"
                    value={vehicleDraft.label}
                    onChange={(e) => setVehicleDraft({ ...vehicleDraft, label: e.target.value })}
                    placeholder="Description, e.g. White hatchback"
                    className={`${smallInputClass} sm:col-span-4`}
                  />
                  <input
                    aria-label="Vehicle plate"
                    value={vehicleDraft.plate}
                    onChange={(e) => setVehicleDraft({ ...vehicleDraft, plate: e.target.value })}
                    placeholder="Plate"
                    className={smallInputClass}
                  />
                  <input
                    aria-label="Vehicle make"
                    value={vehicleDraft.make}
                    onChange={(e) => setVehicleDraft({ ...vehicleDraft, make: e.target.value })}
                    placeholder="Make and model"
                    className={`${smallInputClass} sm:col-span-2`}
                  />
                  <input
                    aria-label="Vehicle colour"
                    value={vehicleDraft.colour}
                    onChange={(e) => setVehicleDraft({ ...vehicleDraft, colour: e.target.value })}
                    placeholder="Colour"
                    className={smallInputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={addVehicle}
                  disabled={!vehicleDraft.label.trim() && !vehicleDraft.plate.trim()}
                  className={smallButtonClass}
                >
                  <Plus className="size-3" aria-hidden /> Add vehicle
                </button>
              </fieldset>

              {vehicles.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-ink-soft block mb-1.5">
                    Vehicles <span className="font-mono text-ink-muted">{vehicles.length}</span>
                  </span>
                  <div className="rounded-md border border-line divide-y divide-line">
                    {vehicles.map((v, idx) => (
                      <div key={idx} className="pl-3 pr-1.5 py-2 flex items-center justify-between gap-3 text-body">
                        <div className="min-w-0">
                          <span className="font-medium text-ink">{v.label || v.plate}</span>
                          <p className="text-xs text-ink-muted">
                            {v.plate && <span className="font-mono">{v.plate}</span>}
                            {[v.make, v.colour].filter(Boolean).map((x, i) => `${v.plate || i > 0 ? ' · ' : ''}${x}`)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVehicles(vehicles.filter((_, i) => i !== idx))}
                          className={`${iconButtonClass} hover:text-danger shrink-0`}
                          aria-label={`Remove ${v.label || v.plate}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {teamIds.length > 0 && (
                <p className="text-xs text-ink-muted">
                  Team: {teamIds.map(investigatorName).join(', ')}
                </p>
              )}
            </div>
          )}

          {stepError && !progress && (
            <div className="px-3 py-2.5 rounded-md bg-danger/10 border border-danger/40 text-body text-ink" role="alert">
              {stepError}
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="px-6 py-3 border-t border-line flex items-center justify-between gap-2 shrink-0">
          {progress ? (
            <>
              <button
                key="back-to-form"
                type="button"
                onClick={() => {
                  setProgress(null);
                  setSubmitError(null);
                }}
                disabled={submitting || createdCase !== null}
                className={`${secondaryButtonClass} disabled:opacity-0`}
              >
                Back to form
              </button>
              {createdCase && (
                <button
                  key="open-case"
                  type="button"
                  onClick={() => {
                    navigate(casePath(createdCase.id));
                    close();
                  }}
                  className={primaryButtonClass}
                >
                  Open case
                </button>
              )}
            </>
          ) : (
            <>
              {step > 1 ? (
                <button
                  key="back"
                  type="button"
                  onClick={() => {
                    setStepError(null);
                    setStep((step - 1) as 1 | 2);
                  }}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
              ) : (
                <div></div>
              )}

              {/* Separate keys stop React reusing one <button> for Next and Create. */}
              {step < 3 ? (
                <button
                  key="next"
                  type="button"
                  onClick={goNext}
                  className={primaryButtonClass}
                >
                  Next: {STEP_TITLES[step as 1 | 2].toLowerCase()}
                </button>
              ) : (
                <button
                  key="create"
                  type="button"
                  onClick={handleSubmit}
                  className={primaryButtonClass}
                >
                  Create case
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
