import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCENE_ROOT, SceneFile } from './sceneFile';
import { kerbTexture, paintWearTexture } from './textures';

// The road surface: one straight road, a T-junction or a crossroads, with raised
// footpaths and painted kerbs, and the markings, all built from the scene's roads.

type Arm = 'E' | 'S' | 'W' | 'N';
// Traversal order around the junction; consecutive arms are 90 degrees apart.
const ORDER: Arm[] = ['E', 'S', 'W', 'N'];
const OUTWARD: Record<Arm, [number, number]> = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };

interface Layout {
  arms: Arm[];
  hwx: number;
  hwz: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Extent of the footpath blocks. */
  X0: number;
  X1: number;
  Z0: number;
  Z1: number;
  r: number;
  kerb: number;
  junction: boolean;
}

function layoutOf(scene: SceneFile): Layout | null {
  const xRoad = scene.roads.find((r) => r.axis === 'x');
  const zRoad = scene.roads.find((r) => r.axis === 'z');
  if (!xRoad && !zRoad) return null;
  const hwx = xRoad ? xRoad.lanes_each_way * xRoad.lane_width : 0;
  const hwz = zRoad ? zRoad.lanes_each_way * zRoad.lane_width : 0;
  const [x0, x1] = xRoad ? [xRoad.from, xRoad.to] : [0, 0];
  const [z0, z1] = zRoad ? [zRoad.from, zRoad.to] : [0, 0];
  const arms = ORDER.filter((a) =>
    a === 'E' ? !!xRoad && x1 > hwz + 1 : a === 'W' ? !!xRoad && x0 < -hwz - 1 : a === 'S' ? !!zRoad && z1 > hwx + 1 : !!zRoad && z0 < -hwx - 1
  );
  if (arms.length < 2) return null;
  const ext = Math.max(Math.abs(x0), Math.abs(x1), Math.abs(z0), Math.abs(z1), 40);
  return {
    arms,
    hwx,
    hwz,
    x0,
    x1,
    z0,
    z1,
    X0: arms.includes('W') ? x0 : -ext,
    X1: arms.includes('E') ? x1 : ext,
    Z0: arms.includes('N') ? z0 : -ext,
    Z1: arms.includes('S') ? z1 : ext,
    r: scene.junction?.corner_radius ?? 3,
    kerb: scene.junction?.kerb_height ?? 0.15,
    junction: !!xRoad && !!zRoad
  };
}

/** The kerb return at a corner, as points in (x, z), from the x-road edge to the z-road edge. */
function cornerArc(l: Layout, sx: number, sz: number, steps = 10) {
  const cx = sx * (l.hwz + l.r);
  const cz = sz * (l.hwx + l.r);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * (Math.PI / 2);
    pts.push([cx - sx * l.r * Math.sin(t), cz - sz * l.r * Math.cos(t)]);
  }
  return pts;
}

/** Where an arm's carriageway meets the scene edge: its two kerb ends, in traversal order. */
function farPoints(l: Layout, a: Arm): [number, number][] {
  if (a === 'E') return [[l.x1, -l.hwx], [l.x1, l.hwx]];
  if (a === 'S') return [[l.hwz, l.z1], [-l.hwz, l.z1]];
  if (a === 'W') return [[l.x0, l.hwx], [l.x0, -l.hwx]];
  return [[-l.hwz, l.z0], [l.hwz, l.z0]];
}

/** The kerb between two arms 90 degrees apart (none when an arm between them is missing). */
function connector(l: Layout, a: Arm, b: Arm): [number, number][] {
  if ((ORDER.indexOf(a) + 1) % 4 !== ORDER.indexOf(b)) return [];
  if (a === 'E') return cornerArc(l, 1, 1);
  if (a === 'S') return cornerArc(l, -1, 1).reverse();
  if (a === 'W') return cornerArc(l, -1, -1);
  return cornerArc(l, 1, -1).reverse();
}

