import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Html, Line, useGLTF } from '@react-three/drei';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { between, usePlaybackStore } from '@/features/reconstruction/playback';
import { CaseObject, ReconstructionDetail, SceneObject, Vec3 } from '@/types/api';
import { Person, RIDER } from './Person';
import { CatalogueModel, ModelBoundary } from './Props';
import { ModelSpec, SceneFile, baseModel, groundHeight, modelSpec, modelVariant } from './sceneFile';
import { plateTexture } from './textures';
import { useViewerStore } from './viewerStore';

interface WheelNode {
  node: THREE.Object3D;
  sign: number;
}

// The stage's scene objects: vehicles, people (as posed mannequins, riders on their
// bicycles) and items, moving smoothly between stages. While the time slider sits
// between two stages, each object is placed between its two placements.

const MOVE_MS = 900;
// Sizes of the authored files' models, which name a URL but not a size.
const FOOTPRINTS: Record<string, [number, number, number]> = {
  hatchback: [3.85, 1.74, 1.53],
  'delivery-van': [3.8, 1.58, 2.12]
};
const DEFAULT_FOOTPRINT: [number, number, number] = [4, 2, 1.6];

/** The catalogue entry for a scene object, sized from the authored footprints if need be. */
function specFor(scene: SceneFile | undefined, modelId: string): ModelSpec {
  const spec = modelSpec(scene, modelId);
  const id = baseModel(modelId);
  if (spec && typeof scene?.models[id] !== 'string') return spec;
  return { kind: 'vehicle', name: id, url: spec?.url, restyle: true, size: FOOTPRINTS[id] ?? DEFAULT_FOOTPRINT };
}

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

