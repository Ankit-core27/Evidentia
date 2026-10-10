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

/**
 * The icon's colour says what kind of record a node is; the border says its review state
 * (dashed for an AI proposal), the same as everywhere else in the app. Suspects are the
 * one role marked out.
 */
const ENTITY_COLOUR = {
  person: 'text-entity-person',
  object: 'text-entity-object',
  location: 'text-entity-location',
  evidence: 'text-entity-evidence'
};

/** A person, vehicle or object, location or evidence item on the canvas. */
export const RecordNode = memo(({ data, selected }: NodeProps<RecordFlowNode>) => {
  const { node, role, objectKind, readOnly } = data;
  const colour = node.type === 'person' && role === 'suspect' ? 'text-danger' : ENTITY_COLOUR[node.type];
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
      className={`rounded-md bg-surface border px-2.5 flex items-center gap-2.5 ${
        selected ? 'border-accent ring-1 ring-accent' : pending ? 'border-dashed border-pending/70' : 'border-line-strong'
      } ${rejected ? 'opacity-40' : ''}`}
      data-testid={`node-${node.id}`}
      title={pending ? 'AI proposal, not yet confirmed' : undefined}
    >
      <Handle type="target" position={Position.Left} className="!bg-ink-faint !border-surface !w-2 !h-2" isConnectable={!readOnly} />
      <Icon className={`size-4 shrink-0 ${colour}`} aria-hidden />
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink truncate">{node.label}</div>
        <div className={`text-2xs truncate ${pending ? 'text-pending' : 'text-ink-muted'}`}>
          {pending ? 'AI proposal · ' : ''}
          {node.sublabel}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-accent !border-surface !w-2.5 !h-2.5" isConnectable={!readOnly} />
    </div>
  );
});
RecordNode.displayName = 'RecordNode';
