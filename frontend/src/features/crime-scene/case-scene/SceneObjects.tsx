import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Html, Line, useGLTF } from '@react-three/drei';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CaseObject, ReconstructionDetail, SceneObject, Vec3 } from '@/types/api';
import { SceneFile, groundHeight } from './sceneFile';
import { plateTexture } from './textures';
import { useViewerStore } from './viewerStore';

interface WheelNode {
  node: THREE.Object3D;
  sign: number;
}

// The stage's scene objects as vehicles (or labelled boxes for anything without a model),
// moving smoothly between stages.

const MOVE_MS = 900;
const FOOTPRINTS: Record<string, [number, number, number]> = {
  hatchback: [3.85, 1.74, 1.53],
  'delivery-van': [3.8, 1.58, 2.12]
};
const DEFAULT_FOOTPRINT: [number, number, number] = [4, 2, 1.6];

/** Paint for the colour names case records use. */
const PAINT: Record<string, string> = {
  white: '#f1f2ef',
  black: '#101113',
  silver: '#b8bcc0',
  grey: '#6d7277',
  gray: '#6d7277',
  'dark grey': '#3b3e43',
  'dark gray': '#3b3e43',
  red: '#a3151b',
  maroon: '#5a1218',
  blue: '#1f4f9a',
  'dark blue': '#16285a',
  green: '#1f5c38',
  yellow: '#e2b417',
  orange: '#d0631a',
  brown: '#5b3b24',
  beige: '#d8c7a4'
};

/** A key that follows the same object from stage to stage. */
export const objectKey = (o: SceneObject) => (o.object_id != null ? `object:${o.object_id}` : `label:${o.label}`);

interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const shortest = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};

export interface VehicleHandlers {
  hovered: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}

export const SceneVehicles: React.FC<{
  scene: SceneFile | undefined;
  reconstruction: ReconstructionDetail;
  stageId: number;
  selectedId: number | null;
  objects: CaseObject[];
  night: boolean;
  showLabels: boolean;
  showPaths: boolean;
  renderBadge?: (o: SceneObject) => React.ReactNode;
  handlers: VehicleHandlers;
}> = ({ scene, reconstruction, stageId, selectedId, objects, night, showLabels, showPaths, renderBadge, handlers }) => {
  const stage = reconstruction.stages.find((s) => s.id === stageId);
  const orderedStages = useMemo(() => [...reconstruction.stages].sort((a, b) => a.stage_order - b.stage_order), [reconstruction]);
  if (!stage) return null;
  return (
    <group name="scene objects">
      {stage.scene_objects.map((o, i) => {
        const record = o.object_id != null ? objects.find((r) => r.id === o.object_id) : undefined;
        return (
          <Vehicle
            key={objectKey(o)}
            labelLift={i * 1.8}
            object={o}
            record={record}
            scene={scene}
            selected={o.id === selectedId}
            hovered={o.id === handlers.hovered}
            night={night}
            showLabel={showLabels}
            badge={renderBadge?.(o)}
            handlers={handlers}
          />
        );
      })}
      {showPaths && <Paths scene={scene} stages={orderedStages} stageId={stageId} />}
    </group>
  );
};

