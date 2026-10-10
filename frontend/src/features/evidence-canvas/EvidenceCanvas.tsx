import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useNodesState,
  type Connection,
  type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryState';
import { useCaseGraph } from '@/hooks/useGraph';
import { CaseWorkspace, GraphEdge, ReviewStatus } from '@/types/api';
import { CreateLinkDialog } from './CreateLinkDialog';
import { layoutGraph } from './layout';
import { RecordFlowNode, RecordNode } from './RecordNode';
import { SelectionPanel, CanvasSelection } from './SelectionPanel';

const NODE_TYPES = { record: RecordNode };

const edgeColour = (edge: GraphEdge) =>
  edge.flagged ? '#f87171' : edge.review_status === 'pending' ? '#a78bfa' : edge.review_status === 'rejected' ? '#475569' : '#22d3ee';

interface EvidenceCanvasProps {
  workspace: CaseWorkspace;
  /** A small, non-interactive preview, as on the case overview. */
  readOnly?: boolean;
  heightClass?: string;
}

/** The relationship canvas (GET /api/cases/{id}/graph), laid out automatically. */
export const EvidenceCanvas: React.FC<EvidenceCanvasProps> = ({ workspace, readOnly = false, heightClass = 'h-[640px]' }) => {
  const caseId = workspace.case.id;
  const graphQuery = useCaseGraph(caseId);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  const [newLink, setNewLink] = useState<{ source: string; target: string } | null>(null);
  // Positions the investigator dragged nodes to; "Tidy layout" clears them.
  const dragged = useRef(new Map<string, { x: number; y: number }>());
  const [layoutVersion, setLayoutVersion] = useState(0);

  const visible = useMemo(() => {
    const graph = graphQuery.data;
    if (!graph) return null;
    const keep = (status: ReviewStatus) => showRejected || status !== 'rejected';
    let edges = graph.edges.filter((e) => keep(e.review_status));
    let nodes = graph.nodes.filter((n) => keep(n.review_status));
    if (flaggedOnly) {
      edges = edges.filter((e) => e.flagged);
      const touched = new Set(edges.flatMap((e) => [e.source, e.target]));
      nodes = nodes.filter((n) => touched.has(n.id));
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [graphQuery.data, flaggedOnly, showRejected]);

  const computedNodes: RecordFlowNode[] = useMemo(() => {
    if (!visible) return [];
    const positions = layoutGraph(visible.nodes, visible.edges);
    return visible.nodes.map((n) => {
      const person = n.type === 'person' ? workspace.persons.find((p) => p.id === n.record_id) : undefined;
      const object = n.type === 'object' ? workspace.objects.find((o) => o.id === n.record_id) : undefined;
      return {
        id: n.id,
        type: 'record',
        position: dragged.current.get(n.id) ?? positions.get(n.id)!,
        data: { node: n, role: person?.role, objectKind: object?.kind, readOnly },
        draggable: !readOnly,
        connectable: !readOnly
      };
    });
    // layoutVersion is a dependency only to force a fresh layout after "Tidy layout".
  }, [visible, workspace.persons, workspace.objects, readOnly, layoutVersion]);

  const [nodes, setNodes, onNodesChange] = useNodesState<RecordFlowNode>([]);
  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes]);

  const edges: Edge[] = useMemo(
    () =>
      (visible?.edges ?? []).map((e) => {
        const colour = edgeColour(e);
        const isSelected = selection?.kind === 'edge' && selection.id === e.id;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          type: 'smoothstep',
          animated: e.review_status === 'pending',
          style: {
            stroke: colour,
            strokeWidth: isSelected ? 3 : e.flagged ? 2 : 1.5,
            strokeDasharray: e.review_status === 'confirmed' ? undefined : '6 4',
            opacity: e.review_status === 'rejected' ? 0.5 : 1
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: colour },
          labelStyle: { fill: '#cbd5e1', fontSize: 10, fontFamily: 'monospace' },
          labelBgStyle: { fill: '#020617' },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          data: { edge: e }
        };
      }),
    [visible, selection]
  );

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) {
      setNewLink({ source: connection.source, target: connection.target });
    }
  }, []);

  if (graphQuery.isPending) return <LoadingState label="Loading the canvas…" />;
  if (graphQuery.isError) return <ErrorState error={graphQuery.error} onRetry={() => graphQuery.refetch()} />;
  if (!graphQuery.data.nodes.length) {
    return <EmptyState title="Nothing to draw yet" message="People, vehicles and their links appear here as they are recorded or proposed." />;
  }

  const nodeLabel = (id: string) => graphQuery.data.nodes.find((n) => n.id === id)?.label ?? id;
  const flaggedCount = graphQuery.data.edges.filter((e) => e.flagged && e.review_status !== 'rejected').length;
  const rejectedCount =
    graphQuery.data.edges.filter((e) => e.review_status === 'rejected').length +
    graphQuery.data.nodes.filter((n) => n.review_status === 'rejected').length;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} className="accent-red-500" />
            Flagged links only ({flaggedCount})
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="accent-cyan-500" />
            Show rejected ({rejectedCount})
          </label>
          <button
            onClick={() => {
              dragged.current.clear();
              setLayoutVersion((v) => v + 1);
            }}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:text-cyan-300 flex items-center gap-1"
          >
            <LayoutGrid className="w-3 h-3" /> Tidy layout
          </button>
          <span className="ml-auto flex items-center gap-3 text-[10px] text-slate-400">
            <Legend colour="#22d3ee" label="Confirmed" />
            <Legend colour="#a78bfa" label="AI proposal" dashed />
            <Legend colour="#f87171" label="Flagged" />
            <span>Drag from a node's right handle to another node to link them.</span>
          </span>
        </div>
      )}

      <div className={`flex rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 ${heightClass}`}>
        <div className="flex-1 min-w-0" data-testid={readOnly ? 'canvas-preview' : 'canvas'}>
          <ReactFlow<RecordFlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, node) => dragged.current.set(node.id, node.position)}
            onConnect={readOnly ? undefined : onConnect}
            onNodeClick={readOnly ? undefined : (_, node) => setSelection({ kind: 'node', id: node.id })}
            onEdgeClick={readOnly ? undefined : (_, edge) => setSelection({ kind: 'edge', id: edge.id })}
            onPaneClick={() => setSelection(null)}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            zoomOnScroll={!readOnly}
            panOnDrag={!readOnly}
            deleteKeyCode={null}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
          >
            <Background color="#1e293b" gap={18} />
            {!readOnly && <Controls showInteractive={false} />}
            {!readOnly && <MiniMap pannable zoomable nodeColor="#334155" maskColor="rgba(2,6,23,0.7)" />}
          </ReactFlow>
        </div>
        {!readOnly && selection && (
          <SelectionPanel
            workspace={workspace}
            graph={graphQuery.data}
            selection={selection}
            onSelect={setSelection}
          />
        )}
      </div>

      {newLink && (
        <CreateLinkDialog
          caseId={caseId}
          source={{ id: newLink.source, label: nodeLabel(newLink.source) }}
          target={{ id: newLink.target, label: nodeLabel(newLink.target) }}
          onClose={() => setNewLink(null)}
        />
      )}
    </div>
  );
};

const Legend: React.FC<{ colour: string; label: string; dashed?: boolean }> = ({ colour, label, dashed }) => (
  <span className="flex items-center gap-1">
    <svg width="18" height="6" aria-hidden>
      <line x1="0" y1="3" x2="18" y2="3" stroke={colour} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
    {label}
  </span>
);
