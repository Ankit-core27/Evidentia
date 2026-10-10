import dagre from '@dagrejs/dagre';
import { GraphEdge, GraphNode } from '@/types/api';

export const NODE_WIDTH = 210;
export const NODE_HEIGHT = 64;

/**
 * Positions for the graph, left to right. The backend sends nodes without positions
 * (see docs/FRONTEND_TASKS.md), so the canvas lays them out itself.
 */
export const layoutGraph = (nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number }> => {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 140, marginx: 20, marginy: 20 });
  graph.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => graph.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => graph.setEdge(e.source, e.target));
  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    const { x, y } = graph.node(n.id);
    // dagre gives centres; React Flow wants top-left corners.
    positions.set(n.id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 });
  });
  return positions;
};

/** "person:3" → { type: 'person', id: 3 } */
export const parseNodeId = (nodeId: string) => {
  const [type, id] = nodeId.split(':');
  return { type: type as GraphNode['type'], id: Number(id) };
};