const Vehicle: React.FC<{
  object: SceneObject;
  /** Staggers labels so vehicles side by side don't cover each other's. */
  labelLift: number;
  record: CaseObject | undefined;
  scene: SceneFile | undefined;
  selected: boolean;
  hovered: boolean;
  night: boolean;
  showLabel: boolean;
  badge: React.ReactNode;
  handlers: VehicleHandlers;
}> = ({ object, labelLift, record, scene, selected, hovered, night, showLabel, badge, handlers }) => {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const footprint = FOOTPRINTS[object.model_id] ?? DEFAULT_FOOTPRINT;
  const [length, width, height] = [footprint[0] * object.scale[0], footprint[1] * object.scale[2], footprint[2] * object.scale[1]];
  const target: Pose = useMemo(
    () => ({
      x: object.position[0],
      y: Math.max(object.position[1], groundHeight(scene, object.position[0], object.position[2])),
      z: object.position[2],
      heading: object.rotation[1]
    }),
    [object, scene]
  );
  // Animate from wherever the vehicle is now to the stage's placement.
  const anim = useRef<{ from: Pose; to: Pose; start: number; current: Pose; travelled: number } | null>(null);
  const current = useRef<Pose>(target);
  useEffect(() => {
    const from = { ...current.current };
    anim.current = { from, to: { ...target, heading: shortest(from.heading, target.heading) }, start: performance.now(), current: from, travelled: 0 };
    invalidate();
  }, [target, invalidate]);
  const wheels = useRef<WheelNode[]>([]);
  const wheelRadius = useRef(0.3);
  const tool = useViewerStore((s) => s.tool);

  useFrame(() => {
    const a = anim.current;
    const g = group.current;
    if (!g) return;
    if (a) {
      const t = Math.min((performance.now() - a.start) / MOVE_MS, 1);
      const k = ease(t);
      const next: Pose = {
        x: a.from.x + (a.to.x - a.from.x) * k,
        y: a.from.y + (a.to.y - a.from.y) * k,
        z: a.from.z + (a.to.z - a.from.z) * k,
        heading: a.from.heading + (a.to.heading - a.from.heading) * k
      };
      // Roll the wheels by the distance covered along the vehicle's heading.
      const dx = next.x - current.current.x;
      const dz = next.z - current.current.z;
      const along = dx * Math.cos(next.heading) - dz * Math.sin(next.heading);
      for (const w of wheels.current) w.node.rotateZ((-w.sign * along) / wheelRadius.current);
      current.current = next;
      if (t >= 1) anim.current = null;
      invalidate();
    }
    const p = current.current;
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(0, p.heading, 0);
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    // While a tool is active, clicks on a vehicle place points instead of selecting it.
    if (tool !== 'none') return;
    e.stopPropagation();
    handlers.onSelect(object.id);
  };
  const ringScale: Vec3 = [length / 2 + 0.55, 1, width / 2 + 0.55];
  return (
    <group
      ref={group}
      name={object.label}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        handlers.onHover(object.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        handlers.onHover(null);
        document.body.style.cursor = '';
      }}
    >
      <ModelOrBox object={object} record={record} scene={scene} size={[length, width, height]} night={night} wheels={wheels} wheelRadius={wheelRadius} />
      {(selected || hovered) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.03} scale={ringScale} renderOrder={2}>
          <ringGeometry args={[0.93, 1, 72]} />
          <meshBasicMaterial color={selected ? '#37aebd' : '#e7e9eb'} transparent opacity={selected ? 0.95 : 0.6} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {showLabel && (
        <Html position={[0, height + 0.55 + labelLift, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-xs shadow-md ring-1 backdrop-blur-sm ${
              selected ? 'bg-accent text-accent-fg ring-accent' : 'bg-canvas/85 text-ink ring-line-strong'
            }`}
          >
            <span className="font-medium">{object.label}</span>
            {record?.details.plate && <span className="font-mono text-2xs opacity-80">{record.details.plate}</span>}
            {badge}
          </div>
        </Html>
      )}
    </group>
  );
};

const ModelOrBox: React.FC<{
  object: SceneObject;
  record: CaseObject | undefined;
  scene: SceneFile | undefined;
  size: [number, number, number];
  night: boolean;
  wheels: React.MutableRefObject<WheelNode[]>;
  wheelRadius: React.MutableRefObject<number>;
}> = (props) => {
  const url = props.scene?.models[props.object.model_id];
  const fallback = <FallbackBox size={props.size} label={props.object.label} />;
  if (!url) return fallback;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model url={url} {...props} />
      </Suspense>
    </ModelBoundary>
  );
};

class ModelBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const FallbackBox: React.FC<{ size: [number, number, number]; label: string }> = ({ size }) => (
  <mesh position-y={size[2] / 2} castShadow receiveShadow>
    <boxGeometry args={[size[0], size[2], size[1]]} />
    <meshStandardMaterial color="#9aa3aa" roughness={0.6} />
  </mesh>
);

const Model: React.FC<{
  url: string;
  object: SceneObject;
  record: CaseObject | undefined;
  night: boolean;
  wheels: React.MutableRefObject<WheelNode[]>;
  wheelRadius: React.MutableRefObject<number>;
}> = ({ url, object, record, night, wheels, wheelRadius }) => {
  const gltf = useGLTF(url);
  const invalidate = useThree((s) => s.invalidate);
  // Each vehicle gets its own copy, with materials it can restyle.
  const { root, lamps } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const lamps: THREE.MeshStandardMaterial[] = [];
    const found: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (/^wheel_/.test(o.name) && !(o as THREE.Mesh).isMesh) found.push(o);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat?.name) return;
      if (mat.name === 'paint' || mat.name.startsWith('plate') || ['headlight', 'taillight', 'indicator'].includes(mat.name)) {
        const own = mat.clone();
        mesh.material = own;
        if (own.name === 'paint') {
          const colour = record?.details.colour?.toLowerCase().trim();
          if (colour && PAINT[colour]) own.color.set(PAINT[colour]);
        }
        if (own.name.startsWith('plate')) {
          const background = `#${own.color.getHexString()}`;
          if (record?.details.plate) {
            own.map = plateTexture(record.details.plate, background);
            own.color.set('#ffffff');
          }
        }
        if (['headlight', 'taillight', 'indicator'].includes(own.name)) lamps.push(own);
      }
    });
    // A wheel spins about its own z axis; mirrored wheels point that axis the other way.
    wheels.current = found.map((node) => ({ node, sign: Math.sign(new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion).z) || 1 }));
    if (found[0]) {
      const box = new THREE.Box3().setFromObject(found[0]);
      wheelRadius.current = Math.max((box.max.y - box.min.y) / 2, 0.1);
    }
    return { root, lamps };
  }, [gltf, record, wheels, wheelRadius]);

  useEffect(() => {
    for (const m of lamps) {
      if (m.name === 'headlight') m.emissiveIntensity = night ? 4 : 0;
      if (m.name === 'taillight') m.emissiveIntensity = night ? 1.6 : 0.05;
      if (m.name === 'indicator') m.emissiveIntensity = 0;
    }
    invalidate();
  }, [lamps, night, invalidate]);

  const beamTarget = useMemo(() => new THREE.Object3D(), []);
  const box = useMemo(() => new THREE.Box3().setFromObject(root), [root]);
  const front = box.max.x;
  return (
    <group name={`${object.model_id} model`}>
      <primitive object={root} />
      {night && (
        <>
          <primitive object={beamTarget} position={[front + 18, 0, 0]} />
          <spotLight position={[front - 0.1, 0.75, 0]} target={beamTarget} color="#fff4dc" intensity={90} distance={45} angle={0.42} penumbra={0.55} decay={1.4} />
        </>
      )}
    </group>
  );
};

