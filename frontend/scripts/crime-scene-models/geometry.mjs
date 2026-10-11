// Geometry helpers for the vehicle models: lofted bodies, surface patches and wheels.
// Vehicle frame: x forward, y up, z to the vehicle's right. Metres.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Catmull-Rom interpolation through [x, y] keys sorted by x; clamps outside the range. */
export function curve(keys) {
  return (x) => {
    if (x <= keys[0][0]) return keys[0][1];
    const last = keys.length - 1;
    if (x >= keys[last][0]) return keys[last][1];
    let i = 0;
    while (keys[i + 1][0] < x) i += 1;
    const [x0, y0] = keys[Math.max(i - 1, 0)];
    const [x1, y1] = keys[i];
    const [x2, y2] = keys[i + 1];
    const [x3, y3] = keys[Math.min(i + 2, last)];
    const t = (x - x1) / (x2 - x1);
    const m1 = ((y2 - y0) / (x2 - x0 || 1)) * (x2 - x1);
    const m2 = ((y3 - y1) / (x3 - x1 || 1)) * (x2 - x1);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y2 + (t3 - t2) * m2;
  };
}

export const smooth = (t) => {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
};

/** Sorted, de-duplicated stations along x: a base spacing plus dense clusters near the given points. */
export function stations(x0, x1, step, clusters = []) {
  const xs = new Set();
  for (let x = x0; x < x1; x += step) xs.add(+x.toFixed(4));
  xs.add(+x1.toFixed(4));
  for (const { at, span, step: s } of clusters) {
    for (let x = at - span; x <= at + span; x += s) if (x >= x0 && x <= x1) xs.add(+x.toFixed(4));
  }
  return [...xs].sort((a, b) => a - b);
}

/**
 * Lofts cross-sections along x. section(x) returns the right half of a ring as
 * [{ z, y, m }], from the bottom centre (z = 0) to the top centre (z = 0); m names the
 * material of the segment from that point to the next. The left half is mirrored.
 * Returns { [material]: BufferGeometry }.
 */
export function loft(xs, section, { capStart = 'paint', capEnd = 'paint' } = {}) {
  const rings = xs.map((x) => {
    const half = section(x);
    const pts = half.map((p) => ({ x, y: p.y, z: p.z }));
    const segM = half.map((p) => p.m);
    // Left half, top to bottom, without the two centre points.
    for (let k = half.length - 2; k >= 1; k -= 1) {
      pts.push({ x, y: half[k].y, z: -half[k].z });
      segM.push(half[k - 1].m);
    }
    segM[half.length - 1] = half[half.length - 2].m;
    return { pts, segM };
  });
  const n = rings[0].pts.length;
  const out = {};
  const get = (m) => (out[m] ??= { pos: [], idx: [], map: new Map() });
  const vert = (g, s, i) => {
    const key = s * n + i;
    let v = g.map.get(key);
    if (v === undefined) {
      const p = rings[s].pts[i];
      v = g.pos.length / 3;
      g.pos.push(p.x, p.y, p.z);
      g.map.set(key, v);
    }
    return v;
  };
  for (let s = 0; s < rings.length - 1; s += 1) {
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const g = get(rings[s].segM[i]);
      const a = vert(g, s, i);
      const b = vert(g, s, j);
      const c = vert(g, s + 1, j);
      const d = vert(g, s + 1, i);
      g.idx.push(a, c, b, a, d, c);
    }
  }
  const cap = (s, m, flip) => {
    if (!m) return;
    const g = get(`${m}#cap${s}`);
    const ring = rings[s].pts;
    const cx = ring.reduce((acc, p) => acc + p.x, 0) / n;
    const cy = ring.reduce((acc, p) => acc + p.y, 0) / n;
    const base = g.pos.length / 3;
    g.pos.push(cx, cy, 0);
    ring.forEach((p) => g.pos.push(p.x, p.y, p.z));
    for (let i = 0; i < n; i += 1) {
      const a = base + 1 + i;
      const b = base + 1 + ((i + 1) % n);
      if (flip) g.idx.push(base, b, a);
      else g.idx.push(base, a, b);
    }
  };
  cap(0, capStart, false);
  cap(rings.length - 1, capEnd, true);

  const result = {};
  for (const [key, g] of Object.entries(out)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setIndex(g.idx);
    geo.computeVertexNormals();
    const m = key.split('#')[0];
    (result[m] ??= []).push(geo);
  }
  return Object.fromEntries(Object.entries(result).map(([m, gs]) => [m, gs.length === 1 ? gs[0] : mergeGeometries(gs)]));
}

