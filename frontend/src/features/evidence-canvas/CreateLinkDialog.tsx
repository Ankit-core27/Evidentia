import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/shared/Dialog';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';
import { useCreateRelationship } from '@/hooks/useGraph';
import { humanize } from '@/lib/format';
import { RELATIONSHIP_KINDS } from '@/lib/options';
import { Id, RelationshipKind } from '@/types/api';
import { parseNodeId } from './layout';

interface CreateLinkDialogProps {
  caseId: Id;
  source: { id: string; label: string };
  target: { id: string; label: string };
  onClose: () => void;
}

/** Adds a relationship between two canvas nodes (POST /api/cases/{id}/relationships). */
export const CreateLinkDialog: React.FC<CreateLinkDialogProps> = ({ caseId, source, target, onClose }) => {
  const create = useCreateRelationship(caseId);
  const [kind, setKind] = useState<RelationshipKind>('involved_in');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [flagged, setFlagged] = useState(false);

  const save = async () => {
    const from = parseNodeId(source.id);
    const to = parseNodeId(target.id);
    try {
      await create.mutateAsync({
        from_type: from.type,
        from_id: from.id,
        to_type: to.type,
        to_id: to.id,
        kind,
        label: label.trim() || humanize(kind),
        notes: notes.trim(),
        flagged
      });
      onClose();
    } catch {
      // The error shows in the dialog.
    }
  };

  return (
    <Dialog
      open
      title="Add a link"
      onClose={onClose}
      busy={create.isPending}
      footer={
        <>
          <button onClick={onClose} disabled={create.isPending} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" form="link-form" disabled={create.isPending} className={primaryButtonClass}>
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add link
          </button>
        </>
      }
    >
      <form
        id="link-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-xs text-slate-300">
          <span className="text-cyan-300 font-bold">{source.label}</span> → <span className="text-cyan-300 font-bold">{target.label}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="link-kind" className={labelClass}>
              Kind
            </label>
            <select id="link-kind" value={kind} onChange={(e) => setKind(e.target.value as RelationshipKind)} className={inputClass}>
              {RELATIONSHIP_KINDS.map((k) => (
                <option key={k} value={k}>
                  {humanize(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="link-label" className={labelClass}>
              Label
            </label>
            <input
              id="link-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={humanize(kind)}
              className={inputClass}
              autoFocus
            />
          </div>
        </div>
        <div>
          <label htmlFor="link-notes" className={labelClass}>
            Notes
          </label>
          <textarea id="link-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} className="accent-red-500" />
          Flag as needing attention
        </label>
        {create.isError && <p className="text-[11px] text-red-300">{(create.error as Error).message}</p>}
      </form>
    </Dialog>
  );
};
