import React, { Suspense, useMemo } from 'react';
import { RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ModelSpec } from './sceneFile';

// Catalogue models from their files, fitted to the catalogue size (or the size an item
// asks for), and the few small items drawn in code. Every model faces +x with its
// origin on the ground at the centre of its footprint.

/** A seeded random sequence, so the same scene always looks the same. */
export function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export class ModelBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A catalogue model: its file when it has one, otherwise (or while loading) its shape. */
export const CatalogueModel: React.FC<{ spec: ModelSpec; size?: [number, number, number]; seed?: number }> = ({ spec, size, seed = 1 }) => {
  const target = size ?? spec.size;
  const shape = <Shape name={spec.shape ?? 'box'} size={target} seed={seed} />;
  const body = spec.url ? (
    <ModelBoundary fallback={shape}>
      <Suspense fallback={null}>
        <FittedFile url={spec.url} size={target} fill={spec.fill} seed={seed} />
      </Suspense>
    </ModelBoundary>
  ) : (
    shape
  );
  return (
    <group position-y={spec.elevation ?? 0}>
      {body}
      {spec.shape === 'bed' && spec.url && <Bedding size={target} />}
      {spec.fill === 'tile' && spec.shape === 'shelf' && spec.url && (
        <Suspense fallback={null}>
          <ShelfStock size={target} seed={seed} />
        </Suspense>
      )}
    </group>
  );
};

const CARTON_URL = '/3d/crime-scenes/library/props/cardboard-box.glb';
// Shelf heights of the steel shelving unit, from the floor, in metres.
const SHELVES = [0.06, 0.57, 1.08, 1.6];

/** Cartons on a run of shelving, some shelves fuller than others. */
const ShelfStock: React.FC<{ size: [number, number, number]; seed: number }> = ({ size, seed }) => {
  const gltf = useGLTF(CARTON_URL);
  const [depth, width, height] = size;
  const items = useMemo(() => {
    const base = prepare(gltf.scene);
    const n = base.native;
    // Cartons scaled to fit a shelf: about 0.42 m deep and no taller than the gap above.
    const k = Math.min((depth * 0.85) / n.x, 0.36 / n.y);
    const along = n.z * k + 0.04;
    const rnd = mulberry(seed * 17 + 3);
    const out = [];
    for (const y of SHELVES.map((v) => (v * height) / 2.142)) {
      for (let z = -width / 2 + along / 2; z <= width / 2 - along / 2; z += along) {
        if (rnd() < 0.22) continue;
        out.push({ fit: prepare(gltf.scene), position: [(rnd() - 0.5) * 0.04, y, z] as [number, number, number], rotation: (rnd() - 0.5) * 0.12, k });
      }
    }
    return out;
  }, [gltf, depth, width, height, seed]);
  return (
    <group name="stock">
      {items.map((c, i) => (
        <group key={i} position={c.position} rotation-y={c.rotation} scale={c.k}>
          <primitive object={c.fit.root} position={c.fit.offset} />
        </group>
      ))}
    </group>
  );
};

const FABRIC = {
  mattress: new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.95 }),
  sheet: new THREE.MeshStandardMaterial({ color: '#6f8196', roughness: 1 }),
  pillow: new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.95 })
};

/** A mattress, blanket and pillow on the bed frame (the frame's model is bare springs). */
const Bedding: React.FC<{ size: [number, number, number] }> = ({ size }) => {
  const [l, w] = size;
  const top = 0.47;
  return (
    <group name="bedding">
      <RoundedBox args={[l - 0.12, 0.16, w - 0.06]} radius={0.05} smoothness={3} position={[0.02, top + 0.08, 0]} material={FABRIC.mattress} castShadow receiveShadow />
      <RoundedBox args={[(l - 0.12) * 0.68, 0.035, w - 0.02]} radius={0.015} smoothness={2} position={[l * 0.17, top + 0.17, 0]} material={FABRIC.sheet} castShadow receiveShadow />
      <RoundedBox args={[0.42, 0.11, w * 0.7]} radius={0.05} smoothness={3} position={[-l / 2 + 0.32, top + 0.21, 0]} material={FABRIC.pillow} castShadow receiveShadow />
    </group>
  );
};

interface Fit {
  root: THREE.Object3D;
  /** The file's own size along x, z and y. */
  native: THREE.Vector3;
  /** Offset that puts the footprint centre at the origin and the base on the ground. */
  offset: THREE.Vector3;
}

