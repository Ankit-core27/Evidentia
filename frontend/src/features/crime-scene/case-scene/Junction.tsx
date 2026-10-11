import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCENE_ROOT, SceneFile } from './sceneFile';
import { kerbTexture, paintWearTexture, skidTexture } from './textures';

// The road surface of a four-way junction: one carriageway, raised footpaths with
// painted kerbs, and the markings, all built from the scene file's dimensions.

interface Layout {
  hwx: number;
  hwz: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  r: number;
  kerb: number;
}

function layoutOf(scene: SceneFile): Layout | null {
  const xRoad = scene.roads.find((r) => r.axis === 'x');
  const zRoad = scene.roads.find((r) => r.axis === 'z');
  if (!xRoad || !zRoad) return null;
  return {
    hwx: xRoad.lanes_each_way * xRoad.lane_width,
    hwz: zRoad.lanes_each_way * zRoad.lane_width,
    x0: xRoad.from,
    x1: xRoad.to,
    z0: zRoad.from,
    z1: zRoad.to,
    r: scene.junction?.corner_radius ?? 3,
    kerb: scene.junction?.kerb_height ?? 0.15
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

/** A shape in the XZ plane; shapes are drawn in (x, -z) and laid flat by rotating -90 degrees about x. */
function shapeOf(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  return shape;
}

function carriageway(l: Layout) {
  const pts: [number, number][] = [
    [l.x1, -l.hwx],
    [l.x1, l.hwx],
    ...cornerArc(l, 1, 1),
    [l.hwz, l.z1],
    [-l.hwz, l.z1],
    ...cornerArc(l, -1, 1).reverse(),
    [l.x0, l.hwx],
    [l.x0, -l.hwx],
    ...cornerArc(l, -1, -1),
    [-l.hwz, l.z0],
    [l.hwz, l.z0],
    ...cornerArc(l, 1, -1).reverse()
  ];
  const geo = new THREE.ShapeGeometry(shapeOf(pts), 12);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** The four footpath blocks between the road arms, extruded up to kerb height. */
function footpaths(l: Layout) {
  const quads: [number, number][][] = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const xEnd = sx > 0 ? l.x1 : l.x0;
    const zEnd = sz > 0 ? l.z1 : l.z0;
    quads.push([[xEnd, sz * l.hwx], ...cornerArc(l, sx, sz), [sx * l.hwz, zEnd], [xEnd, zEnd]]);
  }
  // Separate meshes keep each extrusion's groups: top surface first, kerb faces second.
  return quads.map((q) => {
    const g = new THREE.ExtrudeGeometry(shapeOf(q), { depth: l.kerb, bevelEnabled: false, curveSegments: 12 });
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

function markings(scene: SceneFile, l: Layout) {
  const y = 0.004;
  const parts: THREE.BufferGeometry[] = [];
  const stop = scene.junction?.stop_line ?? l.hwz + l.r + 2;
  const [c0, c1] = scene.junction?.crossing ?? [l.hwz + 1, l.hwz + 4];
  const w = 0.3;
  // Stop lines across each approach lane (traffic keeps left).
  parts.push(rect(-stop - w, -l.hwx + 0.2, -stop, -0.1, y));
  parts.push(rect(stop, 0.1, stop + w, l.hwx - 0.2, y));
  parts.push(rect(-l.hwz + 0.2, stop, -0.1, stop + w, y));
  parts.push(rect(0.1, -stop - w, l.hwz - 0.2, -stop, y));
  // Zebra crossings: bars along the traffic direction.
  for (const s of [1, -1]) {
    for (let z = -l.hwx + 0.5; z <= l.hwx - 0.5 + 1e-6; z += 1) parts.push(rect(s * c0, z - 0.25, s * c1, z + 0.25, y));
    for (let x = -l.hwz + 0.5; x <= l.hwz - 0.5 + 1e-6; x += 1) parts.push(rect(x - 0.25, s * c0, x + 0.25, s * c1, y));
  }
  // Broken centre lines and solid edge lines beyond the stop lines.
  const dash = 3;
  const gap = 3;
  for (const s of [1, -1]) {
    for (let d = stop + 1; d + dash < (s > 0 ? l.x1 : -l.x0); d += dash + gap) parts.push(rect(s * d, -0.06, s * (d + dash), 0.06, y));
    for (let d = stop + 1; d + dash < (s > 0 ? l.z1 : -l.z0); d += dash + gap) parts.push(rect(-0.06, s * d, 0.06, s * (d + dash), y));
    const xEnd = s > 0 ? l.x1 : l.x0;
    const zEnd = s > 0 ? l.z1 : l.z0;
    for (const e of [1, -1]) {
      parts.push(rect(s * (stop + 0.4), e * (l.hwx - 0.25) - 0.06, xEnd, e * (l.hwx - 0.25) + 0.06, y));
      parts.push(rect(e * (l.hwz - 0.25) - 0.06, s * (stop + 0.4), e * (l.hwz - 0.25) + 0.06, zEnd, y));
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
      {scene.static.map((item, i) =>
        item.kind === 'skid-marks' ? <SkidMarks key={i} from={item.from} to={item.to} track={item.track} /> : null
      )}
    </group>
  );
};

/** A pair of tyre marks from where braking began to where the vehicle stopped skidding. */
const SkidMarks: React.FC<{ from: number[]; to: number[]; track: number }> = ({ from, to, track }) => {
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
