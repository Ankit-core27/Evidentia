import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CatalogueModel } from './Props';
import { EvidenceRef, SceneFile, StaticItem, modelSpec } from './sceneFile';
import { plasterTexture, shutterTexture, signTexture } from './textures';

type Item<K extends StaticItem['kind']> = Extract<StaticItem, { kind: K }>;

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const cyl = (rTop: number, rBottom: number, h: number, x: number, y: number, z: number, seg = 12) => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
  g.translate(x, y, z);
  return g;
};
const merge = (parts: THREE.BufferGeometry[]) => {
  const clean = parts.map((g) => {
    const c = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(c.attributes)) if (key !== 'position' && key !== 'normal' && key !== 'uv') c.deleteAttribute(key);
    if (!c.getAttribute('uv')) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.getAttribute('position').count * 2), 2));
    return c;
  });
  return mergeGeometries(clean);
};

const MATERIALS = {
  galvanised: new THREE.MeshStandardMaterial({ color: '#8d9296', metalness: 0.6, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.6 }),
  yellow: new THREE.MeshStandardMaterial({ color: '#e4b623', roughness: 0.6 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#c9c4bb', roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: '#2a3238', metalness: 0.4, roughness: 0.12 }),
  frame: new THREE.MeshStandardMaterial({ color: '#e9e5dc', roughness: 0.7 }),
  tank: new THREE.MeshStandardMaterial({ color: '#1a1b1c', roughness: 0.55 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 0.95 }),
  canopy: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.85 })
};

// ---------------------------------------------------------------------------
// Traffic signals: a pole with a three-aspect head on a yellow-bordered backplate.
// The lenses are shown unlit, because the case records don't say what the signals showed.

const signalGeometry = (() => {
  const pole = merge([cyl(0.06, 0.07, 3.7, 0, 1.85, 0), cyl(0.12, 0.12, 0.3, 0, 0.15, 0)]);
  const head = merge([box(0.24, 0.98, 0.34, 0.2, 3.25, 0), box(0.06, 0.1, 0.1, 0.07, 3.25, 0)]);
  const backplate = box(0.02, 1.28, 0.62, 0.075, 3.25, 0);
  const border = box(0.016, 1.36, 0.7, 0.068, 3.25, 0);
  const visors = merge(
    [3.55, 3.25, 2.95].map((y) => {
      const v = new THREE.CylinderGeometry(0.13, 0.13, 0.2, 16, 1, true, 0, Math.PI);
      // Axis along x, covering the top half of the lens.
      v.rotateZ(Math.PI / 2);
      v.translate(0.42, y + 0.02, 0);
      return v;
    })
  );
  const lens = (y: number) => {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24);
    g.rotateZ(Math.PI / 2);
    g.translate(0.33, y, 0);
    return g;
  };
  return { pole, head, backplate, border, visors, red: lens(3.55), amber: lens(3.25), green: lens(2.95) };
})();
const LENS = {
  red: new THREE.MeshStandardMaterial({ color: '#3a0d0b', roughness: 0.2 }),
  amber: new THREE.MeshStandardMaterial({ color: '#3a2a08', roughness: 0.2 }),
  green: new THREE.MeshStandardMaterial({ color: '#0b2e1c', roughness: 0.2 })
};

const Signal: React.FC<{ item: Item<'signal'> }> = ({ item }) => (
  <group position={item.position} rotation-y={item.heading} name={item.label ?? 'signal'}>
    <mesh geometry={signalGeometry.pole} material={MATERIALS.galvanised} castShadow />
    <mesh geometry={signalGeometry.head} material={MATERIALS.black} castShadow />
    <mesh geometry={signalGeometry.backplate} material={MATERIALS.black} castShadow />
    <mesh geometry={signalGeometry.border} material={MATERIALS.yellow} />
    <mesh geometry={signalGeometry.visors} material={MATERIALS.black} castShadow />
    <mesh geometry={signalGeometry.red} material={LENS.red} />
    <mesh geometry={signalGeometry.amber} material={LENS.amber} />
    <mesh geometry={signalGeometry.green} material={LENS.green} />
  </group>
);

