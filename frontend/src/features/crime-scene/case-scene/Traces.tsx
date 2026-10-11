import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Vec3 } from '@/types/api';
import { CatalogueModel } from './Props';
import { EvidenceRef, StaticItem, TraceKind } from './sceneFile';
import { shoeTexture, skidTexture, stainTexture, tentTexture } from './textures';

// Physical evidence recorded at the scene, drawn where the script puts it: skid marks,
// debris and glass, blood, the point of impact, a fire's origin and burn area, forced
// entry and footprints. Each carries a numbered yellow evidence tent, as scene
// examiners place them, and a label that lists the evidence behind it.

type Trace = Extract<StaticItem, { kind: 'trace' }>;
type Skid = Extract<StaticItem, { kind: 'skid-marks' }>;

export const Traces: React.FC<{
  items: StaticItem[];
  showLabels: boolean;
  renderEvidence: (refs: EvidenceRef[], label: string) => React.ReactNode;
}> = ({ items, showLabels, renderEvidence }) => {
  const numbered = items.filter((i): i is Trace | Skid => i.kind === 'trace' || i.kind === 'skid-marks');
  return (
    <group name="traces">
      {numbered.map((item, i) => {
        const n = String(i + 1);
        const anchor: Vec3 = item.kind === 'skid-marks' ? item.from : item.position;
        const label = item.label ?? '';
        return (
          <group key={i}>
            {item.kind === 'skid-marks' ? <SkidMarks from={item.from} to={item.to} track={item.track} /> : <TraceMark item={item} seed={i + 1} />}
            <EvidenceTent at={tentSpot(item)} number={n} />
            {showLabels && (
              <Html position={[anchor[0], anchor[1] + 0.9, anchor[2]]} center zIndexRange={[16, 0]} style={{ pointerEvents: 'none' }}>
                <div className="flex items-center gap-1.5 whitespace-nowrap rounded bg-canvas/85 px-1.5 py-0.5 text-2xs text-ink shadow ring-1 ring-warn/50 backdrop-blur-sm">
                  <span className="rounded-sm bg-warn px-1 font-mono font-semibold text-[#1a1408]">{n}</span>
                  <span>{label}</span>
                  {item.evidence && item.evidence.length > 0 && renderEvidence(item.evidence, label)}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

/** Where to stand the tent: beside the trace, not on it. */
function tentSpot(item: Trace | Skid): Vec3 {
  if (item.kind === 'skid-marks') return [item.from[0], item.from[1], item.from[2]];
  const r = item.radius ?? 0;
  return [item.position[0] + Math.min(r, 3) * 0.7 + 0.35, item.position[1], item.position[2] + 0.25];
}

/** A yellow A-frame evidence marker with its number on both faces. */
const EvidenceTent: React.FC<{ at: Vec3; number: string }> = ({ at, number }) => {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: tentTexture(number), roughness: 0.45, side: THREE.DoubleSide }), [number]);
  const lean = 0.36;
  return (
    <group position={at} rotation-y={-0.5} name={`evidence marker ${number}`}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.085, (s * 0.085 * Math.sin(lean)) / 1]} rotation-x={s * lean} material={material} castShadow>
          <planeGeometry args={[0.13, 0.18]} />
        </mesh>
      ))}
    </group>
  );
};

const decal = (map: THREE.Texture, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.6, ...opts });

const Decal: React.FC<{ at: Vec3; size: number; material: THREE.Material; rotation?: number; y?: number }> = ({ at, size, material, rotation = 0, y = 0.008 }) => (
  <mesh position={[at[0], at[1] + y, at[2]]} rotation={[-Math.PI / 2, 0, rotation]} material={material} receiveShadow>
    <planeGeometry args={[size, size]} />
  </mesh>
);

const PAINT = new THREE.MeshStandardMaterial({ color: '#f3d23a', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 });