/**
 * A grid patch laid on a surface, offset outwards along its normal. point(u, v) returns the
 * surface point for u, v in [0, 1]; the patch faces outward when du x dv points out.
 */
export function patch(point, { nu = 24, nv = 10, offset = 0.004, flip = false, uvs = false } = {}) {
  const pos = [];
  const uv = [];
  const e = 1e-3;
  for (let j = 0; j <= nv; j += 1) {
    for (let i = 0; i <= nu; i += 1) {
      const u = i / nu;
      const v = j / nv;
      const p = point(u, v);
      const pu = point(Math.min(u + e, 1), v).sub(point(Math.max(u - e, 0), v));
      const pv = point(u, Math.min(v + e, 1)).sub(point(u, Math.max(v - e, 0)));
      const nrm = pu.cross(pv).normalize();
      if (flip) nrm.negate();
      p.addScaledVector(nrm, offset);
      pos.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j += 1) {
    for (let i = 0; i < nu; i += 1) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 2;
      const d = a + nu + 1;
      if (flip) idx.push(a, c, b, a, d, c);
      else idx.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A tyre on an axle along z, outer sidewall at +z. */
export function tyre(radius, width, rimRadius, { grooves = 4, segments = 40 } = {}) {
  const hw = width / 2;
  const sideBulge = radius - (radius - rimRadius) * 0.18;
  const pts = [];
  const push = (r, y) => pts.push(new THREE.Vector2(r, y));
  push(rimRadius + 0.005, -hw * 0.82);
  push(rimRadius + 0.02, -hw * 0.95);
  push(sideBulge, -hw);
  push(radius - 0.012, -hw * 0.97);
  push(radius - 0.003, -hw * 0.88);
  // Tread with circumferential grooves.
  const treadW = hw * 0.86;
  const gW = 0.009;
  const centres = Array.from({ length: grooves }, (_, k) => -treadW + ((k + 1) * 2 * treadW) / (grooves + 1));
  push(radius, -treadW);
  for (const c of centres) {
    push(radius, c - gW / 2 - 0.001);
    push(radius - 0.009, c - gW / 2);
    push(radius - 0.009, c + gW / 2);
    push(radius, c + gW / 2 + 0.001);
  }
  push(radius, treadW);
  push(radius - 0.003, hw * 0.88);
  push(radius - 0.012, hw * 0.97);
  push(sideBulge, hw);
  push(rimRadius + 0.02, hw * 0.95);
  push(rimRadius + 0.005, hw * 0.82);
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateX(Math.PI / 2);
  geo.deleteAttribute('uv');
  return geo;
}

/** An alloy wheel face with spoke windows, facing +z, plus its barrel and brake disc. */
export function alloyWheel(rimRadius, depth, { spokes = 8, segments = 18 } = {}) {
  const outer = rimRadius * 0.97;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const inner = rimRadius * 0.36;
  const windowOuter = rimRadius * 0.86;
  const spokeHalf = (Math.PI / spokes) * 0.34;
  for (let k = 0; k < spokes; k += 1) {
    const a0 = (k / spokes) * Math.PI * 2 + spokeHalf;
    const a1 = ((k + 1) / spokes) * Math.PI * 2 - spokeHalf;
    const hole = new THREE.Path();
    hole.absarc(0, 0, windowOuter, a0, a1, false);
    hole.lineTo(Math.cos(a1 - 0.08) * inner * 1.25, Math.sin(a1 - 0.08) * inner * 1.25);
    hole.absarc(0, 0, inner * 1.25, a1 - 0.08, a0 + 0.08, true);
    hole.lineTo(Math.cos(a0) * windowOuter, Math.sin(a0) * windowOuter);
    shape.holes.push(hole);
  }
  const face = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 1,
    curveSegments: segments
  });
  face.deleteAttribute('uv');
  const faceGeo = mergeVertices(face);
  faceGeo.translate(0, 0, depth / 2 - 0.03);
  faceGeo.computeVertexNormals();

  const barrel = new THREE.CylinderGeometry(rimRadius, rimRadius, depth, 36, 1, true);
  barrel.rotateX(Math.PI / 2);
  barrel.deleteAttribute('uv');
  const lip = new THREE.TorusGeometry(rimRadius * 0.985, 0.008, 6, 40);
  lip.translate(0, 0, depth / 2 - 0.012);
  lip.deleteAttribute('uv');

  const hub = new THREE.CylinderGeometry(inner * 0.55, inner * 0.6, 0.03, 24);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, 0, depth / 2 - 0.005);
  hub.deleteAttribute('uv');

  const disc = new THREE.CylinderGeometry(rimRadius * 0.72, rimRadius * 0.72, 0.022, 40);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, -depth * 0.05);
  disc.deleteAttribute('uv');
  const caliper = new THREE.BoxGeometry(0.06, 0.11, 0.05);
  caliper.translate(-rimRadius * 0.62, rimRadius * 0.15, -depth * 0.05);
  caliper.deleteAttribute('uv');
  return {
    rim: mergeGeometries([faceGeo, lip].map((g) => (g.index ? g : mergeVertices(g)))),
    rimInner: barrel,
    chrome: hub,
    brake: mergeGeometries([disc, caliper])
  };
}

