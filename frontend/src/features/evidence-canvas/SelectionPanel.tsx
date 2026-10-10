import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Flag, Loader2, X } from 'lucide-react';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { DeleteButton } from '@/components/shared/DeleteButton';
import { ReviewActions } from '@/components/shared/ReviewActions';
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

const row = 'p-2.5 rounded-lg bg-slate-900 border border-slate-800';

/** Details of the selected node or link, with review, flag and delete actions for links. */
export const SelectionPanel: React.FC<SelectionPanelProps> = ({ workspace, graph, selection, onSelect }) => {
  const caseId = workspace.case.id;
  const { open: openEvidence } = useEvidenceInspector();
  const update = useUpdateRelationship(caseId);
  const remove = useDeleteRelationship(caseId);

  const header = (title: string, kind: string) => (
    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
      <div className="min-w-0">
        <div className="text-[10px] text-cyan-400 uppercase">{kind}</div>
        <h3 className="text-sm font-bold text-slate-100 break-words">{title}</h3>
      </div>
      <button onClick={() => onSelect(null)} className="p-1 rounded text-slate-400 hover:bg-slate-800" aria-label="Close details">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  let body: React.ReactNode = null;

  if (selection.kind === 'edge') {
    const edge = graph.edges.find((e) => e.id === selection.id);
    const rel = edge && workspace.relationships.find((r) => r.id === edge.relationship_id);
    if (!edge || !rel) return null;
    const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
    body = (
      <>
        {header(rel.label || humanize(rel.kind), 'Link')}
        <div className="text-xs space-y-2">
          <div className={row}>
            <button onClick={() => onSelect({ kind: 'node', id: edge.source })} className="text-cyan-300 hover:underline">
              {label(edge.source)}
            </button>
            <span className="text-slate-500"> → </span>
            <button onClick={() => onSelect({ kind: 'node', id: edge.target })} className="text-cyan-300 hover:underline">
              {label(edge.target)}
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className={row}>
              <dt className="text-[10px] text-slate-500 uppercase">Kind</dt>
              <dd className="text-slate-200">{humanize(rel.kind)}</dd>
            </div>
            <div className={row}>
              <dt className="text-[10px] text-slate-500 uppercase">Confidence</dt>
              <dd className="text-slate-200">{rel.confidence !== null ? `${Math.round(rel.confidence * 100)}%` : '—'}</dd>
            </div>
          </dl>
          {rel.notes && <p className={`${row} text-slate-300`}>{rel.notes}</p>}
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
              className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1 disabled:opacity-50 ${
                rel.flagged ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {update.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
              {rel.flagged ? 'Unflag' : 'Flag'}
            </button>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
              Delete link
              <DeleteButton
                label="link"
                busy={remove.isPending}
                onDelete={() => remove.mutate(rel.id, { onSuccess: () => onSelect(null) })}
              />
            </span>
          </div>
          {(update.isError || remove.isError) && (
            <p className="text-[11px] text-red-300">{((update.error ?? remove.error) as Error).message}</p>
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
        <div className="text-xs space-y-2">
          {person && (
            <div className={`${row} space-y-1`}>
              <div className="text-slate-200">
                {[humanize(person.role), person.condition && humanize(person.condition), person.age !== null && `age ${person.age}`]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
              {person.notes && <p className="text-[11px] text-slate-400">{person.notes}</p>}
            </div>
          )}
          {object && (
            <div className={`${row} text-slate-200`}>
              {[object.details.plate, object.details.make, object.details.colour, object.details.number].filter(Boolean).join(' • ') || '—'}
            </div>
          )}
          {location && <div className={`${row} text-slate-200`}>{humanize(location.kind)}</div>}
          {evidence && (
            <button
              onClick={() => openEvidence(evidence.id)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] flex items-center justify-center gap-1"
            >
              Open evidence <ExternalLink className="w-3 h-3" />
            </button>
          )}
          {(person || object || location) && (
            <Link to={casePath(caseId, 'people')} className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1">
              Edit in People & Vehicles <ExternalLink className="w-3 h-3" />
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
            <div className="text-[10px] text-slate-500 uppercase">Links ({connected.length})</div>
            {connected.map((e) => {
              const other = graph.nodes.find((n) => n.id === (e.source === node.id ? e.target : e.source));
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect({ kind: 'edge', id: e.id })}
                  className={`${row} w-full text-left hover:border-cyan-500/40`}
                >
                  <span className="text-slate-200">{e.label || humanize(e.kind)}</span>
                  <span className="text-slate-500"> {e.source === node.id ? '→' : '←'} </span>
                  <span className="text-cyan-300">{other?.label}</span>
                  {e.review_status === 'pending' && <span className="text-[10px] text-purple-300"> · AI proposal</span>}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <aside className="w-80 shrink-0 border-l border-slate-800 bg-slate-950/95 p-4 overflow-y-auto space-y-3 font-mono" aria-label="Selection details">
      {body}
    </aside>
  );
};