/** Paint for a colour as case records name it ("White", "dark grey") or a hex value. */
function paintColour(name: string | undefined) {
  const key = name?.toLowerCase().trim();
  if (!key) return undefined;
  if (PAINT[key]) return PAINT[key];
  if (/^#[0-9a-f]{6}$/.test(key)) return key;
  const word = Object.keys(PAINT).find((k) => key.includes(k));
  return word ? PAINT[word] : undefined;
}

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

export const SceneObjects: React.FC<{
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
  const position = usePlaybackStore((s) => s.position);
  // The two stages the time slider is between, if it is between this stage and a neighbour.
  const tween = useMemo(() => {
    const count = orderedStages.length;
    if (count < 2) return null;
    const near = Math.round(Math.min(Math.max(position, 0), count - 1));
    if (orderedStages[near]?.id !== stageId) return null;
    const { from, to, progress } = between(position, count);
    if (progress <= 0.001 || progress >= 0.999) return null;
    const index = (st: (typeof orderedStages)[number]) => new Map(st.scene_objects.map((o) => [objectKey(o), o]));
    return { from: index(orderedStages[from]), to: index(orderedStages[to]), progress };
  }, [orderedStages, position, stageId]);
  if (!stage) return null;
  return (
    <group name="scene objects">
      {stage.scene_objects.map((o, i) => {
        const record = o.object_id != null ? objects.find((r) => r.id === o.object_id) : undefined;
        const a = tween?.from.get(objectKey(o));
        const b = tween?.to.get(objectKey(o));
        const pose = tween && a && b ? interpolate(a, b, tween.progress) : undefined;
        return (
          <Actor
            key={objectKey(o)}
            pose={pose}
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

/** A placement part of the way from a to b, turning the short way round. */
function interpolate(a: SceneObject, b: SceneObject, k: number): Pick<SceneObject, 'position' | 'rotation'> {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const heading = shortest(a.rotation[1], b.rotation[1]);
  return {
    position: [lerp(a.position[0], b.position[0]), lerp(a.position[1], b.position[1]), lerp(a.position[2], b.position[2])],
    rotation: [a.rotation[0], lerp(a.rotation[1], heading), a.rotation[2]]
  };
}

const Actor: React.FC<{
  object: SceneObject;
  /** A placement between stages from the time slider; it is followed without easing. */
  pose?: Pick<SceneObject, 'position' | 'rotation'>;
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
}> = ({ object, pose, labelLift, record, scene, selected, hovered, night, showLabel, badge, handlers }) => {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const spec = specFor(scene, object.model_id);
  const variant = modelVariant(object.model_id);
  const lying = variant === 'lying' || variant === 'fallen';
  const footprint = spec.size;
  const [length, width, height] = [footprint[0] * object.scale[0], footprint[1] * object.scale[2], (lying ? 0.4 : footprint[2]) * object.scale[1]];
  const appearance = scene?.appearance?.[object.label];
  const colour = record?.details.colour ?? appearance?.colour;
  const plate = record?.details.plate ?? appearance?.plate;
  const placed = pose ?? object;
  const [px, py, pz] = placed.position;
  const heading = placed.rotation[1];
  const following = !!pose;
  const target: Pose = useMemo(
    () => ({ x: px, y: Math.max(py, groundHeight(scene, px, pz)), z: pz, heading }),
    [px, py, pz, heading, scene]
  );
  // Animate from wherever the vehicle is now to the stage's placement, or follow the
  // time slider at once.
  const anim = useRef<{ from: Pose; to: Pose; start: number; duration: number } | null>(null);
  const current = useRef<Pose>(target);
  useEffect(() => {
    const from = { ...current.current };
    anim.current = {
      from,
      to: { ...target, heading: shortest(from.heading, target.heading) },
      start: performance.now(),
      duration: following ? 0 : MOVE_MS
    };
    invalidate();
  }, [target, following, invalidate]);
  const wheels = useRef<WheelNode[]>([]);
  const wheelRadius = useRef(0.3);
  const tool = useViewerStore((s) => s.tool);

  useFrame(() => {
    const a = anim.current;
    const g = group.current;
    if (!g) return;
    if (a) {
      const t = a.duration > 0 ? Math.min((performance.now() - a.start) / a.duration, 1) : 1;
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
      <Body spec={spec} object={object} variant={variant} colour={colour} plate={plate} night={night} wheels={wheels} wheelRadius={wheelRadius} />
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
            {plate && <span className="font-mono text-2xs opacity-80">{plate}</span>}
            {badge}
          </div>
        </Html>
      )}
    </group>
  );
};

/** What a scene object looks like: a restyled vehicle, a rider on a bicycle, a posed person or an item. */
const Body: React.FC<{
  spec: ModelSpec;
  object: SceneObject;
  variant: string;
  colour?: string;
  plate?: string;
  night: boolean;
  wheels: React.MutableRefObject<WheelNode[]>;
  wheelRadius: React.MutableRefObject<number>;
}> = ({ spec, object, variant, colour, plate, night, wheels, wheelRadius }) => {
  const id = baseModel(object.model_id);
  if (spec.kind === 'person') return <Person pose={variant || 'standing'} url={spec.url} />;
  const fallback = <CatalogueModel spec={{ ...spec, url: undefined }} />;
  const vehicle =
    spec.kind === 'vehicle' && spec.url ? (
      <ModelBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <Model url={spec.url} size={spec.size} restyle={!!spec.restyle} object={object} colour={colour} plate={plate} night={night} wheels={wheels} wheelRadius={wheelRadius} />
        </Suspense>
      </ModelBoundary>
    ) : (
      <CatalogueModel spec={spec} seed={object.id} />
    );
  const rider = RIDER[id];
  if (rider && variant === 'fallen') {
    // The machine on its side, and its rider on the ground beside it.
    return (
      <group>
        <group rotation-x={Math.PI / 2 - 0.12} position-y={spec.size[1] / 2}>
          {vehicle}
        </group>
        <group position={[0.6, 0, -1.1]} rotation-y={0.6}>
          <Person pose="lying" />
        </group>
      </group>
    );
  }
  if (rider && variant === 'ridden') {
    return (
      <group>
        {vehicle}
        <group position={rider.offset}>
          <Person pose={rider.pose} />
        </group>
      </group>
    );
  }
  return vehicle;
};

const Model: React.FC<{
  url: string;
  size: [number, number, number];
  restyle: boolean;
  object: SceneObject;
  colour?: string;
  plate?: string;
  night: boolean;
  wheels: React.MutableRefObject<WheelNode[]>;
  wheelRadius: React.MutableRefObject<number>;
}> = ({ url, size, restyle, object, colour, plate, night, wheels, wheelRadius }) => {
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
        if (own.name === 'paint' && restyle) {
          const paint = paintColour(colour);
          if (paint) own.color.set(paint);
        }
        if (own.name.startsWith('plate') && restyle) {
          const background = `#${own.color.getHexString()}`;
          if (plate) {
            own.map = plateTexture(plate, background);
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
  }, [gltf, colour, plate, restyle, wheels, wheelRadius]);

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
  // Files are built to their catalogue size; scale any that aren't.
  const native = box.getSize(new THREE.Vector3());
  const fit: [number, number, number] =
    native.x > 0 && Math.abs(native.x / size[0] - 1) > 0.05 ? [size[0] / native.x, size[2] / native.y, size[1] / native.z] : [1, 1, 1];
  // A bicycle's front reflector glows but throws no beam.
  const hasLamps = lamps.some((m) => m.name === 'headlight') && !object.model_id.startsWith('bicycle');
  return (
    <group name={`${object.model_id} model`} scale={fit}>
      <primitive object={root} />
      {night && hasLamps && (
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
