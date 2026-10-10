import React, { useState } from 'react';
import {
  Share2,
  AlertTriangle,
  Zap,
  RotateCcw,
  Maximize2,
  Search,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { NetworkNode, NetworkLink } from '@/types';

interface NetworkGraphViewerProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export const NetworkGraphViewer: React.FC<NetworkGraphViewerProps> = ({ nodes, links }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [onlySuspicious, setOnlySuspicious] = useState<boolean>(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Find all links connected to selected node
  const connectedLinks = links.filter(
    (l) => l.source === selectedNodeId || l.target === selectedNodeId
  );

  const filteredLinks = onlySuspicious ? links.filter((l) => l.isSuspicious) : links;

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800/90 overflow-hidden">
      {/* Graph Header */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            POI RELATIONSHIP & EVIDENCE NODE GRAPH
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlySuspicious(!onlySuspicious)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all flex items-center gap-1.5 ${
              onlySuspicious
                ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Only Anomaly Links</span>
          </button>

          <button
            onClick={() => setSelectedNodeId(nodes[0]?.id || null)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
            title="Reset Node Selection"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Graph & Info Panel */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 items-stretch">
        {/* SVG Interactive Graph Stage (7 Cols) */}
        <div className="md:col-span-7 relative bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 min-h-[380px] overflow-hidden flex items-center justify-center">
          {/* Grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none"></div>

          <svg className="w-full h-full min-h-[360px] relative z-10" viewBox="100 80 700 400">
            {/* Render Links */}
            {filteredLinks.map((link, idx) => {
              const sourceNode = nodes.find((n) => n.id === link.source);
              const targetNode = nodes.find((n) => n.id === link.target);

              if (!sourceNode || !targetNode) return null;

              const isHighlighted =
                selectedNodeId === link.source || selectedNodeId === link.target;

              return (
                <g key={idx}>
                  {/* Link Line */}
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={link.isSuspicious ? '#ef4444' : '#06b6d4'}
                    strokeWidth={isHighlighted ? '2.5' : '1.2'}
                    strokeDasharray={link.isSuspicious ? '4 4' : undefined}
                    strokeOpacity={isHighlighted ? '1' : '0.4'}
                    className={link.isSuspicious ? 'animate-pulse' : ''}
                  />

                  {/* Midpoint Relationship Badge */}
                  <rect
                    x={(sourceNode.x + targetNode.x) / 2 - 35}
                    y={(sourceNode.y + targetNode.y) / 2 - 8}
                    width="70"
                    height="16"
                    rx="4"
                    fill="#020617"
                    stroke={link.isSuspicious ? '#ef4444' : '#334155'}
                    strokeWidth="0.8"
                    opacity="0.9"
                  />
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2 + 3}
                    fill={link.isSuspicious ? '#fca5a5' : '#94a3b8'}
                    fontSize="7"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {link.label.length > 12 ? link.label.substring(0, 10) + '..' : link.label}
                  </text>
                </g>
              );
            })}

            {/* Render Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const nodeColor = node.color || '#06b6d4';

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="cursor-pointer group"
                  transform={`translate(${node.x}, ${node.y})`}
                >
                  {/* Selection Pulse Ring */}
                  {isSelected && (
                    <circle
                      r="22"
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      className="animate-spin"
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    r={isSelected ? '16' : '12'}
                    fill="#020617"
                    stroke={nodeColor}
                    strokeWidth={isSelected ? '3' : '2'}
                    className="transition-all duration-200 group-hover:scale-110"
                  />

                  {/* Inner Core */}
                  <circle r="4" fill={nodeColor} />

                  {/* Node Text Labels */}
                  <text
                    y="26"
                    fill="#f8fafc"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {node.label}
                  </text>
                  <text
                    y="36"
                    fill="#64748b"
                    fontSize="7"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {node.sublabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node / Connection Details (5 Cols) */}
        <div className="md:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                  NODE SPECIFICATIONS
                </span>
                {selectedNode.threatLevel && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedNode.threatLevel === 'Severe'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {selectedNode.threatLevel} THREAT
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-sm font-mono font-bold text-slate-100">
                  {selectedNode.label}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Type: {selectedNode.type} • ID: {selectedNode.id}
                </p>
              </div>

              {/* Connected Links Breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase block">
                  Connected Network Ties ({connectedLinks.length})
                </span>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {connectedLinks.map((link, idx) => {
                    const otherNodeId =
                      link.source === selectedNode.id ? link.target : link.source;
                    const otherNode = nodes.find((n) => n.id === otherNodeId);

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">
                            → {otherNode?.label || otherNodeId}
                          </span>
                          {link.isSuspicious && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] border border-red-500/30">
                              ANOMALY
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{link.label}</p>
                        {link.notes && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">
                            Note: {link.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 font-mono">
              Click a node in the graph to analyze relationships.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