/** The scene-edge corner between consecutive arms in the traversal order. */
function extentCorner(l: Layout, i: number): [number, number] {
  return [
    [l.X1, l.Z1],
    [l.X0, l.Z1],
    [l.X0, l.Z0],
    [l.X1, l.Z0]
  ][i] as [number, number];
}

/** A shape in the XZ plane; shapes are drawn in (x, -z) and laid flat by rotating -90 degrees about x. */
function shapeOf(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  return shape;
}

const pairs = (l: Layout) => l.arms.map((a, i) => [a, l.arms[(i + 1) % l.arms.length]] as [Arm, Arm]);

function carriageway(l: Layout) {
  const pts: [number, number][] = [];
  for (const [a, b] of pairs(l)) pts.push(...farPoints(l, a), ...connector(l, a, b));
  const geo = new THREE.ShapeGeometry(shapeOf(pts), 12);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** The footpath blocks between the road arms, extruded up to kerb height. */
function footpaths(l: Layout) {
  return pairs(l).map(([a, b]) => {
    const pts: [number, number][] = [farPoints(l, a)[1], ...connector(l, a, b), farPoints(l, b)[0]];
    // Back round the scene edge from b to a.
    const ia = ORDER.indexOf(a);
    let k = (ORDER.indexOf(b) + 3) % 4;
    for (let n = 0; n < 4; n += 1) {
      pts.push(extentCorner(l, k));
      if (k === ia) break;
      k = (k + 3) % 4;
    }
    // Separate meshes keep each extrusion's groups: top surface first, kerb faces second.
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: l.kerb, bevelEnabled: false, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

function rect(x0: number, z0: number, x1: number, z1: number, y: number) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

/** A rectangle on an arm: from a0 to a1 along its outward direction, c0 to c1 across it along `side`. */
function armRect(a: Arm, side: [number, number], a0: number, a1: number, c0: number, c1: number, y: number) {
  const [dx, dz] = OUTWARD[a];
  const xs = [dx * a0 + side[0] * c0, dx * a1 + side[0] * c1];
  const zs = [dz * a0 + side[1] * c0, dz * a1 + side[1] * c1];
  return rect(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), y);
}

function markings(scene: SceneFile, l: Layout) {
  const y = 0.004;
  const parts: THREE.BufferGeometry[] = [];
  const keepLeft = (scene.setting?.drive_side ?? 'left') === 'left';
  const stop = l.junction ? (scene.junction?.stop_line ?? Math.max(l.hwx, l.hwz) + l.r + 1.5) : 0;
  const w = 0.3;
  const half = (a: Arm) => (a === 'E' || a === 'W' ? l.hwx : l.hwz);
  const end = (a: Arm) => (a === 'E' ? l.x1 : a === 'W' ? -l.x0 : a === 'S' ? l.z1 : -l.z0);
  for (const a of l.arms) {
    const [dx, dz] = OUTWARD[a];
    // Traffic on this arm heads in to the centre; its lane is on the side it keeps to.
    const lane: [number, number] = keepLeft ? [-dz, dx] : [dz, -dx];
    const hw = half(a);
    if (l.junction) {
      parts.push(armRect(a, lane, stop, stop + w, 0.1, hw - 0.2, y));
      const crossing = scene.junction?.crossing;
      if (crossing) {
        for (let c = -hw + 0.5; c <= hw - 0.5 + 1e-6; c += 1) parts.push(armRect(a, lane, crossing[0], crossing[1], c - 0.25, c + 0.25, y));
      }
    }
    // Broken centre line, then solid edge lines.
    for (let d = stop + 1; d + 3 < end(a); d += 6) parts.push(armRect(a, lane, d, d + 3, -0.06, 0.06, y));
    for (const e of [1, -1]) parts.push(armRect(a, lane, stop + 0.4, end(a), e * (hw - 0.25) - 0.06, e * (hw - 0.25) + 0.06, y));
  }
  // A road's edge line runs straight on past a junction where no road leaves that side.
  if (l.junction) {
    for (const [side, armOnSide] of [[-1, 'N'], [1, 'S']] as const) {
      if (!l.arms.includes(armOnSide)) parts.push(rect(-stop, side * (l.hwx - 0.25) - 0.06, stop, side * (l.hwx - 0.25) + 0.06, y));
    }
    for (const [side, armOnSide] of [[-1, 'W'], [1, 'E']] as const) {
      if (!l.arms.includes(armOnSide)) parts.push(rect(side * (l.hwz - 0.25) - 0.06, -stop, side * (l.hwz - 0.25) + 0.06, stop, y));
    }
  }
  const merged = mergeGeometries(parts);
  // World-space uvs, so the worn paint texture doesn't stretch with each bar.
  const pos = merged.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = pos.getX(i) / 3;
    uv[i * 2 + 1] = pos.getZ(i) / 3;
  }
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return merged;
}

function configure(tex: THREE.Texture, repeat: number, color = false) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

export const Junction: React.FC<{ scene: SceneFile }> = ({ scene }) => {
  const layout = useMemo(() => layoutOf(scene), [scene]);
  const tex = useTexture({
    asphalt: `${SCENE_ROOT}/textures/asphalt_02_diff_1k.jpg`,
    asphaltNormal: `${SCENE_ROOT}/textures/asphalt_02_nor_1k.jpg`,
    asphaltRough: `${SCENE_ROOT}/textures/asphalt_02_rough_1k.jpg`,
    pavers: `${SCENE_ROOT}/textures/concrete_pavers_02_diff_1k.jpg`,
    paversNormal: `${SCENE_ROOT}/textures/concrete_pavers_02_nor_1k.jpg`,
    paversRough: `${SCENE_ROOT}/textures/concrete_pavers_02_rough_1k.jpg`
  });
  useMemo(() => {
    configure(tex.asphalt, 1 / 7, true);
    configure(tex.asphaltNormal, 1 / 7);
    configure(tex.asphaltRough, 1 / 7);
    configure(tex.pavers, 1 / 2.4, true);
    configure(tex.paversNormal, 1 / 2.4);
    configure(tex.paversRough, 1 / 2.4);
  }, [tex]);

  const geo = useMemo(() => (layout ? { road: carriageway(layout), paths: footpaths(layout), marks: markings(scene, layout) } : null), [scene, layout]);

  const mats = useMemo(() => {
    const kerb = kerbTexture().clone();
    kerb.needsUpdate = true;
    kerb.repeat.set(1, 1 / (layout?.kerb ?? 0.15));
    const paint = paintWearTexture();
    return {
      road: new THREE.MeshStandardMaterial({
        map: tex.asphalt,
        normalMap: tex.asphaltNormal,
        roughnessMap: tex.asphaltRough,
        color: '#b9b6b0',
        roughness: 1
      }),
      pavers: new THREE.MeshStandardMaterial({
        map: tex.pavers,
        normalMap: tex.paversNormal,
        roughnessMap: tex.paversRough,
        color: '#cfc8bd',
        roughness: 1
      }),
      kerb: new THREE.MeshStandardMaterial({ map: kerb, roughness: 0.85 }),
      paint: new THREE.MeshStandardMaterial({
        color: '#f2f1ea',
        map: paint,
        roughness: 0.7,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
    };
  }, [tex, layout]);

  if (!layout || !geo) return null;
  return (
    <group name="junction">
      <mesh geometry={geo.road} material={mats.road} receiveShadow name="carriageway" />
      {geo.paths.map((g, i) => (
        <mesh key={i} geometry={g} material={[mats.pavers, mats.kerb]} receiveShadow castShadow name="footpath" />
      ))}
      <mesh geometry={geo.marks} material={mats.paint} receiveShadow name="markings" />
      {/* Ground beyond the modelled streets, fading into the fog. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow name="surroundings">
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#5d5a54" roughness={1} />
      </mesh>
    </group>
  );
};