/** A pressed-steel wheel (vans and small trucks), facing +z. */
export function steelWheel(rimRadius, depth, { holes = 6, segments = 40 } = {}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rimRadius * 0.95, 0, Math.PI * 2, false);
  for (let k = 0; k < holes; k += 1) {
    const a = (k / holes) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absellipse(Math.cos(a) * rimRadius * 0.62, Math.sin(a) * rimRadius * 0.62, rimRadius * 0.1, rimRadius * 0.14, 0, Math.PI * 2, false, a);
    shape.holes.push(hole);
  }
  const face = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: segments });
  face.deleteAttribute('uv');
  const faceGeo = mergeVertices(face);
  faceGeo.translate(0, 0, depth / 2 - 0.035);
  faceGeo.computeVertexNormals();
  const barrel = new THREE.CylinderGeometry(rimRadius, rimRadius, depth, segments, 1, true);
  barrel.rotateX(Math.PI / 2);
  barrel.deleteAttribute('uv');
  const cap = new THREE.SphereGeometry(rimRadius * 0.3, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.rotateX(Math.PI / 2);
  cap.scale(1, 1, 0.35);
  cap.translate(0, 0, depth / 2 - 0.03);
  cap.deleteAttribute('uv');
  return { rim: faceGeo, rimInner: barrel, chrome: cap };
}

/** A rounded box with its uv removed, centred at (x, y, z). */
export function box(w, h, d, x, y, z, radius = 0.01, segments = 2) {
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return place(new RoundedBox(w, h, d, segments, Math.max(r, 1e-4)), x, y, z);
}

export function place(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  geo.rotateX(rx);
  geo.rotateY(ry);
  geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

/** Mirrors a geometry across the z = 0 plane, keeping faces outward. */
export function mirrorZ(geo) {
  const g = geo.clone();
  g.scale(1, 1, -1);
  const index = g.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
    index.needsUpdate = true;
  }
  g.computeVertexNormals();
  return g;
}
