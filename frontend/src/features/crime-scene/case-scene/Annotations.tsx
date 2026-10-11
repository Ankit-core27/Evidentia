import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SceneAnnotation, Vec3 } from '@/types/api';
import { flyTo, useViewerStore } from './viewerStore';

// Measurements, notes and saved camera viewpoints, as the seed and the 2D plan store them:
//   measurement {label, from, to, length_m}, viewpoint {label, position, target}, note {text, position?}

export const asVec3 = (value: unknown): Vec3 | null =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number') ? (value as Vec3) : null;

export const visibleOn = (a: SceneAnnotation, stageId: number) => a.stage_id === null || a.stage_id === stageId;

const WARN = '#e2b155';
const INFO = '#8eaef0';

export const Annotations: React.FC<{ annotations: SceneAnnotation[]; stageId: number; showLabels: boolean }> = ({ annotations, stageId, showLabels }) => (
  <group name="annotations">
    {annotations.filter((a) => visibleOn(a, stageId)).map((a) => {
      if (a.kind === 'measurement') return <Measurement key={a.id} annotation={a} showLabel={showLabels} />;
      if (a.kind === 'viewpoint') return <Viewpoint key={a.id} annotation={a} showLabel={showLabels} />;
      if (a.kind === 'note' && asVec3(a.data.position)) return <NotePin key={a.id} annotation={a} showLabel={showLabels} />;
      return null;
    })}
  </group>
);

const Pin: React.FC<{ at: Vec3; colour: string; height?: number }> = ({ at, colour, height = 0.45 }) => (
  <group position={at}>
    <mesh position-y={height / 2}>
      <cylinderGeometry args={[0.018, 0.018, height, 8]} />
      <meshBasicMaterial color={colour} toneMapped={false} />
    </mesh>
    <mesh position-y={height}>
      <sphereGeometry args={[0.07, 16, 12]} />
      <meshBasicMaterial color={colour} toneMapped={false} />
    </mesh>
  </group>
);

export const Measurement: React.FC<{ annotation?: SceneAnnotation; from?: Vec3; to?: Vec3; label?: string; showLabel: boolean; preview?: boolean }> = ({
  annotation,
  from: fromProp,
  to: toProp,
  label: labelProp,
  showLabel,
  preview
}) => {
  const from = fromProp ?? asVec3(annotation?.data.from);
  const to = toProp ?? asVec3(annotation?.data.to);
  if (!from || !to) return null;
  const length = typeof annotation?.data.length_m === 'number' ? annotation.data.length_m : Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const label = labelProp ?? (typeof annotation?.data.label === 'string' ? annotation.data.label : '');
  const lift = (p: Vec3): Vec3 => [p[0], p[1] + 0.06, p[2]];
  const mid: Vec3 = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 0.75, (from[2] + to[2]) / 2];
  return (
    <group name={`measurement ${label}`}>
      <Line points={[lift(from), lift(to)]} color={WARN} lineWidth={3} dashed={preview} dashSize={0.3} gapSize={0.2} depthTest={false} renderOrder={5} />
      <Pin at={from} colour={WARN} />
      <Pin at={to} colour={WARN} />
      {showLabel && (
        <Html position={mid} center zIndexRange={[18, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded bg-canvas/90 px-2 py-0.5 text-xs text-warn ring-1 ring-warn/50 shadow">
            {label && <span className="mr-1.5">{label}</span>}
            <span className="font-mono">{length.toFixed(2)} m</span>
          </div>
        </Html>
      )}
    </group>
  );
};

const Viewpoint: React.FC<{ annotation: SceneAnnotation; showLabel: boolean }> = ({ annotation, showLabel }) => {
  const position = asVec3(annotation.data.position);
  const target = asVec3(annotation.data.target);
  const controls = useViewerStore((s) => s.controls);
  const quaternion = useMemo(() => {
    if (!position || !target) return new THREE.Quaternion();
    const dir = new THREE.Vector3(target[0] - position[0], target[1] - position[1], target[2] - position[2]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  }, [position, target]);
  if (!position || !target) return null;
  const label = typeof annotation.data.label === 'string' ? annotation.data.label : 'Viewpoint';
  return (
    <group name={`viewpoint ${label}`}>
      <group position={position} quaternion={quaternion}>
        <mesh position-z={-0.18} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.16, 0.36, 4, 1, true]} />
          <meshBasicMaterial color={INFO} wireframe toneMapped={false} />
        </mesh>
        <mesh position-z={0.06}>
          <boxGeometry args={[0.18, 0.14, 0.16]} />
          <meshBasicMaterial color={INFO} toneMapped={false} />
        </mesh>
      </group>
      <Line points={[position, target]} color={INFO} lineWidth={1} dashed dashSize={0.4} gapSize={0.3} transparent opacity={0.6} />
      {showLabel && (
        <Html position={[position[0], position[1] + 0.45, position[2]]} center zIndexRange={[18, 0]}>
          <button
            type="button"
            onClick={() => flyTo(controls, position, target)}
            className="whitespace-nowrap rounded bg-canvas/90 px-2 py-0.5 text-xs text-info ring-1 ring-info/50 shadow hover:bg-raised"
            title="Look from here"
          >
            {label}
          </button>
        </Html>
      )}
    </group>
  );
};

const NotePin: React.FC<{ annotation: SceneAnnotation; showLabel: boolean }> = ({ annotation, showLabel }) => {
  const position = asVec3(annotation.data.position);
  if (!position) return null;
  const text = typeof annotation.data.text === 'string' ? annotation.data.text : '';
  return (
    <group name="note">
      <Pin at={position} colour="#5ec4cf" height={1.1} />
      {showLabel && (
        <Html position={[position[0], position[1] + 1.45, position[2]]} center zIndexRange={[18, 0]} style={{ pointerEvents: 'none' }}>
          <div className="max-w-56 rounded bg-canvas/90 px-2 py-1 text-xs text-ink ring-1 ring-accent/50 shadow">{text}</div>
        </Html>
      )}
    </group>
  );
};