/** Each object's route through the stages, with a dot at every stage. */
const Paths: React.FC<{ scene: SceneFile | undefined; stages: ReconstructionDetail['stages']; stageId: number }> = ({ scene, stages, stageId }) => {
  const routes = useMemo(() => {
    const byKey = new Map<string, { points: Vec3[]; active: number }>();
    stages.forEach((s) => {
      for (const o of s.scene_objects) {
        const key = objectKey(o);
        const r = byKey.get(key) ?? { points: [], active: -1 };
        const y = Math.max(o.position[1], groundHeight(scene, o.position[0], o.position[2])) + 0.05;
        r.points.push([o.position[0], y, o.position[2]]);
        if (s.id === stageId) r.active = r.points.length - 1;
        byKey.set(key, r);
      }
    });
    return [...byKey.values()].filter((r) => r.points.length > 1);
  }, [scene, stages, stageId]);
  return (
    <group name="paths">
      {routes.map((r, i) => (
        <group key={i}>
          <Line points={r.points} color="#37aebd" lineWidth={2.5} dashed dashSize={0.8} gapSize={0.5} transparent opacity={0.85} />
          {r.points.map((p, k) => (
            <mesh key={k} position={p} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[k === r.active ? 0.38 : 0.24, 24]} />
              <meshBasicMaterial color={k === r.active ? '#37aebd' : '#e7e9eb'} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
