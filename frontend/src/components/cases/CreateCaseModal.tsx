import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  FolderPlus,
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Circle,
  Car,
  UserPlus
} from 'lucide-react';
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

const labelClass = 'block text-xs font-mono text-slate-300 font-semibold mb-1.5 uppercase';
const inputClass =
  'w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500';
const smallInputClass =
  'w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-case-title"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-case-title" className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider">
                New Investigation
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {progress ? 'Saving' : `Step ${step} of 3 • ${STEP_TITLES[step - 1]}`}
              </p>
            </div>
          </div>

          <button
            onClick={close}
            disabled={submitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        {!progress && (
          <div className="px-6 py-3 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between font-mono text-xs">
            {STEP_TITLES.map((label, i) => {
              const n = i + 1;
              return (
                <React.Fragment key={label}>
                  {i > 0 && <div className="w-8 h-px bg-slate-800"></div>}
                  <div className={`flex items-center gap-2 ${step === n ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        step === n ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'
                      }`}
                    >
                      {n}
                    </span>
                    <span>{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* SUBMISSION PROGRESS */}
          {progress && (
            <div className="space-y-3 font-mono">
              <ul className="space-y-2">
                {progress.map((s) => (
                  <li key={s.key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      {s.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {s.status === 'running' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                      {s.status === 'failed' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                      {s.status === 'pending' && <Circle className="w-4 h-4 text-slate-600" />}
                      <span className={s.status === 'failed' ? 'text-red-200' : 'text-slate-200'}>{s.label}</span>
                    </div>
                    {s.error && <p className="text-[11px] text-red-300 mt-1 pl-6">{s.error}</p>}
                  </li>
                ))}
              </ul>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200">
                  The case was not created: {submitError}
                </div>
              )}
              {createdCase && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-100">
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
                  Case Title *
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
                    Incident Type
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
                    Incident Date & Time
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
                  Lead Investigator
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
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={teamIds.includes(inv.id) || inv.id === leadInvestigatorId}
                        disabled={inv.id === leadInvestigatorId}
                        onChange={(e) =>
                          setTeamIds(e.target.checked ? [...teamIds, inv.id] : teamIds.filter((id) => id !== inv.id))
                        }
                        className="accent-cyan-500"
                      />
                      <span className="truncate">{inv.name}</span>
                      {inv.id === leadInvestigatorId && <span className="text-[10px] text-cyan-400">lead</span>}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="case-description" className={labelClass}>
                  Incident Summary
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
                  Incident Location
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
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-mono font-bold text-slate-200 uppercase">Drag & drop evidence files here</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  PDFs, Word documents, text, photos, audio and short videos. The original is stored and hashed.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg border border-slate-700 inline-block"
                >
                  Select Files
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
                <span className="text-xs font-mono text-slate-400 uppercase block mb-2 font-semibold">
                  Files to upload ({files.length})
                </span>
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 border border-slate-800">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-slate-200 font-semibold block truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {formatBytes(file.size)} • {file.type || 'unknown type'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
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
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-cyan-400" /> Add a person
                </span>
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
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add person
                </button>
              </div>

              {persons.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase block font-semibold">
                    People ({persons.length})
                  </span>
                  {persons.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{p.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {humanize(p.role)}
                          </span>
                          {p.condition && <span className="text-[10px] text-slate-400">{humanize(p.condition)}</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {[p.age && `Age ${p.age}`, p.contact, p.notes].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPersons(persons.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-red-400 p-1"
                        aria-label={`Remove ${p.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-2">
                  <Car className="w-4 h-4 text-cyan-400" /> Add a vehicle
                </span>
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
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add vehicle
                </button>
              </div>

              {vehicles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase block font-semibold">
                    Vehicles ({vehicles.length})
                  </span>
                  {vehicles.map((v, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div>
                        <span className="font-bold text-slate-200">{v.label || v.plate}</span>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {[v.plate, v.make, v.colour].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVehicles(vehicles.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-red-400 p-1"
                        aria-label={`Remove ${v.label || v.plate}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {teamIds.length > 0 && (
                <p className="text-[11px] text-slate-500 font-mono">
                  Team: {teamIds.map(investigatorName).join(', ')}
                </p>
              )}
            </div>
          )}

          {stepError && !progress && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 font-mono" role="alert">
              {stepError}
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between font-mono">
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
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5 disabled:opacity-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to form
              </button>
              {createdCase && (
                <button
                  key="open-case"
                  type="button"
                  onClick={() => {
                    navigate(casePath(createdCase.id));
                    close();
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  Open case <ArrowRight className="w-3.5 h-3.5" />
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
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
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
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Next Step <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  key="create"
                  type="button"
                  onClick={handleSubmit}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  CREATE CASE
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
