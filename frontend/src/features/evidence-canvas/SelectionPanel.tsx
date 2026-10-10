import React from 'react';
import { Link } from 'react-router-dom';
import { Flag, Loader2, X } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { DeleteButton } from '@/components/shared/DeleteButton';
import { ReviewActions } from '@/components/shared/ReviewActions';
import { iconButtonClass, secondaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { useDeleteRelationship, useUpdateRelationship } from '@/hooks/useGraph';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { casePath } from '@/lib/caseModules';
import { humanize } from '@/lib/format';
import { CaseGraph, CaseWorkspace } from '@/types/api';
import { parseNodeId } from './layout';

export type CanvasSelection = { kind: 'node' | 'edge'; id: string };

interface SelectionPanelProps {
  workspace: CaseWorkspace;
  graph: CaseGraph;
  selection: CanvasSelection;
  onSelect: (selection: CanvasSelection | null) => void;
}

const label = 'text-2xs text-ink-muted';

/** Details of the selected node or link, with review, flag and delete actions for links. */
export const SelectionPanel: React.FC<SelectionPanelProps> = ({ workspace, graph, selection, onSelect }) => {
  const caseId = workspace.case.id;
  const { open: openEvidence } = useEvidenceInspector();
  const update = useUpdateRelationship(caseId);
  const remove = useDeleteRelationship(caseId);

  const header = (title: string, kind: string) => (
    <div className="flex items-start justify-between gap-2 pb-3 border-b border-line">
      <div className="min-w-0">
        <div className={label}>{kind}</div>
        <h3 className="text-sm font-semibold text-ink break-words">{title}</h3>
      </div>
      <button onClick={() => onSelect(null)} className={`${iconButtonClass} -mr-1.5 -mt-1`} aria-label="Close details">
        <X className="size-4" />
      </button>
    </div>
  );

  let body: React.ReactNode = null;

  if (selection.kind === 'edge') {
    const edge = graph.edges.find((e) => e.id === selection.id);
    const rel = edge && workspace.relationships.find((r) => r.id === edge.relationship_id);
    if (!edge || !rel) return null;
    const nodeLabel = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
    body = (
      <>
        {header(rel.label || humanize(rel.kind), 'Link')}
        <div className="text-body space-y-4">
          <div>
            <button onClick={() => onSelect({ kind: 'node', id: edge.source })} className="text-accent-text hover:underline text-left">
              {nodeLabel(edge.source)}
            </button>
            <span className="text-ink-muted"> → </span>
            <button onClick={() => onSelect({ kind: 'node', id: edge.target })} className="text-accent-text hover:underline text-left">
              {nodeLabel(edge.target)}
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className={label}>Kind</dt>
              <dd className="text-ink">{humanize(rel.kind)}</dd>
            </div>
            <div>
              <dt className={label}>Confidence</dt>
              <dd className="font-mono text-ink">{rel.confidence !== null ? `${Math.round(rel.confidence * 100)}%` : '—'}</dd>
            </div>
          </dl>
          {rel.notes && <p className="text-ink-soft">{rel.notes}</p>}
          <ReviewActions
            origin={rel.origin}
            status={rel.review_status}
            busy={update.isPending}
            onChange={(review_status) => update.mutate({ id: rel.id, input: { review_status } })}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => update.mutate({ id: rel.id, input: { flagged: !rel.flagged } })}
              disabled={update.isPending}
              aria-pressed={rel.flagged}
              className={`${smallButtonClass} ${rel.flagged ? 'border-danger/50 text-danger hover:text-danger' : ''}`}
            >
              {update.isPending ? <Loader2 className="size-3 animate-spin" /> : <Flag className="size-3" />}
              {rel.flagged ? 'Unflag' : 'Flag'}
            </button>
            <span className="ml-auto flex items-center gap-1 text-xs text-ink-muted">
              Delete link
              <DeleteButton
                label="link"
                busy={remove.isPending}
                onDelete={() => remove.mutate(rel.id, { onSuccess: () => onSelect(null) })}
              />
            </span>
          </div>
          {(update.isError || remove.isError) && (
            <p className="text-xs text-danger">{((update.error ?? remove.error) as Error).message}</p>
          )}
          <SourcePassages
            links={workspace.links}
            evidence={workspace.evidence}
            targetType="relationship"
            targetId={rel.id}
            onOpenEvidence={openEvidence}
          />
        </div>
      </>
    );
  } else {
    const node = graph.nodes.find((n) => n.id === selection.id);
    if (!node) return null;
    const { type, id } = parseNodeId(node.id);
    const connected = graph.edges.filter((e) => e.source === node.id || e.target === node.id);
    const person = type === 'person' ? workspace.persons.find((p) => p.id === id) : undefined;
    const object = type === 'object' ? workspace.objects.find((o) => o.id === id) : undefined;
    const location = type === 'location' ? workspace.locations.find((l) => l.id === id) : undefined;
    const evidence = type === 'evidence' ? workspace.evidence.find((e) => e.id === id) : undefined;

    body = (
      <>
        {header(node.label, humanize(type === 'object' ? object?.kind ?? 'object' : type))}
        <div className="text-body space-y-4">
          {person && (
            <div className="space-y-1">
              <div className="text-ink">
                {[humanize(person.role), person.condition && humanize(person.condition), person.age !== null && `age ${person.age}`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {person.notes && <p className="text-xs text-ink-muted">{person.notes}</p>}
            </div>
          )}
          {object && (
            <div className="text-ink">
              {[object.details.plate, object.details.make, object.details.colour, object.details.number].filter(Boolean).join(' · ') || '—'}
            </div>
          )}
          {location && <div className="text-ink">{humanize(location.kind)}</div>}
          {evidence && (
            <button
              onClick={() => openEvidence(evidence.id)}
              className={`${secondaryButtonClass} w-full`}
            >
              Open evidence
            </button>
          )}
          {(person || object || location) && (
            <Link to={casePath(caseId, 'people')} className="block text-xs text-accent-text hover:underline">
              Edit in People & vehicles
            </Link>
          )}
          {(person || object || location) && (
            <SourcePassages
              links={workspace.links}
              evidence={workspace.evidence}
              targetType={type}
              targetId={id}
              onOpenEvidence={openEvidence}
            />
          )}
          <div className="space-y-1">
            <div className={label}>Links ({connected.length})</div>
            {connected.map((e) => {
              const other = graph.nodes.find((n) => n.id === (e.source === node.id ? e.target : e.source));
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect({ kind: 'edge', id: e.id })}
                  className="w-full text-left px-2 py-1.5 -mx-2 rounded hover:bg-raised"
                >
                  <span className="text-ink">{e.label || humanize(e.kind)}</span>
                  <span className="text-ink-muted"> {e.source === node.id ? '→' : '←'} </span>
                  <span className="text-accent-text">{other?.label}</span>
                  {e.review_status === 'pending' && <span className="text-2xs text-pending"> · AI proposal</span>}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <aside className="w-80 max-w-[85%] shrink-0 border-l border-line bg-surface p-4 overflow-y-auto space-y-4" aria-label="Selection details">
      {body}
    </aside>
  );
};
