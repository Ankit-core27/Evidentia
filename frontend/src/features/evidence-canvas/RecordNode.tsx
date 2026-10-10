import React, { memo } from 'react';
import { Handle, NodeProps, Position, type Node } from '@xyflow/react';
import { Car, FileText, MapPin, Package, Phone, User } from 'lucide-react';
import { GraphNode, ObjectKind, PersonRole } from '@/types/api';
import { NODE_HEIGHT, NODE_WIDTH } from './layout';

export interface RecordNodeData extends Record<string, unknown> {
  node: GraphNode;
  role?: PersonRole;
  objectKind?: ObjectKind;
  readOnly?: boolean;
}

export type RecordFlowNode = Node<RecordNodeData, 'record'>;

const ROLE_COLOURS: Record<PersonRole, string> = {
  victim: 'border-blue-400 text-blue-300',
  suspect: 'border-red-400 text-red-300',
  witness: 'border-emerald-400 text-emerald-300',
  other: 'border-slate-400 text-slate-300'
};

const TYPE_COLOURS = {
  object: 'border-cyan-400 text-cyan-300',
  location: 'border-pink-400 text-pink-300',
  evidence: 'border-amber-400 text-amber-300'
};

/** A person, vehicle or object, location or evidence item on the canvas. */
export const RecordNode = memo(({ data, selected }: NodeProps<RecordFlowNode>) => {
  const { node, role, objectKind, readOnly } = data;
  const colour = node.type === 'person' ? ROLE_COLOURS[role ?? 'other'] : TYPE_COLOURS[node.type];
  const Icon =
    node.type === 'person'
      ? User
      : node.type === 'location'
      ? MapPin
      : node.type === 'evidence'
      ? FileText
      : objectKind === 'vehicle'
      ? Car
      : objectKind === 'phone'
      ? Phone
      : Package;
  const pending = node.review_status === 'pending';
  const rejected = node.review_status === 'rejected';

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={`rounded-xl bg-slate-950 border-2 px-3 py-2 flex items-center gap-2.5 font-mono shadow-lg ${colour} ${
        pending ? 'border-dashed' : ''
      } ${rejected ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-cyan-400/70' : ''}`}
      data-testid={`node-${node.id}`}
      title={pending ? 'AI proposal, not yet confirmed' : undefined}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500 !w-2 !h-2" isConnectable={!readOnly} />
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-100 truncate">{node.label}</div>
        <div className="text-[10px] text-slate-400 truncate">
          {pending ? 'AI proposal · ' : ''}
          {node.sublabel}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-cyan-400 !w-2.5 !h-2.5" isConnectable={!readOnly} />
    </div>
  );
});
RecordNode.displayName = 'RecordNode';