const TraceMark: React.FC<{ item: Trace; seed: number }> = ({ item, seed }) => {
  const kind: TraceKind = item.trace;
  const r = item.radius || 0;
  const mats = useMemo(
    () => ({
      blood: decal(stainTexture('blood', seed), { roughness: 0.25, color: '#ffffff' }),
      scorch: decal(stainTexture('scorch', seed), { roughness: 0.95 }),
      soot: decal(stainTexture('soot', seed), { roughness: 0.95 }),
      shoe: decal(shoeTexture(), { roughness: 0.9 })
    }),
    [seed]
  );
  if (kind === 'impact_point') return <ImpactMark at={item.position} />;
  if (kind === 'blood') return <Decal at={item.position} size={Math.max(r, 0.5) * 2} material={mats.blood} rotation={seed} />;
  if (kind === 'fire_origin') return <Decal at={item.position} size={2.2} material={mats.scorch} rotation={seed} y={0.012} />;
  if (kind === 'burn_area') return <Decal at={item.position} size={Math.max(r, 1) * 2} material={mats.soot} rotation={seed * 2} y={0.006} />;
  if (kind === 'debris' || kind === 'glass') {
    const spread = Math.max(r, 0.8) * 2;
    return (
      <group position={item.position}>
        <CatalogueModel spec={{ kind: 'item', name: 'Debris', size: [spread, spread * 0.8, 0.05], shape: 'debris' }} seed={seed} />
      </group>
    );
  }
  if (kind === 'footprints' && item.to) return <Footprints from={item.position} to={item.to} material={mats.shoe} />;
  // Forced entry and plain evidence markers are just the tent.
  return null;
};

/** A spray-painted ring and cross, as officers mark a point of impact. */
const ImpactMark: React.FC<{ at: Vec3 }> = ({ at }) => {
  const geometry = useMemo(() => {
    const ring = new THREE.RingGeometry(0.55, 0.62, 48);
    const bar = (a: number) => new THREE.PlaneGeometry(0.9, 0.07).rotateZ(a);
    const g = mergeGeometries([ring, bar(Math.PI / 4), bar(-Math.PI / 4)].map((p) => p.toNonIndexed()));
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return <mesh geometry={geometry} material={PAINT} position={[at[0], at[1] + 0.009, at[2]]} receiveShadow name="point of impact" />;
};

const Footprints: React.FC<{ from: Vec3; to: Vec3; material: THREE.Material }> = ({ from, to, material }) => {
  const steps = useMemo(() => {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dz);
    const n = Math.max(2, Math.floor(len / 0.7));
    const angle = Math.atan2(-dz, dx);
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const side = i % 2 === 0 ? 1 : -1;
      return {
        at: [from[0] + dx * t + Math.sin(angle) * 0.1 * side, from[1], from[2] + dz * t + Math.cos(angle) * 0.1 * side] as Vec3,
        rotation: angle - Math.PI / 2
      };
    });
  }, [from, to]);
  return (
    <group name="footprints">
      {steps.map((s, i) => (
        <mesh key={i} position={[s.at[0], s.at[1] + 0.007, s.at[2]]} rotation={[-Math.PI / 2, 0, s.rotation]} material={material}>
          <planeGeometry args={[0.12, 0.28]} />
        </mesh>
      ))}
    </group>
  );
};

/** A pair of tyre marks from where braking began to where the vehicle stopped skidding. */
export const SkidMarks: React.FC<{ from: number[]; to: number[]; track: number }> = ({ from, to, track }) => {
  const { geometry, material } = useMemo(() => {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(-dz, dx);
    const strips = [-1, 1].map((s) => {
      const g = new THREE.PlaneGeometry(len, 0.2);
      g.rotateX(-Math.PI / 2);
      g.translate(len / 2, 0.006, (s * track) / 2);
      return g;
    });
    const g = mergeGeometries(strips);
    g.rotateY(angle);
    g.translate(from[0], 0, from[2]);
    const m = new THREE.MeshStandardMaterial({ map: skidTexture(), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
    return { geometry: g, material: m };
  }, [from, to, track]);
  return <mesh geometry={geometry} material={material} receiveShadow name="skid-marks" />;
};

