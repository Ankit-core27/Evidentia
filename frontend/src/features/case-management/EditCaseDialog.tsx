import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useInvestigators, useUpdateCase } from '@/hooks/useCases';
import { humanize } from '@/lib/format';
import { CASE_PRIORITIES, CASE_STATUSES, INCIDENT_TYPES } from '@/lib/options';
import { Case, CasePriority, CaseStatus, Id, IncidentType } from '@/types/api';

/** ISO date-time to the value a datetime-local input expects, in the viewer's time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Edits the case record (PATCH /api/cases/{id}). Only changed fields are sent. */
export const EditCaseDialog: React.FC<{ caseRecord: Case; onClose: () => void }> = ({ caseRecord: c, onClose }) => {
  const updateCase = useUpdateCase(c.id);
  const { data: investigators } = useInvestigators();
  const [title, setTitle] = useState(c.title);
  const [incidentType, setIncidentType] = useState<IncidentType>(c.incident_type);
  const [status, setStatus] = useState<CaseStatus>(c.status);
  const [priority, setPriority] = useState<CasePriority>(c.priority);
  const [incidentAt, setIncidentAt] = useState(toLocalInput(c.incident_at));
  const [leadId, setLeadId] = useState<Id | ''>(c.lead_investigator_id ?? '');
  const [teamIds, setTeamIds] = useState<Id[]>(c.investigator_ids);
  const [description, setDescription] = useState(c.description);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return setError('The case needs a title.');
    const lead = leadId === '' ? null : leadId;
    const team = [...new Set([...(lead === null ? [] : [lead]), ...teamIds])];
    const next = {
      title: title.trim(),
      incident_type: incidentType,
      status,
      priority,
      incident_at: incidentAt ? new Date(incidentAt).toISOString() : null,
      lead_investigator_id: lead,
      investigator_ids: team,
      description: description.trim()
    };
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => {
        const before = c[key as keyof Case];
        // Compare times by instant, so an unchanged time isn't sent because of formatting.
        if (key === 'incident_at') return toLocalInput(before as string | null) !== incidentAt;
        return JSON.stringify(before) !== JSON.stringify(value);
      })
    );
    if (!Object.keys(changes).length) return onClose();
    setError(null);
    try {
      await updateCase.mutateAsync(changes);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    }
  };

  const saving = updateCase.isPending;

  return (
    <Dialog
      open
      title={`Edit ${c.case_number}`}
      onClose={onClose}
      busy={saving}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" form="edit-case-form" disabled={saving} className={primaryButtonClass}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save changes
          </button>
        </>
      }
    >
      <form
        id="edit-case-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor="edit-title" className={labelClass}>
            Title *
          </label>
          <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="edit-type" className={labelClass}>
              Incident type
            </label>
            <select id="edit-type" value={incidentType} onChange={(e) => setIncidentType(e.target.value as IncidentType)} className={inputClass}>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-status" className={labelClass}>
              Status
            </label>
            <select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)} className={inputClass}>
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-priority" className={labelClass}>
              Priority
            </label>
            <select id="edit-priority" value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)} className={inputClass}>
              {CASE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-incident-at" className={labelClass}>
              Incident time
            </label>
            <input
              id="edit-incident-at"
              type="datetime-local"
              value={incidentAt}
              onChange={(e) => setIncidentAt(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="edit-lead" className={labelClass}>
            Lead investigator
          </label>
          <select
            id="edit-lead"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value ? Number(e.target.value) : '')}
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
          <div className="grid grid-cols-2 gap-2">
            {investigators?.map((inv) => (
              <label
                key={inv.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={teamIds.includes(inv.id) || inv.id === leadId}
                  disabled={inv.id === leadId}
                  onChange={(e) => setTeamIds(e.target.checked ? [...teamIds, inv.id] : teamIds.filter((id) => id !== inv.id))}
                  className="accent-cyan-500"
                />
                <span className="truncate">{inv.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="edit-description" className={labelClass}>
            Summary
          </label>
          <textarea
            id="edit-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>
        {error && (
          <p className="text-[11px] text-red-300" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
};
