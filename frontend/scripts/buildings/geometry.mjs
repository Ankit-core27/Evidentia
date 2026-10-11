// Geometry helpers for the building models. Every component is a named THREE.Group
// whose userData carries { kind, ... }; GLTFExporter writes userData as node extras,
// and GLTFLoader reads them back, so the building viewer can find each component.
import * as THREE from 'three';

const geometries = new Map();
function boxGeometry(w, h, d) {
  const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`;
  if (!geometries.has(key)) geometries.set(key, new THREE.BoxGeometry(w, h, d));
  return geometries.get(key);
}

/** A box mesh from its min and max corners. */
export function box(name, [x0, y0, z0], [x1, y1, z1], material) {
  const mesh = new THREE.Mesh(boxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
  mesh.name = name;
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh;
}

/** A named component group. */
export function component(name, userData, children = []) {
  const g = new THREE.Group();
  g.name = name;
  g.userData = userData;
  for (const c of children) g.add(c);
  return g;
}

/**
 * A wall that runs along `axis` ('x' or 'z') at `at` on the other axis, from `from` to `to`,
 * between heights y0 and y1, `t` thick. Openings are { c, w, bottom, top, kind, id, label }
 * with `c` the centre along the wall and heights relative to y0. Windows get a glass pane
 * inside the wall component; doors become their own `door` component inside the wall,
 * so they move with the wall when it is pushed outward.
 */
export function wall(name, userData, { axis, at, from, to, y0, y1, t, openings = [] }, mats) {
  const g = component(name, userData);
  const h = y1 - y0;
  const span = (a0, a1, b0, b1, mat, n) => {
    if (a1 - a0 < 1e-3 || b1 - b0 < 1e-3) return;
    const min = axis === 'x' ? [a0, y0 + b0, at - t / 2] : [at - t / 2, y0 + b0, a0];
    const max = axis === 'x' ? [a1, y0 + b1, at + t / 2] : [at + t / 2, y0 + b1, a1];
    g.add(box(`${name}_${n}`, min, max, mat));
  };
  const sorted = [...openings].sort((a, b) => a.c - b.c);
  let cursor = from;
  let n = 0;
  for (const o of sorted) {
    const a0 = o.c - o.w / 2;
    const a1 = o.c + o.w / 2;
    span(cursor, a0, 0, h, mats.wall, `seg${n++}`);
    span(a0, a1, 0, o.bottom, mats.wall, `sill${n++}`);
    span(a0, a1, o.top, h, mats.wall, `lintel${n++}`);
    if (o.kind === 'window') {
      const min = axis === 'x' ? [a0, y0 + o.bottom, at - 0.02] : [at - 0.02, y0 + o.bottom, a0];
      const max = axis === 'x' ? [a1, y0 + o.top, at + 0.02] : [at + 0.02, y0 + o.top, a1];
      g.add(box(`${name}_glass${n++}`, min, max, mats.glass));
    } else if (o.kind === 'door' || o.kind === 'shutter') {
      const leafT = o.kind === 'shutter' ? 0.06 : 0.05;
      const min = axis === 'x' ? [a0 + 0.02, y0, at - leafT / 2] : [at - leafT / 2, y0, a0 + 0.02];
      const max = axis === 'x' ? [a1 - 0.02, y0 + o.top - 0.02, at + leafT / 2] : [at + leafT / 2, y0 + o.top - 0.02, a1 - 0.02];
      const leaf = box(`${o.id}_leaf`, min, max, o.kind === 'shutter' ? mats.shutter : mats.door);
      g.add(component(o.id, { kind: 'door', label: o.label, material: o.kind === 'shutter' ? 'rolling shutter' : 'timber', width_m: o.w, height_m: o.top }, [leaf]));
    }
    cursor = a1;
  }
  span(cursor, to, 0, h, mats.wall, `seg${n++}`);
  return g;
}

/** A slab from (x0,z0) to (x1,z1) with an optional rectangular hole for a stair. */
export function slab(name, userData, [x0, z0, x1, z1], y0, y1, mat, hole) {
  const g = component(name, userData);
  if (!hole) {
    g.add(box(`${name}_0`, [x0, y0, z0], [x1, y1, z1], mat));
    return g;
  }
  const [hx0, hz0, hx1, hz1] = hole;
  g.add(box(`${name}_0`, [x0, y0, z0], [x1, y1, hz0], mat));
  g.add(box(`${name}_1`, [x0, y0, hz1], [x1, y1, z1], mat));
  g.add(box(`${name}_2`, [x0, y0, hz0], [hx0, y1, hz1], mat));
  g.add(box(`${name}_3`, [hx1, y0, hz0], [x1, y1, hz1], mat));
  return g;
}

/** A straight flight of steps rising along +axis/-axis inside [x0,z0]-[x1,z1], from y0 to y1. */
export function stairs(name, userData, [x0, z0, x1, z1], y0, y1, run, mats) {
  const g = component(name, userData);
  const count = Math.round((y1 - y0) / 0.175);
  const rise = (y1 - y0) / count;
  const along = run === 'x+' || run === 'x-' ? 'x' : 'z';
  const len = along === 'x' ? x1 - x0 : z1 - z0;
  const going = len / count;
  for (let i = 0; i < count; i++) {
    const s0 = run.endsWith('+') ? i * going : len - (i + 1) * going;
    const s1 = s0 + going;
    const top = y0 + (i + 1) * rise;
    const min = along === 'x' ? [x0 + s0, y0, z0] : [x0, y0, z0 + s0];
    const max = along === 'x' ? [x0 + s1, top, z1] : [x1, top, z0 + s1];
    g.add(box(`${name}_step${i}`, min, max, mats.stair));
  }
  // Handrail on the open side.
  const railMin = along === 'x' ? [x0, y0 + 0.9, z1 - 0.05] : [x1 - 0.05, y0 + 0.9, z0];
  const railMax = along === 'x' ? [x1, y1 + 0.9, z1] : [x1, y1 + 0.9, z1];
  g.add(box(`${name}_rail`, railMin, railMax, mats.metal));
  g.userData.steps = count;
  return g;
}