// ---------------------------------------------------------------------------
// Street lights: an 8 m pole with an arm reaching over the carriageway.

const lightGeometry = (() => {
  const pole = merge([cyl(0.055, 0.09, 8, 0, 4, 0, 8), cyl(0.15, 0.15, 0.4, 0, 0.2, 0, 8)]);
  const arm = new THREE.CylinderGeometry(0.04, 0.04, 1.9, 8);
  arm.rotateZ(Math.PI / 2 + 0.12);
  arm.translate(0.95, 7.93, 0);
  const housing = box(0.75, 0.12, 0.3, 2.05, 8.02, 0);
  const lens = box(0.62, 0.02, 0.22, 2.05, 7.95, 0);
  return { body: merge([pole, arm, housing]), lens };
})();

const StreetLight: React.FC<{ item: Item<'streetlight'>; night: boolean; lit: boolean }> = ({ item, night, lit }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  const lens = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f4efe2', emissive: '#ffd59a', emissiveIntensity: night ? 6 : 0, roughness: 0.3 }),
    [night]
  );
  return (
    <group position={item.position} rotation-y={item.heading} name="street light">
      <mesh geometry={lightGeometry.body} material={MATERIALS.galvanised} castShadow />
      <mesh geometry={lightGeometry.lens} material={lens} />
      {night && lit && (
        <>
          <primitive object={target} position={[2.6, 0, 0]} />
          <spotLight
            position={[2.05, 7.9, 0]}
            target={target}
            color="#ffcf8f"
            intensity={260}
            distance={34}
            angle={1.05}
            penumbra={0.75}
            decay={1.6}
          />
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Rain trees: instanced trunks and lumpy canopies with some colour variation.

function canopyGeometry() {
  const rnd = mulberry(42);
  const blobs: THREE.BufferGeometry[] = [];
  const offsets = [
    [0, 5.2, 0, 2.6],
    [1.6, 4.8, 0.6, 1.9],
    [-1.5, 4.9, -0.5, 2.0],
    [0.4, 5.0, -1.6, 1.8],
    [-0.5, 4.7, 1.6, 1.8],
    [0.2, 6.2, 0.2, 1.7]
  ];
  for (const [x, y, z, r] of offsets) {
    // A smooth, lumpy blob: a sphere pushed in and out by low-frequency noise.
    const g = new THREE.SphereGeometry(r, 28, 18);
    const pos = g.getAttribute('position');
    const p = new THREE.Vector3();
    const phase = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (let i = 0; i < pos.count; i += 1) {
      p.fromBufferAttribute(pos, i).normalize();
      const n = Math.sin(p.x * 4 + phase[0]) * Math.sin(p.y * 5 + phase[1]) * Math.sin(p.z * 4 + phase[2]);
      const k = 1 + 0.16 * n + (rnd() - 0.5) * 0.05;
      pos.setXYZ(i, p.x * r * k, p.y * r * k * 0.72, p.z * r * k);
    }
    g.translate(x, y, z);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    blobs.push(g);
  }
  const merged = mergeGeometries(blobs);
  const colors = new Float32Array(merged.getAttribute('position').count * 3);
  const c = new THREE.Color();
  const pos = merged.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    // Lighter, yellower leaves on top; darker inside and underneath.
    const top = THREE.MathUtils.clamp((pos.getY(i) - 3.6) / 3.6, 0, 1);
    c.setHSL(0.23 + rnd() * 0.05, 0.42 + rnd() * 0.12, 0.13 + top * 0.12 + rnd() * 0.05);
    c.toArray(colors, i * 3);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Trees: React.FC<{ items: Item<'tree'>[] }> = ({ items }) => {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const trunk = merge([cyl(0.16, 0.28, 4.2, 0, 2.1, 0, 9), cyl(0.07, 0.12, 2.2, 0.5, 4.4, 0.2, 6), cyl(0.07, 0.12, 2.2, -0.45, 4.3, -0.3, 6)]);
    return { trunk, canopy: canopyGeometry() };
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((t, i) => {
      const s = t.scale ?? 1;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399) % (Math.PI * 2));
      m.compose(new THREE.Vector3(...t.position), q, new THREE.Vector3(s, s, s));
      trunks.current?.setMatrixAt(i, m);
      crowns.current?.setMatrixAt(i, m);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return (
    <group name="trees">
      <instancedMesh ref={trunks} args={[geo.trunk, MATERIALS.trunk, items.length]} castShadow receiveShadow />
      <instancedMesh ref={crowns} args={[geo.canopy, MATERIALS.canopy, items.length]} castShadow receiveShadow />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Buildings: painted plaster, windows with concrete sunshades, shop shutters and
// signboards on the street sides, and a parapet with water tanks on the roof.

interface Face {
  /** Outward normal along x or z. */
  n: [number, number];
  /** Centre of the face and its width. */
  c: [number, number];
  width: number;
  street: boolean;
}

function facesOf(item: Item<'building'>, scene: SceneFile): Face[] {
  const [cx, , cz] = item.position;
  const [sx, , sz] = item.size;
  const onStreet = (x: number, z: number, nx: number, nz: number) =>
    scene.roads.some((r) => {
      const half = r.lanes_each_way * r.lane_width;
      for (let d = 0; d <= 9; d += 1) {
        const px = x + nx * d;
        const pz = z + nz * d;
        if (r.axis === 'x' ? Math.abs(pz) <= half : Math.abs(px) <= half) return true;
      }
      return false;
    });
  return [
    { n: [1, 0], c: [cx + sx / 2, cz], width: sz },
    { n: [-1, 0], c: [cx - sx / 2, cz], width: sz },
    { n: [0, 1], c: [cx, cz + sz / 2], width: sx },
    { n: [0, -1], c: [cx, cz - sz / 2], width: sx }
  ].map((f) => ({ ...f, n: f.n as [number, number], c: f.c as [number, number], street: onStreet(f.c[0], f.c[1], f.n[0], f.n[1]) }));
}

/** A box placed on a face: u along the face, outward offset from the face, y up. */
function onFace(f: Face, u: number, out: number, y: number, w: number, h: number, depth: number) {
  const [nx, nz] = f.n;
  const tx = -nz;
  const tz = nx;
  const g = new THREE.BoxGeometry(nx !== 0 ? depth : w, h, nx !== 0 ? w : depth);
  g.translate(f.c[0] + nx * out + tx * u, y, f.c[1] + nz * out + tz * u);
  return g;
}

const SIGN_COLOURS = ['#b3261e', '#1f5aa6', '#1d7a4a', '#7a2f8f', '#c26d12', '#0f6e7a'];

const Building: React.FC<{ item: Item<'building'>; scene: SceneFile; index: number; night: boolean }> = ({ item, scene, index, night }) => {
  const built = useMemo(() => {
    const rnd = mulberry(index * 97 + 13);
    const [cx, base, cz] = item.position;
    const [sx, h, sz] = item.size;
    const faces = facesOf(item, scene);
    const glass: THREE.BufferGeometry[] = [];
    const lit: THREE.BufferGeometry[] = [];
    const frames: THREE.BufferGeometry[] = [];
    const shutters: THREE.BufferGeometry[] = [];
    const boards: { g: THREE.BufferGeometry; colour: string }[] = [];
    const ground = 3.6;
    const floorH = 3.2;
    for (const f of faces) {
      const bays = Math.max(1, Math.round(f.width / 3.6));
      const bayW = f.width / bays;
      for (let b = 0; b < bays; b += 1) {
        const u = -f.width / 2 + bayW * (b + 0.5);
        // Ground floor: shutters on the street, small windows elsewhere.
        if (f.street) {
          shutters.push(onFace(f, u, 0.03, base + 1.35, bayW - 0.7, 2.7, 0.06));
        } else {
          glass.push(onFace(f, u, 0.02, base + 1.7, Math.min(1.2, bayW * 0.4), 1.1, 0.04));
        }
        // Upper floors: a window with a frame and a sunshade over it.
        for (let fl = 1; fl < item.floors; fl += 1) {
          const y = base + ground + (fl - 1) * floorH + 1.45;
          const ww = Math.min(1.6, bayW * 0.48);
          frames.push(onFace(f, u, 0.03, y, ww + 0.16, 1.46, 0.05));
          (rnd() < 0.32 ? lit : glass).push(onFace(f, u, 0.06, y, ww, 1.3, 0.03));
          frames.push(onFace(f, u, 0.28, y + 0.85, ww + 0.5, 0.08, 0.56));
        }
      }
      if (f.street) {
        // A continuous signboard band above the shutters, broken into shops.
        const shops = Math.max(1, Math.round(f.width / 7));
        const shopW = f.width / shops;
        for (let s = 0; s < shops; s += 1) {
          const u = -f.width / 2 + shopW * (s + 0.5);
          boards.push({ g: onFace(f, u, 0.08, base + 3.1, shopW - 0.4, 0.7, 0.08), colour: SIGN_COLOURS[Math.floor(rnd() * SIGN_COLOURS.length)] });
        }
        // Weather shade over the shopfronts.
        frames.push(onFace(f, 0, 0.6, base + 2.75, f.width - 0.2, 0.08, 1.2));
      }
    }
    // Roof: parapet, stair room and water tanks.
    const roofY = base + h;
    const parapet = [
      box(sx, 0.9, 0.2, cx, roofY + 0.45, cz - sz / 2 + 0.1),
      box(sx, 0.9, 0.2, cx, roofY + 0.45, cz + sz / 2 - 0.1),
      box(0.2, 0.9, sz, cx - sx / 2 + 0.1, roofY + 0.45, cz),
      box(0.2, 0.9, sz, cx + sx / 2 - 0.1, roofY + 0.45, cz)
    ];
    const extras: THREE.BufferGeometry[] = [];
    const tanks: THREE.BufferGeometry[] = [];
    if (item.floors > 1) {
      extras.push(box(3, 2.6, 3, cx + sx * 0.18, roofY + 1.3, cz - sz * 0.15));
      tanks.push(cyl(0.6, 0.6, 1.15, cx + sx * 0.18, roofY + 2.6 + 0.58, cz - sz * 0.15, 20));
      if (sx * sz > 200) tanks.push(cyl(0.55, 0.55, 1.05, cx - sx * 0.22, roofY + 0.53, cz + sz * 0.2, 20));
    }
    const body = box(sx, h, sz, cx, base + h / 2, cz);
    // Plaster uvs in metres, so the weathering keeps its scale on every building.
    const uvFix = (g: THREE.BufferGeometry) => {
      const pos = g.getAttribute('position');
      const nrm = g.getAttribute('normal');
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i += 1) {
        const useX = Math.abs(nrm.getX(i)) < 0.5;
        uv[i * 2] = (useX ? pos.getX(i) : pos.getZ(i)) / 6;
        uv[i * 2 + 1] = pos.getY(i) / 6;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      return g;
    };
    return {
      walls: uvFix(merge([body, ...parapet, ...extras])),
      glass: glass.length ? merge(glass) : null,
      lit: lit.length ? merge(lit) : null,
      frames: frames.length ? merge(frames) : null,
      shutters: shutters.length ? merge(shutters) : null,
      tanks: tanks.length ? merge(tanks) : null,
      boards,
      faces
    };
  }, [item, scene, index]);

  const mats = useMemo(() => {
    const shutter = shutterTexture();
    return {
      walls: new THREE.MeshStandardMaterial({ color: item.colour, map: plasterTexture(), roughness: 0.92 }),
      shutter: new THREE.MeshStandardMaterial({ map: shutter, metalness: 0.5, roughness: 0.5 }),
      lit: new THREE.MeshStandardMaterial({ color: '#3a3226', emissive: '#ffcf8a', emissiveIntensity: night ? 1.6 : 0, roughness: 0.2 }),
      boards: new Map(built.boards.map((b) => [b.colour, new THREE.MeshStandardMaterial({ color: b.colour, roughness: 0.55 })]))
    };
  }, [item.colour, built, night]);

  const signFace = item.sign ? built.faces.find((f) => f.street) : undefined;
  return (
    <group name={item.label ?? 'building'}>
      <mesh geometry={built.walls} material={mats.walls} castShadow receiveShadow />
      {built.glass && <mesh geometry={built.glass} material={MATERIALS.glass} />}
      {built.lit && <mesh geometry={built.lit} material={mats.lit} />}
      {built.frames && <mesh geometry={built.frames} material={MATERIALS.frame} castShadow receiveShadow />}
      {built.shutters && <mesh geometry={built.shutters} material={mats.shutter} receiveShadow />}
      {built.tanks && <mesh geometry={built.tanks} material={MATERIALS.tank} castShadow />}
      {!item.sign && built.boards.map((b, i) => <mesh key={i} geometry={b.g} material={mats.boards.get(b.colour)} castShadow />)}
      {signFace && item.sign && <ShopSign face={signFace} base={item.position[1]} text={item.sign} />}
    </group>
  );
};

const ShopSign: React.FC<{ face: Face; base: number; text: string }> = ({ face, base, text }) => {
  const [nx, nz] = face.n;
  const rotY = Math.atan2(nx, nz);
  const width = Math.min(face.width - 0.6, 9);
  return (
    <mesh position={[face.c[0] + nx * 0.13, base + 3.15, face.c[1] + nz * 0.13]} rotation-y={rotY}>
      <planeGeometry args={[width, width * (160 / 1024) * 1.6]} />
      <meshStandardMaterial map={signTexture(text, '#a11d1d')} roughness={0.5} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// A bus shelter: steel frame, sloped roof, back panel, bench and the stop's name.

const shelterGeometry = (() => {
  const posts = merge([-1.7, 1.7].flatMap((x) => [cyl(0.04, 0.04, 2.5, x, 1.25, -0.55), cyl(0.04, 0.04, 2.3, x, 1.15, 0.6)]));
  const roof = (() => {
    const g = new THREE.BoxGeometry(3.8, 0.06, 1.75);
    g.rotateX(0.07);
    g.translate(0, 2.47, 0);
    return g;
  })();
  const bench = merge([box(3.0, 0.05, 0.38, 0, 0.46, -0.3), cyl(0.03, 0.03, 0.44, -1.2, 0.22, -0.3), cyl(0.03, 0.03, 0.44, 1.2, 0.22, -0.3)]);
  return { posts, roof, bench, back: box(3.4, 1.7, 0.02, 0, 1.25, -0.62), sign: box(1.6, 0.36, 0.05, 0, 2.75, 0.55) };
})();

const BusStop: React.FC<{ item: Item<'bus-stop'> }> = ({ item }) => {
  const signMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: signTexture((item.label ?? 'BUS STOP').toUpperCase(), '#1f5aa6'), roughness: 0.5 }),
    [item.label]
  );
  // The shelter's open side (+z in its own frame) faces the road along its heading.
  return (
    <group position={item.position} rotation-y={item.heading + Math.PI / 2} name={item.label ?? 'bus stop'}>
      <mesh geometry={shelterGeometry.posts} material={MATERIALS.galvanised} castShadow />
      <mesh geometry={shelterGeometry.roof} material={MATERIALS.galvanised} castShadow receiveShadow />
      <mesh geometry={shelterGeometry.bench} material={MATERIALS.galvanised} castShadow />
      <mesh geometry={shelterGeometry.back} material={MATERIALS.glass} />
      <mesh geometry={shelterGeometry.sign} material={signMat} castShadow />
    </group>
  );
};

const Wall: React.FC<{ item: Item<'wall'> }> = ({ item }) => {
  const [x0, , z0] = item.from;
  const [x1, , z1] = item.to;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9d2c4', map: plasterTexture(), roughness: 0.95 }), []);
  return (
    <mesh position={[(x0 + x1) / 2, item.from[1] + item.height / 2, (z0 + z1) / 2]} rotation-y={Math.atan2(-(z1 - z0), x1 - x0)} material={material} castShadow receiveShadow>
      <boxGeometry args={[len, item.height, 0.23]} />
    </mesh>
  );
};

const PlacedModel: React.FC<{
  item: Item<'model'>;
  scene: SceneFile;
  index: number;
  showLabels: boolean;
  renderEvidence: (refs: EvidenceRef[], label: string) => React.ReactNode;
}> = ({ item, scene, index, showLabels, renderEvidence }) => {
  const spec = modelSpec(scene, item.model);
  if (!spec) return null;
  const height = (item.size ?? spec.size)[2] + (spec.elevation ?? 0);
  // Label what the evidence names; illustrative furnishing stays quiet.
  const labelled = showLabels && !item.illustrative && !!item.label;
  return (
    <group position={item.position} rotation={item.rotation ?? [0, 0, 0]} name={item.label ?? item.model}>
      <CatalogueModel spec={spec} size={item.size} seed={index + 1} />
      {labelled && (
        <Html position={[0, height + 0.5, 0]} center zIndexRange={[16, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded bg-canvas/85 px-1.5 py-0.5 text-2xs text-ink shadow ring-1 ring-line-strong backdrop-blur-sm">
            <span>{item.label}</span>
            {item.evidence && item.evidence.length > 0 && renderEvidence(item.evidence, item.label!)}
          </div>
        </Html>
      )}
    </group>
  );
};

/** Everything static in the scene except the road surface, rooms and traces. */
export const StreetFurniture: React.FC<{
  scene: SceneFile;
  night: boolean;
  focus: [number, number];
  showLabels: boolean;
  renderEvidence: (refs: EvidenceRef[], label: string) => React.ReactNode;
}> = ({ scene, night, focus, showLabels, renderEvidence }) => {
  const trees = scene.static.filter((s): s is Item<'tree'> => s.kind === 'tree');
  // Only the lights nearest the action cast light, to keep the night scene fast.
  const lights = scene.static.filter((s): s is Item<'streetlight'> => s.kind === 'streetlight');
  const litSet = new Set([...lights].sort((a, b) => dist2(a.position, focus) - dist2(b.position, focus)).slice(0, 6));
  return (
    <group name="street furniture">
      {scene.static.map((item, i) => {
        if (item.kind === 'signal') return <Signal key={i} item={item} />;
        if (item.kind === 'streetlight') return <StreetLight key={i} item={item} night={night} lit={litSet.has(item)} />;
        if (item.kind === 'building') return <Building key={i} item={item} scene={scene} index={i} night={night} />;
        if (item.kind === 'bus-stop') return <BusStop key={i} item={item} />;
        if (item.kind === 'wall') return <Wall key={i} item={item} />;
        if (item.kind === 'model')
          return <PlacedModel key={i} item={item} scene={scene} index={i} showLabels={showLabels} renderEvidence={renderEvidence} />;
        return null;
      })}
      <Trees items={trees} />
    </group>
  );
};

const dist2 = (p: number[], f: [number, number]) => (p[0] - f[0]) ** 2 + (p[2] - f[1]) ** 2;