function prepare(scene: THREE.Object3D): Fit {
  const root = scene.clone(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const native = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  return { root, native, offset: new THREE.Vector3(-centre.x, -box.min.y, -centre.z) };
}

const FittedFile: React.FC<{ url: string; size: [number, number, number]; fill?: 'tile' | 'stack'; seed: number }> = ({ url, size, fill, seed }) => {
  const gltf = useGLTF(url);
  const [length, width, height] = size;
  const copies = useMemo(() => {
    const base = prepare(gltf.scene);
    const n = base.native;
    if (fill === 'tile') {
      // A run of units side by side along z, each scaled to the run's depth and height.
      const count = Math.max(1, Math.round(width / n.z));
      const each = width / count;
      return Array.from({ length: count }, (_, i) => ({
        fit: i === 0 ? base : prepare(gltf.scene),
        position: [0, 0, -width / 2 + each * (i + 0.5)] as [number, number, number],
        scale: [length / n.x, height / n.y, each / n.z] as [number, number, number],
        rotation: 0
      }));
    }
    if (fill === 'stack') {
      // Cartons in rows and layers, a little out of true, as stock is stacked by hand.
      const rnd = mulberry(seed * 31 + 7);
      const nx = Math.max(1, Math.floor(length / n.x));
      const nz = Math.max(1, Math.floor(width / n.z));
      const ny = Math.max(1, Math.floor((height - 0.14) / n.y));
      const out = [];
      for (let iy = 0; iy < ny; iy += 1) {
        for (let ix = 0; ix < nx; ix += 1) {
          for (let iz = 0; iz < nz; iz += 1) {
            if (iy === ny - 1 && rnd() < 0.3) continue;
            out.push({
              fit: prepare(gltf.scene),
              position: [
                -length / 2 + (length / nx) * (ix + 0.5) + (rnd() - 0.5) * 0.04,
                0.14 + n.y * iy,
                -width / 2 + (width / nz) * (iz + 0.5) + (rnd() - 0.5) * 0.04
              ] as [number, number, number],
              scale: [1, 1, 1] as [number, number, number],
              rotation: (rnd() - 0.5) * 0.08
            });
          }
        }
      }
      return out;
    }
    return [{ fit: base, position: [0, 0, 0] as [number, number, number], scale: [length / n.x, height / n.y, width / n.z] as [number, number, number], rotation: 0 }];
  }, [gltf, fill, length, width, height, seed]);
  return (
    <group>
      {fill === 'stack' && <Pallet length={length} width={width} />}
      {copies.map((c, i) => (
        <group key={i} position={c.position} rotation-y={c.rotation} scale={c.scale}>
          <primitive object={c.fit.root} position={c.fit.offset} />
        </group>
      ))}
    </group>
  );
};

const WOOD = new THREE.MeshStandardMaterial({ color: '#a27b52', roughness: 0.85 });
const slats = (length: number) => {
  const n = Math.max(3, Math.round(length / 0.16));
  return Array.from({ length: n }, (_, i) => -length / 2 + (length / n) * (i + 0.5));
};

/** A softwood pallet under stacked stock. */
const Pallet: React.FC<{ length: number; width: number }> = ({ length, width }) => (
  <group name="pallet">
    {[-1, 0, 1].map((k) => (
      <mesh key={`b${k}`} position={[0, 0.045, (k * (width - 0.1)) / 2]} material={WOOD} castShadow receiveShadow>
        <boxGeometry args={[length, 0.09, 0.1]} />
      </mesh>
    ))}
    {slats(length).map((x, i) => (
      <mesh key={`t${i}`} position={[x, 0.115, 0]} material={WOOD} castShadow receiveShadow>
        <boxGeometry args={[(length / slats(length).length) * 0.75, 0.05, width]} />
      </mesh>
    ))}
  </group>
);

// ---------------------------------------------------------------------------
// Shapes drawn in code: small items without a file, and stand-ins if a file fails.

const MATS = {
  phoneBody: new THREE.MeshPhysicalMaterial({ color: '#1b1d20', metalness: 0.6, roughness: 0.3, clearcoat: 1 }),
  screen: new THREE.MeshPhysicalMaterial({ color: '#05070a', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
  bottleGlass: new THREE.MeshPhysicalMaterial({ color: '#2f6b3a', roughness: 0.05, transmission: 0.6, thickness: 0.004, transparent: true, opacity: 0.85, ior: 1.5 }),
  cap: new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.8, roughness: 0.3 }),
  velvet: new THREE.MeshStandardMaterial({ color: '#5a1d2b', roughness: 0.95 }),
  brass: new THREE.MeshStandardMaterial({ color: '#b8913a', metalness: 0.9, roughness: 0.3 }),
  cone: new THREE.MeshStandardMaterial({ color: '#e8561c', roughness: 0.55 }),
  coneBand: new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.3, metalness: 0.2 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 }),
  shard: new THREE.MeshPhysicalMaterial({ color: '#cfe0e6', roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.45 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d9dcdf', metalness: 1, roughness: 0.15 }),
  neutral: new THREE.MeshStandardMaterial({ color: '#8d949a', roughness: 0.6 })
};

const Shape: React.FC<{ name: string; size: [number, number, number]; seed: number }> = ({ name, size, seed }) => {
  const [l, w, h] = size;
  if (name === 'phone')
    return (
      <group>
        <RoundedBox args={[l, h, w]} radius={Math.min(h, w) * 0.45} smoothness={4} position-y={h / 2} material={MATS.phoneBody} castShadow />
        <mesh position-y={h + 0.0005} rotation-x={-Math.PI / 2} material={MATS.screen}>
          <planeGeometry args={[l * 0.92, w * 0.86]} />
        </mesh>
      </group>
    );
  if (name === 'bottle') return <Bottle size={size} />;
  if (name === 'jewellery')
    return (
      <group>
        <RoundedBox args={[l, h * 0.62, w]} radius={0.01} smoothness={3} position-y={h * 0.31} material={MATS.velvet} castShadow />
        <RoundedBox args={[l, h * 0.38, w]} radius={0.012} smoothness={3} position-y={h * 0.81} material={MATS.velvet} castShadow />
        <mesh position={[l / 2 + 0.001, h * 0.62, 0]} rotation-y={Math.PI / 2} material={MATS.brass}>
          <planeGeometry args={[0.03, 0.02]} />
        </mesh>
      </group>
    );
  if (name === 'cone')
    return (
      <group>
        <mesh position-y={0.02} material={MATS.rubber} castShadow receiveShadow>
          <boxGeometry args={[l, 0.04, w]} />
        </mesh>
        <mesh position-y={0.04 + (h - 0.04) / 2} material={MATS.cone} castShadow>
          <cylinderGeometry args={[0.025, l * 0.36, h - 0.04, 32, 1, true]} />
        </mesh>
        <mesh position-y={h * 0.55} material={MATS.coneBand}>
          <cylinderGeometry args={[l * 0.17, l * 0.23, h * 0.16, 32, 1, true]} />
        </mesh>
      </group>
    );
  if (name === 'debris') return <Debris size={size} seed={seed} />;
  return (
    <RoundedBox args={[l, h, w]} radius={Math.min(l, w, h) * 0.08} smoothness={2} position-y={h / 2} material={MATS.neutral} castShadow receiveShadow />
  );
};

const Bottle: React.FC<{ size: [number, number, number] }> = ({ size }) => {
  const [, w, h] = size;
  const geometry = useMemo(() => {
    const r = w / 2;
    const pts = [
      [0, 0], [r * 0.9, 0], [r, 0.01], [r, h * 0.55], [r * 0.92, h * 0.64], [r * 0.45, h * 0.78], [r * 0.34, h * 0.86],
      [r * 0.34, h * 0.97], [0, h * 0.97]
    ].map(([x, y]) => new THREE.Vector2(x, y)); // prettier-ignore
    return new THREE.LatheGeometry(pts, 32);
  }, [w, h]);
  return (
    <group>
      <mesh geometry={geometry} material={MATS.bottleGlass} castShadow />
      <mesh position-y={h * 0.985} material={MATS.cap}>
        <cylinderGeometry args={[w * 0.19, w * 0.19, h * 0.03, 24]} />
      </mesh>
    </group>
  );
};

/** Fragments of a collision: plastic, chrome and glass, scattered over the area. */
const Debris: React.FC<{ size: [number, number, number]; seed: number }> = ({ size, seed }) => {
  const parts = useMemo(() => {
    const rnd = mulberry(seed * 13 + 5);
    const [l, w] = size;
    return Array.from({ length: 34 }, () => {
      const kind = rnd();
      return {
        material: kind < 0.45 ? MATS.shard : kind < 0.85 ? MATS.plastic : MATS.chrome,
        position: [(rnd() - 0.5) * l, 0.006, (rnd() - 0.5) * w] as [number, number, number],
        rotation: [(rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3] as [number, number, number],
        scale: [0.02 + rnd() * 0.09, 0.004 + rnd() * 0.01, 0.02 + rnd() * 0.06] as [number, number, number]
      };
    });
  }, [size, seed]);
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation} scale={p.scale} material={p.material} castShadow>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
    </group>
  );
};
